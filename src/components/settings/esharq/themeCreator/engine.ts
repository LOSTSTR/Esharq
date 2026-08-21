/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * **محرّك منشئ الثيمات** — كل ما يحوّل اختياراً إلى CSS، بلا React وبلا أي
 * أثرٍ عند تحميل الوحدة.
 *
 * 🔴 **لا شيء يُنفَّذ هنا وقت الاستيراد.** درسٌ مدفوع ثمنه: صفحةٌ سابقة عدّدت
 * كائناً عند تحميل وحدتها فأسقطت العميل كلّه قبل أن يُقلع webpack. فكل ما
 * في هذا الملفّ دوالّ تُستدعى، لا سطرٌ يجري وحده.
 *
 * ## كيف يُعاد تلوين ديسكورد كلّه بمتغيّر واحد
 *
 * قِيس على عميل حيّ (2026-08-21):
 *
 *   • ديسكورد يُعرّف **100 متغيّر** `--neutral-N-hsl` — سلّم رماديّ متدرّج.
 *   • والطبقة الدلالية كلّها **مشتقّة منه**: `--background-base-low:
 *     var(--neutral-66)` · `--background-surface-high: var(--neutral-64)` ·
 *     `--text-default: var(--neutral-4)` · `--text-muted: var(--neutral-23)`.
 *   • أمّا متغيّرات الجيل القديم فقد **زالت**: `--background-primary`
 *     و`--background-secondary` و`--bg-overlay-chat` تُرجع فراغاً اليوم.
 *     (ذاكرةٌ قديمة عندنا كانت تقول غير ذلك؛ القياس نقضها.)
 *
 * ⇒ فإعادة تعريف السلّم وحده تُعيد تلوين الخلفيات والأسطح والنصوص معاً،
 * **بلا `!important` واحد وبلا صنفٍ مُجزَّأ**. وهذا هو الفرق بين ثيمٍ يصمد
 * عبر تحديثات ديسكورد وثيمٍ ينكسر مع أوّل تغيير في أسماء الأصناف.
 *
 * ## وكيف يبقى التباين
 *
 * لا يُسحَق السلّم إلى لونٍ واحد: يُحسب **فرق إضاءة كل درجة عن درجةٍ أساس**،
 * ثم يُعاد بناء الدرجة كـ`calc(إضاءتك ± الفرق)`. فتتحرّك اللوحة كلّها معاً
 * وتبقى المسافات بين النصّ وخلفيته كما ضبطها ديسكورد.
 */

export interface Hsl {
    h: number;
    s: number;
    l: number;
}

/* ── ألوان ───────────────────────────────────────────────────────────────── */

/** يقبل `#rgb` و`#rrggbb` وبلا `#`. يُرجع null لِما ليس لوناً. */
export function parseHex(input: string): string | null {
    const raw = input.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(raw)) {
        return raw.split("").map(c => c + c).join("").toLowerCase();
    }
    return /^[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : null;
}

