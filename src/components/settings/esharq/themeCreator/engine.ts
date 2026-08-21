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
 * الأسطح التي **تُلوّن خلفيةً فعلاً**، مجموعةً كما يراها المستخدم.
 *
 * 🔴 القائمة **مقيسة عنصراً عنصراً**، لا منقولةً عن لقطة.
 *
 * والطريقة: يُؤخذ بكسلٌ من داخل كل سطح، وتُسأل الصفحة عن كل العناصر تحته من
 * الأعلى إلى الأسفل، ويُؤخذ أوّل ما يرسم خلفيةً. وهذا تعريف السطح بالضبط: ما
 * يُلوّن ذلك الموضع من الشاشة.
 *
 * ⚠️ وثلاث محاولاتٍ سبقت هذه وأخطأت، ولكلٍّ درسها:
 *
 *  ① البحث بالاسم (`[class^="members_"]`) أصاب **أوّل عنصرٍ في ترتيب المستند**
 *    فردّ `guildInviteContainer` مكان قائمة الأعضاء. الاسم ليس هويّة.
 *  ② نافذة الإعدادات بقيت مفتوحةً فغطّت التطبيق، فردّت خمسةُ أسطح `modal`
 *    و`scrim` ولم يشتكِ شيء. القياس فوق طبقةٍ حاجبة يكذب بثقة.
 *  ③ `KeyboardEvent` المُصطنَع لا يُغلق تلك النافذة: ديسكورد يسمع الهروب على
 *    مستوى المتصفّح. فلزم إرسال ضغطةٍ حقيقية عبر CDP.
 *
 * وما لم يُقَس **لم يُدرَج**: «تنقّل الإعدادات» و«شريط الردّ» سطحان في المرجع،
 * وقياسُهما هنا وجدهما **شفّافَين** يُلوّنهما أبوهما — فمِقبضٌ لهما يَعِد بما
 * لا يفعله.
 */
export interface Surface {
    key: string;
    ar: string;
    en: string;
    /** المجموعة التي يظهر تحتها في الواجهة. */
    group: "layout" | "components" | "profiles" | "settings";
    ar_hint: string;
    en_hint: string;
    /** محدّدات مُتحقَّقٌ من مطابقتها لعنصرٍ يرسم خلفيةً. */
    selectors: readonly string[];
    /**
     * درجة السلّم التي يرسم بها ديسكورد هذا السطح.
     *
     * 🔴 مقروءةٌ من لونه المحسوب لا مُخمَّنة: قِيست إضاءةُ كل سطح حيّاً
     * (`oklab(0.183…)` ⇦ 10.98% ⇦ الدرجة 69 · `0.2195` ⇦ 13.333% ⇦ 66 ·
     * `0.2452` ⇦ 15.098% ⇦ 64).
     */
    neutral: number;
}

/** `name_HASH` — بادئةً أو وسط قائمة الأصناف. */
const cls = (name: string) => [`[class^="${name}_"]`, `[class*=" ${name}_"]`];

