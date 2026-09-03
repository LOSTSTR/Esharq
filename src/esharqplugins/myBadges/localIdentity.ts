/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * هويّتك المحلّية — اسمٌ معروض واسم مستخدم وتاريخ إنشاءٍ تراها أنت وحدك.
 *
 * ── الاسم: لا استنساخ، بل مخزن ديسكورد نفسه ────────────────────────────
 * الطريق الخاطئ هو استنساخ كائن المستخدم وتمريره للمكوّنات: ديسكورد يقارن
 * المستخدمين **بالمرجع**، فالاستنساخ يكسر مقارنات المساواة ويُطلق إعادة
 * حساب الصلاحيات — فتُعاد ترتيب الخوادم وتُخفى قنوات. لذلك نُرسل
 * `USER_UPDATE` عبر Flux فيُحدّث ديسكورد كائنه بنفسه وبمرجعه هو، ويُعيد
 * الرسم في كل موضع طبيعياً. محلّيٌّ بحت: لا نداء شبكة ولا تغيير حساب.
 *
 * 🔴 ونُرسل `username`/`global_name` **وحدهما**. لا `public_flags` ولا
 * `premium_type`: يحسب ديسكورد بهما الصلاحيات وترتيب الخوادم.
 *
 * ── التاريخ: نقطة واحدة لا رقعة ────────────────────────────────────────
 * تاريخ الإنشاء ليس حقلاً في المخزن — يشتقّه ديسكورد من المعرّف
 * (snowflake) عبر `SnowflakeUtils.extractTimestamp`. فنلفّ هذه الدالّة
 * لتكذب **على معرّفك وحده**، فيتغيّر `user.createdAt` ومعه كل موضع عرض
 * («عضو منذ» في النافذة والبطاقة الجانبية) بلا رقعة واحدة. قِيس حيّاً:
 * لفٌّ إلى 2010-06-29 ⇒ النافذة تعرض «عضو منذ يونيو 29 2010».
 */

import { DataStore } from "@api/index";
import { Logger } from "@utils/Logger";
import { FluxDispatcher, SnowflakeUtils, UserStore } from "@webpack/common";

const logger = new Logger("MyBadges:Identity");
const STORE_KEY = "MyBadges_identity";
const ENABLED_KEY = "MyBadges_profileOn";

export interface LocalIdentity {
    /** الاسم المعروض (global_name). فارغٌ = اتركه كما هو. */
    displayName?: string;
    /** اسم المستخدم (@handle). فارغٌ = اتركه كما هو. */
    username?: string;
    /** تاريخ الإنشاء بصيغة YYYY-MM-DD. فارغٌ = اتركه كما هو. */
    createdAt?: string;
}

let identity: LocalIdentity = {};
/** المفتاح الرئيسيّ: يحكم الهويّة **والشارات** معاً. */
let enabled = true;
const listeners = new Set<() => void>();

/** الاسم الحقيقيّ قبل أيّ تبديل — به وحده نستطيع الرجوع. */
let realName: { username: string; globalName: string; } | null = null;
/** الدالّة الأصلية قبل اللفّ — وجودها يعني أنّ اللفّ قائم. */
let origExtract: ((id: string) => number) | null = null;

function notify() {
    for (const fn of listeners) {
        try { fn(); } catch { /* مستمعٌ معطوب لا يُسقط البقيّة */ }
    }
}

