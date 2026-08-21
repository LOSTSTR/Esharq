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
    text: "esharq-tc-text",
    gradient: "esharq-tc-gradient",
    glow: "esharq-tc-glow",
    fonts: "esharq-tc-fonts"
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
    { key: "strong", variable: "--text-strong", ar: "العناوين", en: "Headings" },
    { key: "subtle", variable: "--text-subtle", ar: "النصّ الثانوي", en: "Secondary text" },
    { key: "muted", variable: "--text-muted", ar: "النصّ الخافت", en: "Muted text" },
    { key: "link", variable: "--text-link", ar: "الروابط", en: "Links" },
    { key: "brand", variable: "--text-brand", ar: "المؤشّرات", en: "Indicators" }
];

export function buildTextCss(overrides: Record<string, string>): string {
    const lines = TEXT_TARGETS
        .filter(target => parseHex(overrides[target.key] ?? "") !== null)
        .map(target => `    ${target.variable}: #${parseHex(overrides[target.key])} !important;`);
    return lines.length > 0 ? `:root {\n${lines.join("\n")}\n}` : "";
}

/* ── التدرّج والتوهّج ────────────────────────────────────────────────────── */

/**
 * أهداف التدرّج والتوهّج.
 *
 * 🔴 ستّة **مقيسة**، لا تسعة عشر منقولة عن لقطة. لكل هدفٍ هنا محدّدٌ جُرّب على
 * عميل حيّ وعُدَّت مطابقاته: `username_` (54) · `markup_` (18) · `name_` (78) ·
 * `title_` (6) · `anchor_` (25) · `timestamp_` (18).
 *
 * وما لم يُقَس لم يُدرَج. مِقبضٌ باسمٍ جميل لا يُطابق شيئاً أسوأ من غيابه:
 * صاحبه يظنّ أنه لوّن شيئاً، ثم يبحث عن العطل في مكانٍ آخر.
 */
export interface PaintTarget {
    key: string;
    ar: string;
    en: string;
    selector: string;
}

export const PAINT_TARGETS: readonly PaintTarget[] = [
    { key: "usernames", ar: "أسماء المستخدمين", en: "Display names", selector: '[class^="username_"], [class*=" username_"]' },
    { key: "messages", ar: "نصّ الرسائل", en: "Message text", selector: '[class^="markup_"], [class*=" markup_"]' },
    { key: "channels", ar: "أسماء القنوات", en: "Channel names", selector: '[class^="name_"], [class*=" name_"]' },
    { key: "headings", ar: "العناوين", en: "Headings", selector: 'h1, h2, h3, [class^="title_"], [class*=" title_"]' },
    { key: "links", ar: "الروابط", en: "Links", selector: '[class^="anchor_"], [class*=" anchor_"]' },
    { key: "timestamps", ar: "الأوقات", en: "Timestamps", selector: '[class^="timestamp_"], [class*=" timestamp_"]' }
];

export type Direction = "to right" | "to left" | "to bottom" | "135deg" | "45deg";

export const DIRECTIONS: readonly { key: Direction; ar: string; en: string; }[] = [
    { key: "to right", ar: "أفقي", en: "Horizontal" },
    { key: "to left", ar: "أفقي معكوس", en: "Reversed" },
    { key: "to bottom", ar: "رأسي", en: "Vertical" },
    { key: "135deg", ar: "مائل نازل", en: "Diagonal down" },
    { key: "45deg", ar: "مائل صاعد", en: "Diagonal up" }
];

export interface GradientOptions {
    enabled: boolean;
    targets: string[];
    start: string;
    end: string;
    direction: Direction;
    motion: boolean;
    speed: number;
    fps: number;
}

export interface GlowOptions {
    enabled: boolean;
    targets: string[];
    color: string;
    strength: number;
    blur: number;
    motion: boolean;
    speed: number;
    fps: number;
}

const ANIM_GRADIENT = "esharq-tc-gradient-shift";
const ANIM_GLOW = "esharq-tc-glow-pulse";