export function hexToHsl(hex: string): Hsl {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const l = (max + min) / 2;

    let h = 0;
    let s = 0;
    if (delta !== 0) {
        s = delta / (1 - Math.abs(2 * l - 1));
        if (max === r) h = ((g - b) / delta) % 6;
        else if (max === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
        h *= 60;
        if (h < 0) h += 360;
    }

    return { h, s: s * 100, l: l * 100 };
}

/**
 * الإضاءة النسبية بمعيار WCAG — ليست إضاءة HSL.
 *
 * الفرق مهمّ: الأصفر والأزرق قد يتساويان في `l` من HSL بينما أحدهما يكاد
 * يعمي والآخر يكاد يُرى. وفحص التباين لا يصحّ إلّا بالنسبية.
 */
export function relativeLuminance(hex: string): number {
    const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    const r = channel(parseInt(hex.slice(0, 2), 16) / 255);
    const g = channel(parseInt(hex.slice(2, 4), 16) / 255);
    const b = channel(parseInt(hex.slice(4, 6), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export type ContrastVerdict = "fine" | "wrong-mode" | "unusable";

/**
 * هل هذا اللون صالحٌ للوضع الحالي؟
 *
 * والجواب ثلاثيّ لا ثنائيّ، لأن العلاج يختلف: لونٌ فاتح في وضعٍ داكن **يُصلَح
 * بتبديل الوضع**، أمّا لونٌ في المنتصف فلا يصلح لأيّ وضع — وقول «بدّل الوضع»
 * له نصيحةٌ لا تنفع.
 */
export function checkContrast(hex: string, isLight: boolean): ContrastVerdict {
    const lum = relativeLuminance(hex);
    if (isLight) {
        if (lum > 0.65) return "fine";
        return lum < 0.26 ? "wrong-mode" : "unusable";
    }
    if (lum < 0.12) return "fine";
    return lum > 0.26 ? "wrong-mode" : "unusable";
}

/* ── سلّم ديسكورد ────────────────────────────────────────────────────────── */

/**
 * `--neutral-N-hsl: 240 calc(var(--saturation-factor, 1)*5.882%) 13.333%;`
 *
 * الإضاءة هي **آخر نسبةٍ مئوية** في القيمة — والصيغة تحوي نِسَباً أخرى داخل
 * `calc`، فالتقاط أوّل `%` يلتقط التشبّع ويقلب اللوحة رأساً على عقب.
 */
const NEUTRAL_DECL = /--neutral-(\d{1,3})-hsl\s*:\s*([^;]+);/g;
const LAST_PERCENT = /([\d.]+)%\s*$/;

export type NeutralMap = Map<number, number>;

export function parseNeutrals(css: string): NeutralMap {
    const map: NeutralMap = new Map();
    for (const match of css.matchAll(NEUTRAL_DECL)) {
        const lightness = LAST_PERCENT.exec(match[2].trim());
        if (!lightness) continue;
        const index = Number(match[1]);
        // أوّل تعريفٍ يفوز: التالي منه تجاوزٌ لسياقٍ آخر (طباعة، تباين عالٍ).
        if (!map.has(index)) map.set(index, Number(lightness[1]));
    }
    return map;
}

/**
 * درجة الأساس التي تُقاس منها الفروق.
 *
 * `66` هي خلفية التطبيق في الوضع الداكن، و`2` في الفاتح — مقروءتان من
 * `--background-base-low` على عميل حيّ لا مُخمَّنتين. وإن غابت (تغيّر عند
 * ديسكورد) يسقط إلى قيمةٍ مرصودة بدل أن يُنتج لوحةً مقلوبة.
 */
const BASE_NEUTRAL = { dark: 66, light: 2 } as const;
const BASE_FALLBACK = { dark: 13.333, light: 98.431 } as const;

export const VAR_ID = {
    ramp: "esharq-tc-ramp",
    glass: "esharq-tc-glass",
    background: "esharq-tc-bg",
    text: "esharq-tc-text"
} as const;

/**
 * يبني إعلانات السلّم لوضعٍ واحد.
 *
 * التشبّع يُكتب `calc(var(--saturation-factor, 1) * S)` كما يكتبه ديسكورد،
 * كي يبقى مفتاح «تقليل الألوان» في إعدادات الوصول عاملاً على ثيمنا أيضاً —
 * تجاهله يُلغي إعداد وصولٍ اختاره صاحبه.
 */
function rampFor(neutrals: NeutralMap, mode: "dark" | "light"): string {
    const base = neutrals.get(BASE_NEUTRAL[mode]) ?? BASE_FALLBACK[mode];

    const lines: string[] = [];
    for (const [index, lightness] of [...neutrals.entries()].sort((a, b) => a[0] - b[0])) {
        const offset = lightness - base;
        const sign = offset >= 0 ? "+" : "-";
        lines.push(
            `    --neutral-${index}-hsl: var(--esharq-tc-h) `
            + "calc(var(--saturation-factor, 1) * var(--esharq-tc-s)) "
            + `calc(var(--esharq-tc-l) ${sign} ${Math.abs(offset).toFixed(3)}%);`
        );
    }
    return lines.join("\n");
}

/** CSS إعادة التلوين كاملاً — يصلح للحقن الحيّ وللتصدير ملفّاً. */
export function buildRampCss(neutrals: NeutralMap, hex: string): string {
    const { h, s, l } = hexToHsl(hex);
    return [
        ":root {",
        `    --esharq-tc-h: ${h.toFixed(2)};`,
        `    --esharq-tc-s: ${s.toFixed(2)}%;`,
        `    --esharq-tc-l: ${l.toFixed(2)}%;`,
        "}",
        "",
        `.theme-dark {\n${rampFor(neutrals, "dark")}\n}`,
        "",
        `.theme-light {\n${rampFor(neutrals, "light")}\n}`
    ].join("\n");
}

/* ── الأسطح ──────────────────────────────────────────────────────────────── */

/**
 * الأسطح التي **تُلوّن خلفيةً فعلاً**.
 *
 * 🔴 القائمة **مقيسة لا منقولة**: مُشيَت شجرة DOM على عميل حيّ، وأُخذ كل عنصر
 * يرسم خلفيةً غير شفّافة ومساحته تُعتدّ، ثم جُرّد صنفه من هاشه. فما هنا موجودٌ
 * ويُلوِّن، لا اسمٌ يبدو معقولاً.
 *
 * والأسطح التي بدت مرشّحةً وسقطت: `sidebar` و`membersWrap` و`app` و`baseLayer`
 * — كلّها **شفّافة أصلاً**، فإدراجها يعطي المستخدم مِقبضاً لا يفعل شيئاً.
 *
 * والمطابقة بالبادئة (`[class^="name_"]`) لأن ديسكورد يُلحق هاشاً متغيّراً
 * بكل صنف. وهي أضيق من `*=` التي تلتقط `chatContent` حين نقصد `chat`.
 */
export interface Surface {
    key: string;
    ar: string;
    en: string;
    /** أصناف ديسكورد التي تحمل الخلفية — كلّها بلا هاش. */
    classes: readonly string[];
}

export const SURFACES: readonly Surface[] = [
    { key: "appFrame", ar: "خلفية التطبيق", en: "App backdrop", classes: ["bg", "appMount"] },
    { key: "guilds", ar: "سكّة الخوادم", en: "Server rail", classes: ["guilds"] },
    { key: "chat", ar: "منطقة المحادثة", en: "Chat area", classes: ["chat", "chatContent"] },
    { key: "title", ar: "شريط القناة العلوي", en: "Channel header", classes: ["title"] },
    { key: "members", ar: "قائمة الأعضاء", en: "Member list", classes: ["members"] },
    { key: "panels", ar: "لوحة المستخدم", en: "User panel", classes: ["panels"] },
    { key: "settings", ar: "نافذة الإعدادات", en: "Settings window", classes: ["container", "content", "contentHeader"] }
];

export type SurfaceValues = Record<string, number>;

/**
 * زجاجٌ لسطحٍ واحد.
 *
 * الشفافية تُطبَّق على **الخلفية وحدها** لا على العنصر: `opacity` تُبهت النصّ
 * والأيقونات معه فتصير الواجهة غير مقروءة — وهو الخطأ الذي يقع فيه أكثر
 * الثيمات.
 *
 * ولا يكفي أن نكتب لوناً شفّافاً: يجب أن يبقى **لون ديسكورد نفسه** وتُنقَص
 * ألفاه، وإلّا فُرِض لونٌ مكتوبٌ بأرقام يكذب على من بدّل وضعه أو غيّر لونه.
 * ولون السطح لا يُعرَف إلّا وقت التشغيل، فيُمرَّر `resolve` ليقرأه من العنصر.
 */
export function buildGlassCss(values: SurfaceValues, panelBlur: number, resolve: (s: Surface) => string | null): string {
    const blocks: string[] = [];
    for (const surface of SURFACES) {
        const percent = Math.max(0, Math.min(100, values[surface.key] ?? 0));
        if (percent <= 0 && panelBlur <= 0) continue;

        const base = resolve(surface);
        const selector = surface.classes.map(c => `[class^="${c}_"], [class*=" ${c}_"]`).join(",\n");
        const lines: string[] = [];

        if (percent > 0 && base) {
            lines.push(`    background-color: ${withAlpha(base, 1 - percent / 100)} !important;`);
        }
        if (panelBlur > 0) {
            lines.push(`    backdrop-filter: blur(${panelBlur}px) saturate(140%) !important;`);
        }
        if (lines.length > 0) blocks.push(`${selector} {\n${lines.join("\n")}\n}`);
    }
    return blocks.join("\n\n");
}

/**
 * يُعيد اللون نفسه بألفا جديدة.
 *
 * ديسكورد يُرجع اليوم ألواناً بصيغة `oklab(...)` و`color-mix(...)` لا
 * `rgb(...)` — فالتفكيك بتعبيرٍ نمطيّ يفشل صامتاً. و`color-mix` مع `transparent`
 * تعمل على **أي** صيغة يفهمها المتصفّح، فهي الطريق الوحيد الذي لا يشترط
 * صيغةً بعينها.
 */
export function withAlpha(color: string, alpha: number): string {
    const pct = Math.max(0, Math.min(100, Math.round(alpha * 100)));
    return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

/* ── الخلفية ─────────────────────────────────────────────────────────────── */

export interface BackgroundOptions {
    dataUrl: string;
    fit: "cover" | "contain" | "tile" | "stretch";
    position: string;
    blur: number;
    dim: number;
}

const FIT_CSS: Record<BackgroundOptions["fit"], string> = {
    cover: "background-size: cover; background-repeat: no-repeat;",
    contain: "background-size: contain; background-repeat: no-repeat;",
    tile: "background-size: auto; background-repeat: repeat;",
    stretch: "background-size: 100% 100%; background-repeat: no-repeat;"
};

/**
 * تُرسَم الصورة على **طبقةٍ خلف التطبيق** (`::before` على `html`) لا على
 * `html` نفسه.
 *
 * السبب: التمويه والتعتيم يُطبَّقان بـ`filter`، و`filter` على العنصر يطال
 * **كل أبنائه** — فيُموِّه واجهة ديسكورد كلّها لا الصورة. وطبقةٌ منفصلة تحته
 * تأخذ الفلتر وحدها.
 *
 * ⚠️ ولا تُرى الصورة ما لم يُفرَّغ سطح التطبيق فوقها؛ ولذلك تشترط الواجهة
 * شفافيةً على «خلفية التطبيق» قبل أن تدع الصورة تُختار.
 */
export function buildBackgroundCss(bg: BackgroundOptions | null): string {
    if (bg == null) return "";

    const filters: string[] = [];
    if (bg.blur > 0) filters.push(`blur(${bg.blur}px)`);
    if (bg.dim > 0) filters.push(`brightness(${(1 - bg.dim / 100).toFixed(2)})`);

    return [
        "html::before {",
        '    content: "";',
        "    position: fixed;",
        "    inset: 0;",
        "    z-index: -1;",
        `    background-image: url("${bg.dataUrl}");`,
        `    background-position: ${bg.position};`,
        `    ${FIT_CSS[bg.fit]}`,
        filters.length > 0 ? `    filter: ${filters.join(" ")};` : "",
        // التمويه يسحب حوافّ الصورة إلى الداخل فيظهر إطارٌ شفّاف حولها.
        bg.blur > 0 ? `    transform: scale(${(1 + bg.blur / 120).toFixed(3)});` : "",
        "    pointer-events: none;",
        "}"
    ].filter(Boolean).join("\n");
}

/* ── ألوان النصّ ─────────────────────────────────────────────────────────── */

/**
 * تجاوزات النصّ.
 *
 * القائمة مقصورة على متغيّرات **موجودة فعلاً** في هذا البناء (قِيست: 44
 * متغيّر `--text-*`). ومتغيّرات الجيل القديم — `--header-primary`
 * و`--interactive-normal` — تُرجع فراغاً اليوم، فلا تُعرَض مقابض لها.
 */
export interface TextTarget {
    key: string;
    variable: string;
    ar: string;
    en: string;
}

export const TEXT_TARGETS: readonly TextTarget[] = [
    { key: "default", variable: "--text-default", ar: "النصّ الأساسي", en: "Primary text" },
    { key: "muted", variable: "--text-muted", ar: "النصّ الخافت", en: "Muted text" },
    { key: "link", variable: "--text-link", ar: "الروابط", en: "Links" },
    { key: "brand", variable: "--text-brand", ar: "لون العلامة", en: "Brand accent" }
];

export function buildTextCss(overrides: Record<string, string>): string {
    const lines = TEXT_TARGETS
        .filter(target => parseHex(overrides[target.key] ?? "") !== null)
        .map(target => `    ${target.variable}: #${parseHex(overrides[target.key])} !important;`);
    return lines.length > 0 ? `:root {\n${lines.join("\n")}\n}` : "";
}