export const SURFACES: readonly Surface[] = [
    // ── تخطيط التطبيق ───────────────────────────────────────────────────────
    {
        key: "appFrame", ar: "خلفية التطبيق", en: "App backdrop", group: "layout",
        ar_hint: "الأرضية خلف كل شيء — شفّفها لتظهر صورتك.", en_hint: "The ground behind everything — make it clear to reveal your image.",
        // 🔴 «الشريط العلوي» كان هنا فحُذف: قِيس فوجِد **شفّافاً** فوق هذه
        // الأرضية، و`bar_` طابق **23 عنصراً** (أشرطة تقدّم وغيرها) — فكان
        // مِقبضاً يُشفّف ما لم يُقصَد.
        selectors: [...cls("bg"), ...cls("appMount")],
        neutral: 69
    },
    {
        key: "serverRail", ar: "سكّة الخوادم", en: "Server rail", group: "layout",
        ar_hint: "أيقونات الخوادم والمجلدات.", en_hint: "Server icons and folders.",
        selectors: cls("guilds"),
        neutral: 69
    },
    {
        key: "channelNav", ar: "قائمة القنوات والرسائل", en: "Channel & DM navigation", group: "layout",
        ar_hint: "القنوات والرسائل الخاصّة.", en_hint: "Channels and direct messages.",
        // 🔴 `container` صنفٌ عامّ يتكرّر (نافذة الإعدادات تستعمله أيضاً)،
        // فيُقصَر على ما داخل الشريط الجانبيّ وحده.
        selectors: ['[class^="sidebar_"] [class^="container_"]', '[class*=" sidebar_"] [class^="container_"]'],
        neutral: 66
    },
    {
        key: "channelHeader", ar: "شريط القناة العلوي", en: "Channel header", group: "layout",
        ar_hint: "اسم القناة وأدواتها.", en_hint: "The channel name and its tools.",
        selectors: cls("title"),
        neutral: 66
    },
    {
        key: "mainContent", ar: "منطقة المحادثة", en: "Main content", group: "layout",
        ar_hint: "الرسائل والصفحات الرئيسية.", en_hint: "Messages and the primary pages.",
        selectors: [...cls("chat"), ...cls("chatContent")],
        neutral: 69
    },
    {
        key: "memberList", ar: "قائمة الأعضاء", en: "Member list", group: "layout",
        ar_hint: "الأعضاء ونتائج البحث.", en_hint: "Members and search results.",
        selectors: cls("members"),
        neutral: 66
    },
    {
        key: "composer", ar: "صندوق الكتابة", en: "Message composer", group: "layout",
        ar_hint: "مربّع الرسالة ومرفقاته.", en_hint: "The message box and its attachments.",
        selectors: [...cls("scrollableContainer"), ...cls("channelTextArea")],
        neutral: 64
    },

    // ── مكوّنات ─────────────────────────────────────────────────────────────
    {
        key: "userPanel", ar: "لوحة المستخدم", en: "User panel", group: "components",
        ar_hint: "حسابك وأدوات الصوت أسفل الشريط.", en_hint: "Your account and voice controls.",
        selectors: cls("panels"),
        neutral: 64
    },
    {
        key: "inputs", ar: "المدخلات والبحث", en: "Inputs & search", group: "components",
        ar_hint: "صناديق البحث والحقول.", en_hint: "Search boxes and text fields.",
        selectors: cls("searchBar"),
        neutral: 64
    },
    {
        key: "menus", ar: "القوائم والنوافذ المنبثقة", en: "Menus & popouts", group: "components",
        ar_hint: "قوائم السياق والمنسدلات.", en_hint: "Context menus and dropdowns.",
        selectors: cls("menu"),
        neutral: 64
    },
    {
        key: "cards", ar: "البطاقات", en: "Cards & tiles", group: "components",
        ar_hint: "بطاقات النشاط والمحتوى.", en_hint: "Activity and content cards.",
        selectors: cls("card"),
        neutral: 62
    },

    // ── الملفّات ────────────────────────────────────────────────────────────
    {
        key: "profileBanner", ar: "ترويسة الملفّ", en: "Profile header", group: "profiles",
        ar_hint: "لافتة الملفّ الشخصيّ.", en_hint: "The profile banner.",
        selectors: cls("banner"),
        neutral: 66
    },

    // ── الإعدادات ───────────────────────────────────────────────────────────
    {
        key: "settingsFrame", ar: "إطار الإعدادات", en: "Settings frame", group: "settings",
        ar_hint: "النافذة الخارجية للإعدادات.", en_hint: "The outer settings window.",
        // 🔴 `[class*="layer_"] [class^="container_"]` طابق **77 عنصراً** حين قِيس:
        // أوسع من أن يُستعمل، كان سيُشفّف نصف ما في النافذة. فاقتُصر على النافذة نفسها.
        selectors: ['[class^="modal_"]', '[class*=" modal_"]'],
        neutral: 66
    },
    {
        key: "settingsContent", ar: "محتوى الإعدادات", en: "Settings content", group: "settings",
        ar_hint: "الصفحة داخل الإعدادات.", en_hint: "The page inside settings.",
        // `content_` وحده طابق **28 عنصراً**؛ يُقصَر على ما داخل نافذة الإعدادات.
        selectors: ['[class*="modal_"] [class^="content_"]', '[class*="modal_"] [class*=" content_"]'],
        neutral: 64
    },
    {
        key: "settingsCards", ar: "بطاقات إشراق", en: "Esharq cards", group: "settings",
        ar_hint: "بطاقات صفحات إشراق نفسها.", en_hint: "The cards on Esharq's own pages.",
        selectors: [".esharq-rise"],
        neutral: 62
    }
];