/**
 * سقفُ الإطارات يُنفَّذ بـ`steps()`.
 *
 * وهذا ليس حيلة: `steps(n)` تُقسّم الحركة إلى n قفزة على مدى الدورة، فتصير
 * التحديثات المرئية `n ÷ المدّة` في الثانية بالضبط. فمن اختار 24 إطاراً حصل
 * على 24 لا على ستّين تُرسَم ثم تُهدَر.
 */
function timing(fps: number, seconds: number): string {
    const frames = Math.max(1, Math.round(fps * seconds));
    return `steps(${frames}, end)`;
}

function selectorsFor(targets: string[]): string {
    return PAINT_TARGETS
        .filter(target => targets.includes(target.key))
        .map(target => target.selector)
        .join(",\n");
}

/**
 * تدرّجٌ على النصّ.
 *
 * `background-clip: text` مع `text-fill-color: transparent` هو الطريق الوحيد
 * لتلوين الحروف بتدرّج. و`color: transparent` مكتوبةٌ معها للمتصفّحات التي لا
 * تعرف البادئة — بدونها يظهر النصّ بلونه الأصلي فوق التدرّج فيختفي التأثير.
 *
 * ⚠️ والحركة تُلغى لمن طلب تقليلها: `prefers-reduced-motion` ليس ذوقاً، بل
 * إعدادُ وصولٍ تُسبّب مخالفتُه دواراً حقيقياً لبعض الناس.
 */
export function buildGradientCss(options: GradientOptions): string {
    if (!options.enabled || options.targets.length === 0) return "";

    const start = parseHex(options.start);
    const end = parseHex(options.end);
    if (start === null || end === null) return "";

    const selector = selectorsFor(options.targets);
    if (selector === "") return "";

    const lines = [
        `    background-image: linear-gradient(${options.direction}, #${start}, #${end}) !important;`,
        "    -webkit-background-clip: text !important;",
        "    background-clip: text !important;",
        "    -webkit-text-fill-color: transparent !important;",
        "    color: transparent !important;"
    ];

    if (options.motion) {
        lines.push("    background-size: 250% 250% !important;");
        lines.push(`    animation: ${ANIM_GRADIENT} ${options.speed}s ${timing(options.fps, options.speed)} infinite !important;`);
    }

    const blocks = [`${selector} {\n${lines.join("\n")}\n}`];

    if (options.motion) {
        blocks.push(
            `@keyframes ${ANIM_GRADIENT} {\n`
            + "    0% { background-position: 0% 50%; }\n"
            + "    50% { background-position: 100% 50%; }\n"
            + "    100% { background-position: 0% 50%; }\n}"
        );
        blocks.push(
            "@media (prefers-reduced-motion: reduce) {\n"
            + selector + " {\n        animation: none !important;\n    }\n}"
        );
    }

    return blocks.join("\n\n");
}

/**
 * توهّجٌ حول الحروف.
 *
 * `text-shadow` مكرّرةً ثلاثاً بأنصاف أقطار متزايدة: ظلٌّ واحد يُنتج هالةً
 * مسطّحة، والثلاثة تُعطي تدرّجاً يُشبه الضوء. والقوّة تضبط الشفافية لا الحجم،
 * كي لا يزحف التوهّج على الحرف المجاور فيلتصق النصّ.
 */
export function buildGlowCss(options: GlowOptions): string {
    if (!options.enabled || options.targets.length === 0) return "";

    const color = parseHex(options.color);
    if (color === null) return "";

    const selector = selectorsFor(options.targets);
    if (selector === "") return "";

    const alpha = Math.max(0, Math.min(100, options.strength)) / 100;
    const shadow = [
        `0 0 ${options.blur}px ${withAlpha("#" + color, alpha)}`,
        `0 0 ${options.blur * 2}px ${withAlpha("#" + color, alpha * 0.6)}`,
        `0 0 ${Math.round(options.blur * 3.5)}px ${withAlpha("#" + color, alpha * 0.3)}`
    ].join(", ");

    const lines = [`    text-shadow: ${shadow} !important;`];
    if (options.motion) {
        lines.push(`    animation: ${ANIM_GLOW} ${options.speed}s ${timing(options.fps, options.speed)} infinite !important;`);
    }

    const blocks = [`${selector} {\n${lines.join("\n")}\n}`];

    if (options.motion) {
        blocks.push(
            `@keyframes ${ANIM_GLOW} {\n`
            + "    0%, 100% { opacity: 1; }\n"
            + "    50% { opacity: 0.72; }\n}"
        );
        blocks.push(
            "@media (prefers-reduced-motion: reduce) {\n"
            + selector + " {\n        animation: none !important;\n    }\n}"
        );
    }

    return blocks.join("\n\n");
}

