/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import { FluxDispatcher, UserProfileStore, UserStore } from "@webpack/common";

import { getSnapshot } from "./store";
import { LookSnapshot } from "./types";

const logger = new Logger("ProfileKeeper");

/**
 * **إعادةُ الشكل — في عميلك أنت.**
 *
 * ## 🔴 مصدران لا مصدرٌ واحد، وطريقتان لا طريقةٌ واحدة
 *
 * ديسكورد يوزّع الزينة على متجرين، وشكلُ ما يُرجعه كلٌّ منهما مختلف:
 *
 *  ① `UserProfileStore.getUserProfile` يُرجع **كائناً عادياً**. فيُلَفّ اللفَّ
 *    المعتاد ويُدمج معه المحفوظ.
 *  ② `UserStore.getUser` يُرجع **سجلّاً بصنفٍ وخصائصَ محسوبة**: `nameplate`
 *    و`avatarDecoration` خاصّيّتان تُشتقّان من حقولٍ أخرى. ونسخُه بالنشر
 *    (`{...user}`) يُسقط نموذجه الأوّليّ فتختفي الخصائص المحسوبة كلّها —
 *    وينكسر نصف العميل. فالحقول تُكتب في السجلّ نفسه، ويُحفظ الأصل حرفياً
 *    ليعود كما كان.
 *
 * ## وتساوي المراجع شرطٌ لا زينة
 *
 * المكوّنات تقرأ عبر `useStateFromStores` وتقارن بالمرجع. وإرجاع كائنٍ جديد
 * عند كلّ نداء يُعيد الرسم بلا توقّف. فالمدموج يُخزَّن ويُعاد بعينه ما لم
 * يتغيّر أحد طرفيه.
 *
 * ## ولا يُستعاد شيءٌ فوق شيءٍ قائم
 *
 * الحقل المحفوظ لا يُكتب إلّا إذا كان الحيّ **فارغاً**. فما دام اشتراكك
 * قائماً لا تلمس هذه الإضافة ملفّك البتّة، وحين ينتهي يظهر المحفوظ مكان
 * الفراغ وحده.
 */

type GetProfile = (userId: string) => any;

let restoreProfileStore: (() => void) | null = null;
let selfId = "";

interface MergeCache {
    base: any;
    snap: LookSnapshot | null;
    out: any;
}

let profileCache: MergeCache | null = null;

/**
 * الحقول التي كُتبت في سجلّ المستخدم، بقيمها الأصلية، لتعود كما كانت.
 *
 * 🔴 ومعها **مرجع السجلّ نفسه**. وبدونه وقع عيبٌ قِيس حيّاً: كان كلّ
 * `USER_UPDATE` يمحو قائمة الأصول ثمّ يُعيد الكتابة، فيجد الحقل مكتوباً سلفاً
 * فلا يحفظ له أصلاً — وتبقى القائمة فارغة. فلمّا أُوقفت الإضافة لم تجد ما
 * تُعيده، **وبقيت اللوحة المحقونة في سجلّ المستخدم بعد الإيقاف**.
 *
 * والأصول لا تُمحى إلّا إذا **بدّل ديسكورد السجلّ نفسه** — وذلك يُعرَف
 * بالمرجع لا بالحدث: الحدث يقع وقد لا يُعاد البناء.
 */
const savedUserFields = new Map<string, unknown>();
let patchedRecord: Record<string, any> | null = null;

export const isActive = (): boolean => restoreProfileStore !== null;

/** يدمج المحفوظ في الملفّ، ولا يطمس حقلاً له قيمة. */
function mergeProfile(base: any, snap: LookSnapshot): any {
    const patch: Record<string, unknown> = {};

    if (!base.banner && snap.banner) patch.banner = snap.banner;
    if (base.accentColor == null && snap.accentColor !== null) patch.accentColor = snap.accentColor;
    if (!base.themeColors && snap.themeColors) patch.themeColors = snap.themeColors;
    if (!base.profileEffect && snap.profileEffect) patch.profileEffect = snap.profileEffect;
    if (!base.profileEffectId && snap.profileEffectId) patch.profileEffectId = snap.profileEffectId;
    if ((!base.collectibles || base.collectibles.length === 0) && snap.collectibles)
        patch.collectibles = snap.collectibles;

    if (Object.keys(patch).length === 0) return base;
    return { ...base, ...patch };
}

