/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * التحكّم بإظهار شارات إشراق من داخل التطبيق.
 *
 * لكلّ شارة **نطاقان**، والفرق بينهما معلنٌ للمستخدم لا مخفيّ:
 *
 *   • **محليّ** — يُخزَّن في إعداداتك، ويسري على جهازك وحده. فوريّ، ولا يحتاج
 *     إثبات هوية. الآخرون يظلّون يرون الشارة.
 *   • **لدى إشراق بالكامل** — يُكتب على الخادم في `badges/visibility.json`،
 *     فيقرؤه كلّ عميل إشراق وتختفي الشارة عن الجميع.
 *
 * كان المحليّ وحده مرفوضاً — لأنّه حينها **يتظاهر** بأنّه إخفاءٌ عامّ. أمّا
 * حين يكون النطاق خياراً مكتوباً أمام المستخدم فلا لبس.
 *
 * ── كيف يُثبِت التطبيق هويّتك للنطاق العامّ ─────────────────────────────
 *
 * الخادم لا يثق بادّعاء العميل: أيّ أحد يستطيع إرسال معرّف غيره. فالطريق هو
 * الرابط الموقَّع الذي يُصدره أمر `/badge` في ديسكورد. حين تكتب الأمر يردّ
 * البوت برابطٍ فيه رمز، فيلتقطه هذا الملفّ من ردّ البوت **إليك أنت** ويحتفظ به
 * في الذاكرة وحدها — لا يُكتب على القرص، وينتهي بانتهاء صلاحيته (١٥ دقيقة).
 *
 * لماذا لا مفتاح دائم؟ لأنّه بيانات اعتماد تسكن جهاز كلّ مستخدم، ومن قرأ ملفّ
 * الإعدادات غيّر شارات صاحبه. اختير القصير المتجدّد على الدائم المخزَّن.
 */

import { Settings } from "@api/Settings";
import { ESHARQ_BOT_USER_ID } from "@utils/constants";
import { FluxDispatcher } from "@webpack/common";

export const BADGE_KINDS = ["tier", "user", "custom", "selfserve"] as const;
export type BadgeKind = (typeof BADGE_KINDS)[number];
export type Surface = "profile" | "chat";

const VISIBILITY_API = "https://esharq.org/api/badge/visibility";
const LINK_HOST = "esharq.org";

// ── الرمز الموقَّع ───────────────────────────────────────────────────

let linkToken: string | null = null;
let linkExpiry = 0;
const listeners = new Set<() => void>();

/** الرمز صالحٌ الآن؟ */
export function hasLink(): boolean {
    return linkToken !== null && Date.now() < linkExpiry;
}

export function onLinkChange(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function announce() {
    for (const fn of listeners) {
        try { fn(); } catch { /* مستمعٌ فاشل لا يُسقط البقية */ }
    }
}

/**
 * يلتقط الرمز من ردّ بوت إشراق. الردّ عابر (ephemeral) فلا يصل إلا لصاحبه،
 * ومع ذلك يُفحص مُرسِلُه صراحةً: رسالةٌ من غير البوت لا تُقرأ منها رموز.
 */
function captureFrom(message: any) {
    if (message?.author?.id !== ESHARQ_BOT_USER_ID) return;

    const haystack = [
        message.content,
        ...(message.embeds ?? []).flatMap((e: any) => [e?.description, e?.url, e?.rawDescription]),
        ...(message.components ?? []).flatMap((row: any) =>
            (row?.components ?? []).map((c: any) => c?.url))
    ].filter((x: unknown): x is string => typeof x === "string");

    for (const text of haystack) {
        for (const match of text.matchAll(/https:\/\/([\w.-]+)\/badge\?t=([\w.\-~%]+)/g)) {
            // المضيف يُفحص، فلا يُسلَّم رمزٌ لعنوانٍ يشبه عنواننا.
            if (match[1] !== LINK_HOST) continue;
            linkToken = decodeURIComponent(match[2]);
            // الرابط يعيش ١٥ دقيقة عند الخادم؛ نطرح دقيقة هامشاً حتى لا نُرسل
            // طلباً برمزٍ انتهى للتوّ فيبدو الفشل عطلاً في الشبكة.
            linkExpiry = Date.now() + 14 * 60 * 1000;
            announce();
            return;
        }
    }
}

const onMessage = ({ message }: any) => captureFrom(message);

export function startLinkCapture() {
    FluxDispatcher.subscribe("MESSAGE_CREATE", onMessage);
}

export function stopLinkCapture() {
    FluxDispatcher.unsubscribe("MESSAGE_CREATE", onMessage);
    linkToken = null;
    linkExpiry = 0;
}

// ── التفضيل المحليّ ─────────────────────────────────────────────────

type LocalMap = Record<string, boolean>;

/** `badgeHidden` خريطة مسطّحة `"<kind>:<surface>" → true`، والغياب = ظاهرة. */
function localMap(): LocalMap {
    const raw = (Settings.esharq as any).badgeHidden;
    return raw && typeof raw === "object" ? raw as LocalMap : {};
}

export function isHiddenLocally(kind: BadgeKind, surface: Surface): boolean {
    return localMap()[`${kind}:${surface}`] === true;
}

export function setHiddenLocally(kind: BadgeKind, surface: Surface, hidden: boolean) {
    const next = { ...localMap() };
    const key = `${kind}:${surface}`;
    if (hidden) next[key] = true;
    else delete next[key];
    (Settings.esharq as any).badgeHidden = next;
}

// ── التفضيل العامّ ──────────────────────────────────────────────────

export interface RemoteState {
    hasBadge: boolean;
    badges: Partial<Record<"tier" | "user" | "custom", { held: boolean; profile: boolean; chat: boolean; }>>;
    surfaces?: { profile: boolean; chat: boolean; };
}

export async function fetchRemote(): Promise<RemoteState | null> {
    if (!hasLink()) return null;
    try {
        const res = await fetch(`${VISIBILITY_API}?t=${encodeURIComponent(linkToken!)}`);
        const data = await res.json();
        return data?.ok ? data as RemoteState : null;
    } catch {
        return null;
    }
}

/** يُعيد رسالة الخطأ عند الفشل، و`null` عند النجاح. */
export async function setRemote(
    kind: BadgeKind, surface: Surface, visible: boolean
): Promise<string | null> {
    if (!hasLink()) return "انتهت صلاحية الرابط. اكتب /badge في ديسكورد من جديد.";
    try {
        const res = await fetch(VISIBILITY_API, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: linkToken, kind, surface, visible })
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) return data?.reason ?? "تعذّر الحفظ. حاول بعد قليل.";
        return null;
    } catch {
        return "تعذّر الاتّصال. تحقّق من شبكتك.";
    }
}
