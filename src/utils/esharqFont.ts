/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Esharq — خطّ التعريب العربي (قابل للاختيار).
 *
 * النهج (بطلب المالك: «ادمج الخطّ في الخطّ نفسه لا في CSS»): بدل التنافس في تتالي
 * CSS ضدّ الثيمات/QuickCSS (نهج قديم كان يُهزَم ويعود للافتراضي، وكان يفرض متغيّرات
 * الخطّ بـ!important فيكسر خيارات الثيمات)، نُعيد تعريف خطوط Discord نفسها (gg sans،
 * Noto Sans، ABC Ginto…) عبر @font-face بحيث تُرسَم محارفها العربية بالخطّ المختار. فأيّ
 * نصّ يستعمل هذه الخطوط — وإليها يعود «الافتراضي» — يعرض العربية بالخطّ المختار تلقائياً.
 * @font-face عالميّ لا يخضع للتتالي، فلا يُبطله ثيمٌ ولا QuickCSS، ولا يفرض بديلاً على
 * اللاتيني (نطاق عربيّ فقط عبر unicode-range) → صفر تأثير على بقية اشراق والثيمات.
 *
 * الاستهلاك: نُفكّك الخطّ المختار وحده إلى Blob مرّة واحدة ونشير إليه برابط قصير، فنصّ
 * الـCSS ضئيل ولا يتكرّر base64. لا مُراقب DOM ولا عمل لكل إطار — حَقن لمرّة واحدة عند
 * التفعيل، وإعادة حَقن واحدة عند تغيير الخطّ.
 */

import { ARABIC_RANGE, TAJAWAL } from "./esharqFontData";
import { EsharqFontData, EXTRA_FONTS } from "./esharqFontsData";

const STYLE_ID = "esharq-arabic-font";

/** مفاتيح الخطوط المتاحة — "off" تعني إبقاء خطّ ديسكورد الافتراضي. */
export const FONT_KEYS = ["off", "tajawal", "cairo", "almarai", "changa", "elMessiri", "saudi"] as const;
export type EsharqFontKey = typeof FONT_KEYS[number];

/** سجلّ الخطوط: Tajawal (ثلاثة أوزان ثابتة) + الخطوط الإضافية المولّدة. */
const FONTS: Record<string, EsharqFontData> = {
    tajawal: {
        family: "Tajawal",
        faces: [
            { weight: "400", b64: TAJAWAL[400] },
            { weight: "500", b64: TAJAWAL[500] },
            { weight: "700", b64: TAJAWAL[700] }
        ]
    },
    ...EXTRA_FONTS
};

/** الاسم المعروض لكلّ خطّ (للقوائم والتشخيص). */
export const FONT_LABELS: Record<string, string> = Object.fromEntries(
    Object.entries(FONTS).map(([k, v]) => [k, v.family])
);

// خطوط Discord المعروفة (احتياط إن لم تُقرأ المتغيّرات بعد). لا نلمس أحادي المسافة.
const FALLBACK_FAMILIES = ["gg sans", "ABC Ginto Nord", "ABC Ginto Normal", "Noto Sans"];
const GENERIC = /^(inherit|initial|unset|sans-serif|serif|monospace|system-ui|ui-sans-serif|-apple-system|BlinkMacSystemFont|Helvetica Neue|Helvetica|Arial|helvetica|arial|Segoe UI|Roboto|emoji)$/i;

let styleEl: HTMLStyleElement | null = null;
// روابط Blob لكل وجه: المفتاح "fontKey:index" — تُنشأ عند أوّل استعمال للخطّ فقط،
// فلا يُفكّ base64 لخطوط لم يخترها المستخدم (لا كلفة ذاكرة للخطوط غير المستعملة).
const urlCache = new Map<string, string>();

function faceUrl(fontKey: string, index: number, b64: string): string {
    const id = `${fontKey}:${index}`;
    const cached = urlCache.get(id);
    if (cached) return cached;
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: "font/woff2" }));
    urlCache.set(id, url);
    return url;
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

function buildCss(fontKey: string): string {
    const font = FONTS[fontKey];
    if (!font) return "";
    const faces = font.faces.map((f, i) => ({ weight: f.weight, url: faceUrl(fontKey, i, f.b64) }));
    let css = "";
    for (const fam of targetFamilies()) {
        const q = JSON.stringify(fam);
        for (const f of faces) {
            css += `@font-face{font-family:${q};font-style:normal;font-weight:${f.weight};font-display:swap;`
                + `src:url(${f.url}) format("woff2");unicode-range:${ARABIC_RANGE};}`;
        }
    }
    return css;
}

/**
 * يحوّل القيمة المحفوظة إلى مفتاح خطّ صالح.
 * يقبل الصيغة القديمة المنطقية (كان الخيار مفتاحاً ثنائياً لخطّ Tajawal وحده):
 * `true`/غير محدّد → Tajawal، `false` → إيقاف.
 */
export function normalizeFontKey(value: unknown): EsharqFontKey {
    if (value === true || value == null) return "tajawal";
    if (value === false) return "off";
    return (FONT_KEYS as readonly string[]).includes(value as string) ? value as EsharqFontKey : "tajawal";
}

/** يزيل بقايا النهج القديم (صنف da-font + ورقة التجاوز) كي لا تُعطّل الثيمات. */
function cleanupLegacy(): void {
    try {
        document.documentElement.classList.remove("da-font");
        document.getElementById("esharq-font-override")?.remove();
    } catch { /* تجاهل */ }
}

/**
 * يُطبّق الخطّ المختار فوراً (بلا إعادة تشغيل): يُعيد تعريف خطوط Discord للعربيّة بالخطّ
 * المطلوب، ويزيل التعريف عند "off" (فتعود العربية للخطّ الافتراضي).
 */
export function applyArabicFont(value: unknown): void {
    const key = normalizeFontKey(value);
    try {
        if (key !== "off") {
            if (!styleEl) {
                styleEl = document.createElement("style");
                styleEl.id = STYLE_ID;
            }
            styleEl.textContent = buildCss(key);
            // آخر عنصر في <html> ⇒ يُعلَن بعد @font-face الخاصّ بديسكورد، فيفوز لنطاق العربية.
            if (document.documentElement.lastElementChild !== styleEl)
                document.documentElement.appendChild(styleEl);
        } else {
            styleEl?.remove();
        }
    } catch { /* لا DOM بعد — يُطبَّق لاحقاً عبر init */ }
}

/** يُطبّق الحالة المحفوظة عند بدء العميل، وينظّف بقايا النهج القديم. */
export function initArabicFont(value: unknown): void {
    cleanupLegacy();
    applyArabicFont(value);
}