export function onIdentityChange(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export const getIdentity = (): LocalIdentity => ({ ...identity });

export const isFakeProfileOn = (): boolean => enabled;

/** يُشغّل الكلّ أو يُرجعه طبيعياً فوراً — بلا إعادة تشغيل. */
export function setFakeProfile(on: boolean): void {
    enabled = on;
    notify();
    if (on) applyIdentity();
    else restoreIdentity();
    DataStore.set(ENABLED_KEY, on).catch(e => logger.error("failed to save master switch", e));
}

/** هل التاريخ صالحٌ ومعقول؟ ديسكورد وُلد 2015، ولا معنى لتاريخٍ في المستقبل. */
export function isValidCreatedAt(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const ms = Date.parse(`${value}T12:00:00Z`);
    return !isNaN(ms) && ms > Date.parse("2005-01-01") && ms < Date.now();
}

// ── الاسم ────────────────────────────────────────────────────────────

function pushName(username: string, globalName: string) {
    const me = UserStore.getCurrentUser() as any;
    if (!me) return;

    // 🔴 كتابةٌ **في المكان** لا إرسال Flux ولا استنساخ.
    // قِيس على عميل حيّ: `USER_UPDATE` للمستخدم الحاليّ يتجاهله المخزن في
    // إصدارات ديسكورد الحالية (جرّبتُ الحقول الجزئية والكاملة، فلم يتغيّر
    // شيء). والكتابة المباشرة تعمل، وهي **الأسلم** أصلاً: الكائن نفسه يبقى
    // بمرجعه، فلا تُكسر مقارنات ديسكورد بالمرجع ولا يُعاد حساب الصلاحيات.
    me.username = username;
    me.globalName = globalName;

    // المخزن لا يعلم بالكتابة، فنُوقظ المشتركين ليُعاد الرسم.
    try {
        (UserStore as any).emitChange?.();
    } catch (e) {
        logger.debug("emitChange skipped", e);
    }
}

/** ديسكورد قد يدهس الاسم عند جهوز البوّابة، فنُعيده حينها. */
let watching = false;
function watchOverwrites() {
    if (watching) return;
    watching = true;
    try {
        FluxDispatcher.subscribe("CONNECTION_OPEN", () => applyName());
    } catch (e) {
        logger.debug("subscribe skipped", e);
    }
}

function applyName() {
    const me = UserStore.getCurrentUser() as any;
    if (!me) return;
    if (!identity.username && !identity.displayName) return;

    realName ??= {
        username: me.username,
        globalName: me.globalName ?? me.username
    };

    pushName(
        identity.username || realName.username,
        identity.displayName || realName.globalName
    );
}

function restoreName() {
    if (!realName) return;
    pushName(realName.username, realName.globalName);
    realName = null;
}

// ── تاريخ الإنشاء ────────────────────────────────────────────────────

function applyDate() {
    if (!identity.createdAt || !isValidCreatedAt(identity.createdAt)) return;
    if (origExtract) return; // اللفّ قائم؛ يقرأ `identity` حياً فلا يلزم إعادته

    const me = UserStore.getCurrentUser();
    if (!me) return;

    const su = SnowflakeUtils as unknown as { extractTimestamp(id: string): number; };
    const original = su.extractTimestamp.bind(su);
    origExtract = original;

    su.extractTimestamp = (id: string): number => {
        // معرّفك وحده يكذب؛ ومعرّفات الرسائل وغيرها تمرّ كما هي.
        if (String(id) === me.id && identity.createdAt && isValidCreatedAt(identity.createdAt)) {
            return Date.parse(`${identity.createdAt}T12:00:00Z`);
        }
        return original(id);
    };
}

function restoreDate() {
    if (!origExtract) return;
    (SnowflakeUtils as unknown as { extractTimestamp: (id: string) => number; }).extractTimestamp = origExtract;
    origExtract = null;
}

// ── واجهة الإضافة والصفحة ────────────────────────────────────────────

/** يُطبّق ما هو محفوظ. آمنٌ للاستدعاء مراراً. */
export function applyIdentity(): void {
    if (!enabled) return;
    try {
        applyName();
        applyDate();
        watchOverwrites();
    } catch (e) {
        logger.error("failed to apply identity", e);
    }
}

/** يُرجع كل شيء إلى حقيقته — يُستدعى عند إطفاء الإضافة. */
export function restoreIdentity(): void {
    try {
        restoreName();
        restoreDate();
    } catch (e) {
        logger.error("failed to restore identity", e);
    }
}

/** يحفظ حقلاً ويُطبّق فوراً. الحقل الفارغ يعني «اترك الحقيقي». */
export function setIdentityField(key: keyof LocalIdentity, value: string): void {
    const next = value.trim();
    identity = { ...identity, [key]: next || undefined };

    // إفراغ الاسم يعني الرجوع إليه؛ وإفراغ التاريخ يفكّ اللفّ.
    if (key === "createdAt" && !next) restoreDate();
    if ((key === "username" || key === "displayName") && !identity.username && !identity.displayName) restoreName();

    notify();
    applyIdentity();
    DataStore.set(STORE_KEY, identity).catch(e => logger.error("failed to save identity", e));
}

/** يُقرأ مرّةً عند إقلاع الإضافة. */
export async function loadIdentity(): Promise<void> {
    try {
        const on = await DataStore.get(ENABLED_KEY);
        if (typeof on === "boolean") enabled = on;
        const saved = await DataStore.get(STORE_KEY);
        if (saved && typeof saved === "object") identity = saved as LocalIdentity;
    } catch (e) {
        logger.error("failed to load identity", e);
    }
    notify();
}