/* ── الطباعة ─────────────────────────────────────────────────────────────── */

/**
 * خطوطٌ من النظام وحده — **لا تُنزَّل أبداً**.
 *
 * 🔴 `queryLocalFonts()` موجودةٌ في هذا البناء لكنها تُرجع **صفر خطّاً** (الإذن
 * غير ممنوح)، فتعداد خطوط الجهاز غير ممكن. والقائمة هنا خطوطٌ تُشحن مع ويندوز،
 * **كلٌّ منها يُتحقَّق من وجوده** بـ`document.fonts.check` قبل أن يُعرَض — فلا
 * يختار أحدٌ خطّاً لا يملكه ثم يرى الافتراضي ولا يفهم لماذا.
 *
 * ولا يمسّ هذا الخطَّ العربي: ذاك في صفحة «اللغة»، ويبقى أوّلَ السلسلة هنا
 * لأنه يعرف المحارف العربية وحدها فلا يُغيّر اللاتيني.
 */
export const INTERFACE_FONTS: readonly string[] = [
    "Segoe UI", "Segoe UI Variable Text", "Calibri", "Tahoma", "Verdana",
    "Arial", "Georgia", "Times New Roman", "Trebuchet MS"
];

export const MONO_FONTS: readonly string[] = [
    "Consolas", "Cascadia Code", "Cascadia Mono", "Courier New", "Lucida Console"
];

/** أيّ هذه الخطوط موجودٌ فعلاً على هذا الجهاز؟ */
export function availableFonts(candidates: readonly string[]): string[] {
    try {
        return candidates.filter(family => document.fonts.check(`12px "${family}"`));
    } catch {
        return [];
    }
}

export function buildFontCss(interfaceFont: string, monoFont: string): string {
    const lines: string[] = [];
    if (interfaceFont !== "") {
        lines.push(`    --font-primary: "${interfaceFont}", sans-serif;`);
        lines.push(`    --font-display: "${interfaceFont}", sans-serif;`);
    }
    if (monoFont !== "") lines.push(`    --font-code: "${monoFont}", monospace;`);
    return lines.length > 0 ? `:root {\n${lines.join("\n")}\n}` : "";
}

/* ── معاينة ─────────────────────────────────────────────────────────────── */

export interface Palette {
    app: string;
    sidebar: string;
    raised: string;
    text: string;
    muted: string;
    accent: string;
}

/**
 * ألوانٌ فعليّة لثيمٍ لم يُثبَّت بعد.
 *
 * تُحسَب **بنفس رياضيات التطبيق**: فرقُ إضاءة الدرجة عن الأساس يُضاف إلى إضاءة
 * اللون المختار. فالمعاينة ليست تخميناً ولا لقطةً قديمة — هي اللون الذي سيظهر.
 *
 * والدرجات المستعمَلة مقروءةٌ من مصدر ديسكورد لا مُخمَّنة: `69` خلفية التطبيق،
 * و`66` الأسطح، و`64` المرتفعة، و`4` النصّ، و`23` الخافت.
 */
export function previewPalette(neutrals: NeutralMap, hex: string): Palette {
    const { h, s, l } = hexToHsl(hex);
    const base = neutrals.get(66) ?? 13.333;

    const step = (index: number, fallback: number) => {
        const lightness = neutrals.get(index) ?? fallback;
        const value = Math.max(0, Math.min(100, l + (lightness - base)));
        return `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${value.toFixed(1)}%)`;
    };

    return {
        app: step(69, 10.98),
        sidebar: step(66, 13.333),
        raised: step(64, 15.098),
        text: step(4, 95.49),
        muted: step(23, 60.392),
        accent: `#${hex}`
    };
}