export const SURFACE_GROUPS: readonly { key: Surface["group"]; ar: string; en: string; ar_hint: string; en_hint: string; }[] = [
    { key: "layout", ar: "تخطيط التطبيق", en: "App layout", ar_hint: "أعمدة ديسكورد الرئيسية.", en_hint: "Discord's main columns." },
    { key: "components", ar: "مكوّنات", en: "Components", ar_hint: "أسطحٌ أصغر تعلو التخطيط.", en_hint: "Smaller surfaces above the layout." },
    { key: "profiles", ar: "الملفّات", en: "Profiles", ar_hint: "لوحات الملفّ الشخصيّ.", en_hint: "Profile panels." },
    { key: "settings", ar: "الإعدادات", en: "Settings", ar_hint: "نافذة الإعدادات وصفحاتها.", en_hint: "The settings window and its pages." }
];

export type SurfaceValues = Record<string, number>;

/**
 * زجاجٌ للأسطح المضبوطة.
 *
 * الشفافية تُطبَّق على **الخلفية وحدها** لا على العنصر: `opacity` تُبهت النصّ
 * والأيقونات معه فتصير الواجهة غير مقروءة — وهو خطأ أكثر الثيمات.
 *
 * ## 🔴 ولماذا لا يُقرأ لون العنصر
 *
 * أوّل نسخةٍ قرأت لون السطح من العنصر نفسه، وسقطت مرّتين وقد قِيس السقوطان:
 *
 *  ① **تراكم**: القراءة تجري وزجاجُنا مُطبَّق، فتقرأ مُخرَجاتنا لا لون
 *    ديسكورد — 45٪ صارت 33.75٪ في التطبيق الثاني، وتذوب أكثر مع كل تحريك.
 *  ② **اختفاءٌ صامت**: من يضبط الزجاج وهو **داخل نافذة الإعدادات** لا يكون
 *    نصفُ أسطح التطبيق مرسوماً أصلاً، فتُرجع القراءة `null` وتُحذَف قواعدها
 *    بلا رسالة. قِيس حيّاً: **سبعُ قواعد خرجت من خمس عشرة**.
 *
 * ⇒ اللون يُؤخذ من **درجة السلّم** التي يستعملها ديسكورد لذلك السطح: ثابتةٌ،
 * ولا تشترط وجود العنصر، وتتبع لونَ ثيمك تلقائياً لأن السلّم نفسه أُعيد
 * تعريفه. والنتيجة واحدة في العرض الحيّ وفي الملفّ المُصدَّر.
 */
