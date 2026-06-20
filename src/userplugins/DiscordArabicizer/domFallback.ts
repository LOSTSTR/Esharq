/*
 * DiscordArabicizer — طبقة DOM احتياطية للنصوص «المتجاوِزة»
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * بعض نصوص ديسكورد تُرسَم عبر وحدات التقطت مرجع دالّة الترجمة كـ«قيمة محليّة» قبل
 * ترقيعنا، فلا تمرّ بمحرّك intl إطلاقاً (لا 🟢 ولا 🔴 في الوضع التشخيصي). هذه الطبقة
 * تستبدل قائمةً قصيرة جداً منها مباشرةً في الـDOM بعد الرسم — مراقِب حدثي خفيف:
 * صفر استهلاك عند ثبات الشاشة، يُفصَل نهائياً عند الإيقاف.
 */

import { translations as AR } from "./translations";

// نفس تطبيع المحرّك (نسخة محليّة صغيرة لتفادي أي اعتماد دائري).
function normalize(s: string): string {
    return s.replace(/[‘’‛]/g, "'").replace(/[“”]/g, '"');
}

// النصوص المتجاوِزة المؤكَّدة فقط — قائمة قصيرة عمداً. الباقي يتولّاه المحرّك العادي.
// (كلها موجودة في القاموس؛ الطبقة تقرأ ترجمتها من هناك. تتجاوز محرّك intl فلا تُترجَم إلا هنا.)
const BYPASS_KEYS = [
    "Enhanced Role Styles",
    "Make certain roles stand out with animated, vibrant gradients.",
    "Server Tag",
    "Let your members represent your server everywhere on Discord.",
    "Learn More",
    "Level 1",
    "Level 2",
    "Level 3",
    // الجملة العريضة في آخر وصف «مستوى التوثيق» — عقدة منفصلة قصيرة، مطابقة حرفية كاملة.
    "We recommend setting a verification level for a Community Server.",
];

// نصوص طويلة متجاوِزة يصعب مطابقتها حرفياً (يقسمها ديسكورد أو يغيّر طولها) — نطابقها
// ببادئة مميّزة (أول 40 حرفاً) ضمن حدّ طول، فتصمد أمام أي اختلاف في وسط/آخر النصّ،
// ونستبدل العقدة كاملةً بترجمتها من القاموس. كل مفتاح هنا مُترجَم في القاموس.
const PREFIX_BYPASS_KEYS = [
    "Members of the server must meet the following criteria before they can send messages in text channels or initiate a direct message conversation. If a member has an assigned role and server onboarding is not enabled, this does not apply.",
];
const PREFIX_BYPASS: { prefix: string; ar: string; max: number; }[] = [];
for (const key of PREFIX_BYPASS_KEYS) {
    const ar = (AR as Record<string, string>)[key];
    if (ar != null) PREFIX_BYPASS.push({ prefix: normalize(key.slice(0, 40)), ar, max: key.length + 60 });
}

// خريطة (إنجليزي مُطبَّع → عربي) من القاموس نفسه (مصدر واحد للترجمة).
const bypassMap = new Map<string, string>();
for (const key of BYPASS_KEYS) {
    const ar = (AR as Record<string, string>)[key];
    if (ar != null) bypassMap.set(normalize(key), ar);
}
// أطول مفتاح — لتخطّي النصوص الطويلة (الرسائل…) بمقارنة طول واحدة قبل أي بحث.
let maxKeyLen = 0;
for (const k of bypassMap.keys()) if (k.length > maxKeyLen) maxKeyLen = k.length;
// أقصى طول عقدة نفحصها (يشمل قائمة البادئات الطويلة) — ما فوقه يخرج فوراً (نصوص الدردشة).
let scanMax = maxKeyLen + 4;
for (const p of PREFIX_BYPASS) if (p.max > scanMax) scanMax = p.max;

let observer: MutationObserver | null = null;

// يستبدل نصّ عقدة نصّية واحدة إن طابق قائمتنا (مع حفظ المسافات المحيطة).
function tryTranslateTextNode(node: Text): void {
    const raw = node.nodeValue;
    if (raw == null) return;
    // مسار سريع: تجاهل ما هو أقصر/أطول من أي مفتاح ممكن (يخرج فوراً لنصوص الدردشة الطويلة).
    if (raw.length < 3 || raw.length > scanMax) return;

    // (أ) القائمة القصيرة: مطابقة حرفية كاملة (مع/بدون مسافات محيطة).
    if (raw.length <= maxKeyLen + 4) {
        const direct = bypassMap.get(normalize(raw));
        if (direct !== undefined) {
            if (raw !== direct) node.nodeValue = direct; // عربيّتنا ليست مفتاحاً → لا حلقة لا نهائية
            return;
        }
        const trimmed = raw.trim();
        if (trimmed.length !== raw.length) {
            const ar = bypassMap.get(normalize(trimmed));
            if (ar !== undefined) { node.nodeValue = raw.replace(trimmed, ar); return; }
        }
    }

    // (ب) النصوص الطويلة المتجاوِزة: مطابقة ببادئة مميّزة ضمن حدّ طول → استبدال العقدة كاملةً.
    if (PREFIX_BYPASS.length !== 0) {
        const trimmed = raw.trim();
        for (const { prefix, ar, max } of PREFIX_BYPASS) {
            if (trimmed.length <= max && normalize(trimmed).startsWith(prefix)) {
                if (trimmed !== ar) node.nodeValue = raw.replace(trimmed, ar);
                return;
            }
        }
    }
}

// يمرّ على العقد النصّية داخل عنصر مُضاف (مرّة عند الإدراج فقط) ويترجم المطابق.
function scanElement(el: Element): void {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode()) != null) tryTranslateTextNode(n as Text);
}

function onMutations(records: MutationRecord[]): void {
    // قياس تشخيصي اختياري (أثناء تسجيل EsharqDiagnostics فقط) — كم مرّة يُطلَق المراقِب وكم يستغرق.
    const prof = (globalThis as any).__esharqProf;
    const t0 = prof ? performance.now() : 0;
    try {
        for (const rec of records) {
            if (rec.type === "characterData") {
                if (rec.target.nodeType === Node.TEXT_NODE) tryTranslateTextNode(rec.target as Text);
                continue;
            }
            for (let i = 0; i < rec.addedNodes.length; i++) {
                const added = rec.addedNodes[i];
                if (added.nodeType === Node.TEXT_NODE) tryTranslateTextNode(added as Text);
                else if (added.nodeType === Node.ELEMENT_NODE) scanElement(added as Element);
            }
        }
    } catch { /* أمان مطلق: طبقة احتياطية لا يجوز أن تضرّ أبداً */ }
    if (prof) prof.hit("domFallback.onMutations", performance.now() - t0);
}

/** يبدأ الطبقة: كنسة أوّلية مرّة واحدة + مراقِب حدثي (لا فحص دوري). آمن للاستدعاء المتكرّر. */
export function startDomFallback(): void {
    if (observer != null) return;                       // idempotent — لا مراقِبَين
    if (bypassMap.size === 0) return;                   // لا شيء لترجمته
    if (typeof MutationObserver === "undefined" || document.body == null) return;

    try { scanElement(document.body); } catch { /* تجاهل */ } // الموجود سلفاً على الشاشة
    observer = new MutationObserver(onMutations);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

/** يوقف الطبقة ويفصل المراقِب نهائياً — لا أثر بعدها، لا تسريب. */
export function stopDomFallback(): void {
    if (observer == null) return;
    observer.disconnect();
    observer = null;
}