/** يكتب الإطار واللوحة في سجلّ المستخدم، ويحفظ ما كان **مرّةً واحدة**. */
function patchUserRecord(snap: LookSnapshot): void {
    const me = UserStore.getCurrentUser() as unknown as Record<string, any> | undefined;
    if (!me) return;

    // سجلٌّ جديد ⇒ ما حفظناه يخصّ سجلّاً ماتَ، فيُبدَأ من جديد عليه هو.
    if (patchedRecord !== me) {
        savedUserFields.clear();
        patchedRecord = null;
    }

    let touched = false;

    if (!me.avatarDecorationData && snap.avatarDecoration) {
        if (!savedUserFields.has("avatarDecorationData"))
            savedUserFields.set("avatarDecorationData", me.avatarDecorationData);
        me.avatarDecorationData = { ...snap.avatarDecoration, expires_at: null };
        touched = true;
    }

    if (!me.collectibles?.nameplate && snap.nameplate) {
        if (!savedUserFields.has("collectibles"))
            savedUserFields.set("collectibles", me.collectibles);
        me.collectibles = { ...(me.collectibles ?? {}), nameplate: snap.nameplate };
        touched = true;
    }

    if (touched) patchedRecord = me;
}

/**
 * يُعيد الحقول إلى **السجلّ الذي كُتب فيه**، لا إلى ما يُرجعه المتجر الآن.
 * فلو بدّل ديسكورد السجلّ بعد كتابتنا كان المكتوب قد زال معه، والكتابة فوق
 * السجلّ الجديد بقيمٍ قديمة إفسادٌ لا إصلاح.
 */
function unpatchUserRecord(): void {
    if (patchedRecord) {
        for (const [field, value] of savedUserFields) patchedRecord[field] = value;
    }
    savedUserFields.clear();
    patchedRecord = null;
}

/**
 * 🔴 ديسكورد قد يُعيد بناء سجلّ المستخدم عند `USER_UPDATE`، فيمحو ما كتبناه
 * بلا إشعار. فيُعاد الكتب — و`patchUserRecord` وحدها تُقرّر هل هو سجلٌّ جديد
 * يحتاج أصولاً جديدة أم هو نفسه فتبقى أصوله محفوظة.
 */
function onUserUpdate() {
    const snap = getSnapshot();
    if (!snap || !restoreProfileStore) return;
    patchUserRecord(snap);
}

export function install(): void {
    if (restoreProfileStore) return;

    const me = UserStore.getCurrentUser();
    if (!me) {
        logger.warn("لا حساب حاليّ — تُؤجَّل الاستعادة");
        return;
    }
    selfId = me.id;

    const store = UserProfileStore as unknown as Record<string, any>;
    const previous = Object.getOwnPropertyDescriptor(store, "getUserProfile");
    const original: GetProfile = store.getUserProfile.bind(UserProfileStore);

    store.getUserProfile = ((userId: string) => {
        const base = original(userId);
        if (userId !== selfId || !base) return base;

        const snap = getSnapshot();
        if (!snap) return base;

        if (profileCache && profileCache.base === base && profileCache.snap === snap)
            return profileCache.out;

        const out = mergeProfile(base, snap);
        profileCache = { base, snap, out };
        return out;
    }) as GetProfile;

    restoreProfileStore = () => {
        if (previous) Object.defineProperty(store, "getUserProfile", previous);
        else Reflect.deleteProperty(store, "getUserProfile");
    };

    const snap = getSnapshot();
    if (snap) patchUserRecord(snap);

    FluxDispatcher.subscribe("USER_UPDATE", onUserUpdate);
    FluxDispatcher.subscribe("CURRENT_USER_UPDATE", onUserUpdate);

    (UserProfileStore as any).emitChange?.();
    (UserStore as any).emitChange?.();
}

export function uninstall(): void {
    FluxDispatcher.unsubscribe("USER_UPDATE", onUserUpdate);
    FluxDispatcher.unsubscribe("CURRENT_USER_UPDATE", onUserUpdate);

    restoreProfileStore?.();
    restoreProfileStore = null;
    profileCache = null;

    unpatchUserRecord();

    (UserProfileStore as any).emitChange?.();
    (UserStore as any).emitChange?.();
}

/** يُعيد الرسم بعد تغيّر اللقطة، بلا إعادة تركيب. */
/**
 * يُعيد الرسم بعد تغيّر اللقطة، بلا إعادة تركيب.
 *
 * 🔴 **والمحو يُمحى فعلاً.** كانت الدالّة تكتب ولا تمسح: من ضغط «امحُ اللقطة»
 * يُقال له «مُحيت» بينما اللوحة والإطار المحقونان باقيان في سجلّه إلى أن
 * يُعيد تشغيل العميل. الزرّ الوحيد الذي وُضع للتراجع كان لا يتراجع.
 *
 * وكذلك بعد التقاطةٍ جديدة: ما كُتب من اللقطة القديمة يُرفَع أوّلاً ثمّ يُكتب
 * الجديد، وإلّا بقي القديم لأنّ الحقل «مشغول» فلا يُكتب فوقه.
 */
export function refresh(): void {
    profileCache = null;
    if (!restoreProfileStore) return;

    unpatchUserRecord();

    const snap = getSnapshot();
    if (snap) patchUserRecord(snap);

    (UserProfileStore as any).emitChange?.();
    (UserStore as any).emitChange?.();
}