export function buildGlassCss(values: SurfaceValues, panelBlur: number): string {
    const blocks: string[] = [];
    for (const surface of SURFACES) {
        const percent = Math.max(0, Math.min(100, values[surface.key] ?? 0));
        if (percent <= 0 && panelBlur <= 0) continue;

        const base = `hsl(var(--neutral-${surface.neutral}-hsl))`;
        const selector = surface.selectors.join(",\n");
        const lines: string[] = [];

        if (percent > 0) lines.push(`    background-color: ${withAlpha(base, 1 - percent / 100)} !important;`);
        if (panelBlur > 0) lines.push(`    backdrop-filter: blur(${panelBlur}px) saturate(140%) !important;`);
        if (lines.length > 0) blocks.push(`${selector} {\n${lines.join("\n")}\n}`);
    }
    return blocks.join("\n\n");
}

/**
 * زجاجٌ لسطحٍ واحد.
 *
 * الشفافية تُطبَّق على **الخلفية وحدها** لا على العنصر: `opacity` تُبهت النصّ
 * والأيقونات معه فتصير الواجهة غير مقروءة — وهو خطأ أكثر الثيمات.
 *
 * ## 🔴 ولماذا لا يُقرأ لون العنصر
 *
 * أوّل نسخةٍ قرأت لون السطح من العنصر نفسه، وسقطت مرّتين:
 *
 *  ① **تراكم**: القراءة تجري وزجاجُنا مُطبَّق، فتقرأ مُخرَجاتنا لا لون ديسكورد
 *    — 45٪ صارت 33.75٪ في التطبيق الثاني وتذوب أكثر مع كل تحريك.
 *  ② **اختفاءٌ صامت**: من يضبط الزجاج وهو **داخل نافذة الإعدادات** لا يكون
 *    نصف أسطح التطبيق مرسوماً أصلاً، فتُرجع القراءة `null` وتُحذَف قواعدها
 *    بلا رسالة. قِيس: سبعُ قواعد خرجت من خمس عشرة.
 *
 * ⇒ اللون يُؤخذ من **درجة السلّم** التي يستعملها ديسكورد لذلك السطح. ثابتةٌ،
 * ولا تحتاج العنصر موجوداً، وتتبع لونَ ثيمك تلقائياً لأن السلّم نفسه أُعيد
 * تعريفه. والنتيجة واحدة في العرض الحيّ وفي الملفّ المُصدَّر.
 */
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
 * 🔴 **كلٌّ منها عُدَّت مطابقاته على عميل حيّ** في حالتَي المحادثة والإعدادات.
 * والأرقام في التعليق هي ما قِيس فعلاً، لا تقديرٌ.
 *
 * وثلاثةٌ كانت في القائمة فحُذفت لأنها طابقت **صفراً**: أسماء الأعضاء الملوّنة
 * (`roleColor_`) — لا وجود لها في هذا البناء؛ وعناصر القوائم (`[role=menuitem]`)
 * — لا تُوجد إلّا وقائمةٌ مفتوحة فلا يصحّ عرضها مِقبضاً دائماً؛ و«الحالات
 * الفارغة» — لا صنف لها.
 *
 * ومِقبضٌ لا يُطابق شيئاً أسوأ من غيابه: صاحبه يظنّ أنه لوّن شيئاً، ثم يبحث
 * عن العطل في مكانٍ آخر.
 */
export interface PaintTarget {
    key: string;
    ar: string;
    en: string;
    ar_hint: string;
    en_hint: string;
    selector: string;
}

