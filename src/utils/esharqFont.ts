/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Esharq — خطّ التعريب العربي الموحّد (Tajawal).
 *
 * النهج (بطلب المالك: «ادمج الخطّ في الخطّ نفسه لا في CSS»): بدل التنافس في تتالي
 * CSS ضدّ الثيمات/QuickCSS (نهج قديم كان يُهزَم ويعود للافتراضي، وكان يفرض متغيّرات
 * الخطّ بـ!important فيكسر خيارات الثيمات)، نُعيد تعريف خطوط Discord نفسها (gg sans،
 * Noto Sans، ABC Ginto…) عبر @font-face بحيث تُرسَم محارفها العربية بـTajawal. فأيّ
 * نصّ يستعمل هذه الخطوط — وإليها يعود «الافتراضي» — يعرض العربية بـTajawal تلقائياً.
 * @font-face عالميّ لا يخضع للتتالي، فلا يُبطله ثيمٌ ولا QuickCSS، ولا يفرض بديلاً على
 * اللاتيني (نطاق عربيّ فقط عبر unicode-range) → صفر تأثير على بقية اشراق والثيمات.
 *
 * الاستهلاك: نُفكّك الخطّ إلى Blob مرّة واحدة (3 أوزان ≈ 27ك في الذاكرة) ونشير إليه
 * برابط قصير، فنصّ الـCSS ضئيل ولا يتكرّر base64. لا مُراقب DOM ولا عمل لكل إطار —
 * حَقن لمرّة واحدة فقط عند التفعيل.
 */

import { ARABIC_RANGE, TAJAWAL } from "./esharqFontData";

const STYLE_ID = "esharq-arabic-font";

// خطوط Discord المعروفة (احتياط إن لم تُقرأ المتغيّرات بعد). لا نلمس أحادي المسافة.
const FALLBACK_FAMILIES = ["gg sans", "ABC Ginto Nord", "ABC Ginto Normal", "Noto Sans"];
const GENERIC = /^(inherit|initial|unset|sans-serif|serif|monospace|system-ui|ui-sans-serif|-apple-system|BlinkMacSystemFont|Helvetica Neue|Helvetica|Arial|helvetica|arial|Segoe UI|Roboto|emoji)$/i;

let styleEl: HTMLStyleElement | null = null;
let urls: Record<number, string> | null = null;

/** يفكّ base64 إلى Blob URL مرّة واحدة لكل وزن — يتجنّب تكرار الـbase64 في نصّ الـCSS. */
function fontUrls(): Record<number, string> {
    if (urls) return urls;
    const mk = (b64: string) => {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return URL.createObjectURL(new Blob([arr], { type: "font/woff2" }));
    };
    urls = { 400: mk(TAJAWAL[400]), 500: mk(TAJAWAL[500]), 700: mk(TAJAWAL[700]) };
    return urls;
}

/** أسماء العائلات المُستهدَفة: الاحتياط + ما تقرؤه المتغيّرات فعلاً (بلا العام/اللاتيني). */
function targetFamilies(): string[] {
    const set = new Set(FALLBACK_FAMILIES);
    try {
        const cs = getComputedStyle(document.documentElement);
        // نتعمّد تجاهل --font-code (أحادي المسافة) كي لا تُعرَّب كتل الشيفرة.
        for (const v of ["--font-primary", "--font-display", "--font-headline"]) {
            for (const part of cs.getPropertyValue(v).split(",")) {
                const fam = part.trim().replace(/^["']|["']$/g, "");
                if (fam && !GENERIC.test(fam)) set.add(fam);
            }
        }
    } catch { /* المتغيّرات غير جاهزة — يكفي الاحتياط */ }
    return [...set];
}

function buildCss(): string {
    const u = fontUrls();
    let css = "";
    for (const fam of targetFamilies()) {
        const q = JSON.stringify(fam);
        for (const w of [400, 500, 700] as const) {
            css += `@font-face{font-family:${q};font-style:normal;font-weight:${w};font-display:swap;`
                + `src:url(${u[w]}) format("woff2");unicode-range:${ARABIC_RANGE};}`;
        }
    }
    return css;
}

/** يزيل بقايا النهج القديم (صنف da-font + ورقة التجاوز) كي لا تُعطّل الثيمات. */
function cleanupLegacy(): void {
    try {
        document.documentElement.classList.remove("da-font");
        document.getElementById("esharq-font-override")?.remove();
    } catch { /* تجاهل */ }
}

/**
 * يُفعِّل/يُعطِّل خطّ التعريب فوراً (بلا إعادة تشغيل): يُعيد تعريف خطوط Discord للعربيّة
 * بـTajawal عند التفعيل، ويزيل التعريف عند التعطيل (فتعود العربية للخطّ الافتراضي).
 */
export function applyArabicFont(enabled: boolean): void {
    try {
        if (enabled) {
            if (!styleEl) {
                styleEl = document.createElement("style");
                styleEl.id = STYLE_ID;
            }
            styleEl.textContent = buildCss();
            // آخر عنصر في <html> ⇒ يُعلَن بعد @font-face الخاصّ بديسكورد، فيفوز لنطاق العربية.
            if (document.documentElement.lastElementChild !== styleEl)
                document.documentElement.appendChild(styleEl);
        } else {
            styleEl?.remove();
        }
    } catch { /* لا DOM بعد — يُطبَّق لاحقاً عبر init */ }
}

/** يُطبّق الحالة المحفوظة عند بدء العميل، وينظّف بقايا النهج القديم. */
export function initArabicFont(enabled: boolean): void {
    cleanupLegacy();
    applyArabicFont(enabled);
}