export const PAINT_TARGETS: readonly PaintTarget[] = [
    { key: "usernames", ar: "أسماء المستخدمين", en: "Display names", ar_hint: "في الرسائل والأعضاء والصوت.", en_hint: "In messages, members and voice.", selector: '[class^="username_"], [class*=" username_"]' }, // 46
    { key: "messages", ar: "نصّ الرسائل", en: "Message text", ar_hint: "متن الرسائل ومحتواها.", en_hint: "Message bodies and content.", selector: '[class^="markup_"], [class*=" markup_"]' }, // 5
    { key: "chatDetails", ar: "تفاصيل المحادثة", en: "Chat details", ar_hint: "الأوقات والفواصل.", en_hint: "Timestamps and dividers.", selector: '[class^="timestamp_"], [class*=" timestamp_"]' }, // 4
    { key: "channels", ar: "أسماء القنوات", en: "Channel names", ar_hint: "القنوات والرسائل والخوادم.", en_hint: "Channels, DMs and servers.", selector: '[class^="name_"], [class*=" name_"]' }, // 82
    { key: "headings", ar: "العناوين", en: "Headings", ar_hint: "عناوين الصفحات والأقسام.", en_hint: "Page and section headings.", selector: 'h1, h2, h3, [class^="title_"], [class*=" title_"]' }, // 38
    { key: "links", ar: "الروابط", en: "Links", ar_hint: "الروابط في المحادثات والملفّات.", en_hint: "Links in chats and profiles.", selector: '[class^="anchor_"], [class*=" anchor_"]' }, // 5
    { key: "buttons", ar: "الأزرار", en: "Buttons and controls", ar_hint: "الأزرار والمفاتيح والحقول.", en_hint: "Buttons, switches and inputs.", selector: '[class^="button_"], [class*=" button_"]' }, // 41
    { key: "inputText", ar: "نصّ المدخلات", en: "Input text", ar_hint: "صناديق الكتابة والبحث.", en_hint: "Message boxes and search fields.", selector: '[class^="textArea_"], [class*=" textArea_"], [class^="input_"], [class*=" input_"]' }, // 3
    { key: "navigation", ar: "التنقّل", en: "Navigation", ar_hint: "عناصر الشريط الجانبي والإعدادات.", en_hint: "Sidebar and settings items.", selector: '[class^="item_"], [class*=" item_"]' }, // 119
    { key: "icons", ar: "الأيقونات", en: "Interface icons", ar_hint: "أيقونات التنقّل وأشرطة الأدوات.", en_hint: "Navigation and toolbar icons.", selector: 'svg[class*="icon"], [class^="icon_"], [class*=" icon_"]' }, // 158
    { key: "badges", ar: "الشارات", en: "Badges", ar_hint: "الشارات والوسوم الصغيرة.", en_hint: "Badges and small tags.", selector: '[class^="badge_"], [class*=" badge_"]' }, // 18
    { key: "activityCards", ar: "بطاقات النشاط", en: "Activity cards", ar_hint: "الألعاب والقنوات والنشاط.", en_hint: "Games, channels and activity.", selector: '[class^="card_"], [class*=" card_"]' }, // 2
    { key: "userArea", ar: "منطقة المستخدم", en: "User area", ar_hint: "اسمك وحالتك أسفل الشريط.", en_hint: "Your name and status at the bottom.", selector: '[class^="panels_"] [class^="nameTag"], [class*=" panels_"] [class*=" nameTag"]' }, // 1
    { key: "profileText", ar: "نصّ الملفّ", en: "Profile text", ar_hint: "الأسماء والنبذة والبيانات.", en_hint: "Names, bios and metadata.", selector: '[class*="userProfile"] [class*="text"]' }, // 17
    { key: "modals", ar: "النوافذ", en: "Modals and popouts", ar_hint: "عناوين النوافذ ونصوصها.", en_hint: "Dialog titles and descriptions.", selector: '[class^="modal_"], [class*=" modal_"], [role="dialog"]' }, // 3
    { key: "indicators", ar: "المؤشّرات", en: "Indicators", ar_hint: "علامات غير المقروء والإشارات.", en_hint: "Unread markers and mentions.", selector: '[class^="numberBadge"], [class*=" numberBadge"], [class^="mention_"], [class*=" mention_"]' }, // 7
    { key: "sidebarDetails", ar: "تفاصيل الشريط", en: "Sidebar details", ar_hint: "النشاط والوصف تحت الأسماء.", en_hint: "Activity and subtext under names.", selector: '[class^="subtext"], [class*=" subtext"], [class^="activity_"], [class*=" activity_"]' } // 1
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
