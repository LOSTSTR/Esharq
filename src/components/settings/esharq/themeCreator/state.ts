/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * **حالة منشئ الثيمات وتطبيقها على المستند.**
 *
 * الفصل مقصود: `engine.ts` يحوّل قيماً إلى نصّ CSS ولا يعرف شيئاً عن المستند
 * ولا عن الإعدادات، وهذا الملفّ يحمل الحالة ويلمس `document`. فالمحرّك يُختبَر
 * بلا متصفّح، وهذا الملفّ هو الوحيد الذي يُغيّر ما تراه العين.
 */

import { PlainSettings, Settings } from "@api/Settings";

import {
    BackgroundOptions,
    buildBackgroundCss,
    buildFontCss,
    buildGlassCss,
    buildGlowCss,
    buildGradientCss,
    buildRampCss,
    buildTextCss,
    GlowOptions,
    GradientOptions,
    NeutralMap,
    parseHex,
    parseNeutrals,
    SURFACES,
    SurfaceValues,
    VAR_ID
} from "./engine";

export interface ThemeCreatorState {
    enabled: boolean;
    /** بلا `#`. */
    color: string;
    /**
     * الوضع الزجاجي مفتاحٌ واحد فوق كل المقابض.
     *
     * 🔴 بلا هذا المفتاح، من ضبط سبعة مقابض ثم أراد رؤية شكله بدونها اضطرّ
     * إلى تصفيرها كلّها — ثم إعادة ضبطها واحداً واحداً ليعود. والمفتاح يُطفئ
     * ويُعيد **بلا فقد قيمة**.
     */
    glass: boolean;
    surfaces: SurfaceValues;
    panelBlur: number;
    background: {
        enabled: boolean;
        fit: BackgroundOptions["fit"];
        position: string;
        blur: number;
        dim: number;
    };
    text: Record<string, string>;
    gradient: GradientOptions;
    glow: GlowOptions;
    fonts: { interface: string; mono: string; };
}

export const DEFAULT_STATE: ThemeCreatorState = {
    enabled: false,
    color: "1e1f22",
    glass: false,
    surfaces: {},
    panelBlur: 0,
    background: { enabled: false, fit: "cover", position: "center", blur: 0, dim: 25 },
    text: {},
    gradient: {
        enabled: false,
        targets: ["usernames"],
        start: "22c9f0",
        end: "5fd9f8",
        direction: "to right",
        motion: false,
        speed: 8,
        fps: 30
    },
    glow: {
        enabled: false,
        targets: ["usernames"],
        color: "22c9f0",
        strength: 55,
        blur: 12,
        motion: false,
        speed: 8,
        fps: 30
    },
    fonts: { interface: "", mono: "" }
};

/** ألوانٌ صالحة للوضع الداكن — كلّها تحت عتبة التباين، فلا تُنتج تحذيراً. */
export const PRESETS: readonly string[] = [
    "1e1f22", "13171b", "1c1c28", "172019", "1e1514",
    "402d2d", "3a483d", "344242", "313d4b", "2d2f47",
    "322b42", "3c2e42", "422938", "1a1a1a", "0d1117"
];

const KEY = "themeCreator";

/**
 * 🔴 تُقرأ من `PlainSettings` لا من الوكيل.
 *
 * قراءة الوكيل داخل مكوّن React تُسجّل اشتراكاً يُعيد الرسم عند كل كتابة،
 * ونحن نكتب عند كل تحريك مِقبض — فتصير الصفحة تُعيد بناء نفسها ستّين مرّة في
 * الثانية أثناء السحب. والوكيل يُستعمل للكتابة وحدها.
 */
export function readState(): ThemeCreatorState {
    const raw = (PlainSettings as any)?.[KEY];
    if (raw == null || typeof raw !== "object") return { ...DEFAULT_STATE };
    return {
        ...DEFAULT_STATE,
        ...raw,
        surfaces: { ...(raw.surfaces ?? {}) },
        background: { ...DEFAULT_STATE.background, ...(raw.background ?? {}) },
        text: { ...(raw.text ?? {}) },
        gradient: { ...DEFAULT_STATE.gradient, ...(raw.gradient ?? {}) },
        glow: { ...DEFAULT_STATE.glow, ...(raw.glow ?? {}) },
        fonts: { ...DEFAULT_STATE.fonts, ...(raw.fonts ?? {}) }
    };
}

export function writeState(state: ThemeCreatorState): void {
    (Settings as any)[KEY] = state;
}

/* ── حقن الأنماط ─────────────────────────────────────────────────────────── */

function styleTag(id: string): HTMLStyleElement {
    let el = document.getElementById(id) as HTMLStyleElement | null;
    if (el == null) {
        el = document.createElement("style");
        el.id = id;
        // في نهاية الرأس: بعد أوراق ديسكورد فتفوز عند تساوي الخصوصية، وقبل
        // أي ثيم يضيفه المستخدم فيبقى الثيم قادراً على تجاوزنا.
        document.head.appendChild(el);
    }
    return el;
}

function setStyle(id: string, css: string): void {
    if (css === "") {
        document.getElementById(id)?.remove();
        return;
    }
    styleTag(id).textContent = css;
}

/* ── سلّم ديسكورد ────────────────────────────────────────────────────────── */

let neutralCache: NeutralMap | null = null;

/**
 * يقرأ سلّم ديسكورد من أوراق أنماطه.
 *
 * ⚠️ يُقرأ من **نصّ الورقة** لا من الأنماط المحسوبة: المحسوب يُرجع القيمة
 * بعد حلّ `var()`، فلا يبقى فيه اسم الدرجة الذي نحتاج إعادة تعريفه. ويُخزَّن
 * مرّةً واحدة — السلّم ثابتٌ ما دام ديسكورد لم يُحدَّث، وإعادة جلب أربعة
 * ميغابايت مع كل تحريك مِقبض عبثٌ محسوس.
 */
export async function loadNeutrals(): Promise<NeutralMap> {
    if (neutralCache != null && neutralCache.size > 0) return neutralCache;

    const links = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
        .map(n => n.href)
        .filter(Boolean);

    const texts = await Promise.all(links.map(async href => {
        try { return await (await fetch(href)).text(); } catch { return ""; }
    }));

    neutralCache = parseNeutrals(texts.join("\n"));
    return neutralCache;
}

export interface ApplyInput {
    state: ThemeCreatorState;
    neutrals: NeutralMap;
    backgroundDataUrl: string | null;
}

/**
 * يُطبّق الحالة على المستند.
 *
 * أربع بطاقات أنماط منفصلة لا واحدة: تغيير الشفافية لا يُعيد كتابة مئة سطرٍ
 * من السلّم، فيبقى السحب سلساً.
 */
export function applyTheme({ state, neutrals, backgroundDataUrl }: ApplyInput): void {
    if (!state.enabled) {
        removeTheme();
        return;
    }

    const hex = parseHex(state.color) ?? DEFAULT_STATE.color;

    setStyle(VAR_ID.ramp, neutrals.size > 0 ? buildRampCss(neutrals, hex) : "");

    setStyle(VAR_ID.glass, state.glass
        ? buildGlassCss(state.surfaces, state.panelBlur)
        : "");
    setStyle(VAR_ID.text, buildTextCss(state.text));
    setStyle(VAR_ID.background, state.background.enabled && backgroundDataUrl
        ? buildBackgroundCss({ dataUrl: backgroundDataUrl, ...state.background })
        : "");
    setStyle(VAR_ID.gradient, buildGradientCss(state.gradient));
    setStyle(VAR_ID.glow, buildGlowCss(state.glow));
    setStyle(VAR_ID.fonts, buildFontCss(state.fonts.interface, state.fonts.mono));
}

export function removeTheme(): void {
    for (const id of Object.values(VAR_ID)) document.getElementById(id)?.remove();
}

/**
 * يُعيد الثيم بعد إقلاع العميل.
 *
 * 🔴 تُستدعى من `start()` لا من نطاق الوحدة. سطرٌ يجري عند الاستيراد يسبق
 * جهوز webpack وقد أسقط العميل مرّةً من قبل — والثمن هنا أن الثيم يظهر بعد
 * جزءٍ من الثانية، وهو أرخص من عميلٍ لا يُقلع.
 *
 * وحين يكون المفتاح مُطفأً لا يُقرأ شيء ولا يُجلب شيء: **صفر تكلفة لمن لا
 * يستعمل الميزة**، وهم أكثر الناس.
 */
export async function restoreOnStartup(): Promise<void> {
    let state: ThemeCreatorState;
    try {
        state = readState();
    } catch {
        return;
    }
    if (!state.enabled) return;

    let backgroundDataUrl: string | null = null;
    if (state.background.enabled) {
        try {
            const stored = await (window as any).VencordNative?.themeCreator?.getBackground?.();
            if (stored?.ok && stored.dataUrl) backgroundDataUrl = stored.dataUrl;
        } catch { /* الألوان تُطبَّق ولو غابت الصورة */ }
    }

    try {
        applyTheme({ state, neutrals: await loadNeutrals(), backgroundDataUrl });
    } catch { /* ثيمٌ لم يُطبَّق أهون من عميلٍ سقط في إقلاعه */ }
}

/* ── التصدير ─────────────────────────────────────────────────────────────── */

/**
 * يُنتج ملفّ ثيم قائماً بذاته.
 *
 * وهذا ما يجعله «منشئ ثيمات» لا «لون عميل»: ملفٌّ يُنسَخ ويُشارَك ويبقى بعد
 * إطفاء المنشئ، وتقرؤه صفحة «الثيمات» كأي ثيمٍ آخر.
 *
 * ⚠️ الخلفية لا تدخل الملفّ: صورةٌ بالسِتّ والستّين تُضخّم ملفّاً نصّياً إلى
 * ميغابايتات ولا تُشارَك، والملفّ يقول ذلك في ترويسته بدل أن يصمت.
 */
export function exportCss(state: ThemeCreatorState, name: string, author: string): string {
    const hex = parseHex(state.color) ?? DEFAULT_STATE.color;
    const neutrals = neutralCache ?? new Map();

    const surfaceLines = (state.glass ? SURFACES : [])
        .map(s => ({ s, v: state.surfaces[s.key] ?? 0 }))
        .filter(({ v }) => v > 0)
        .map(({ s, v }) => ` * ${s.ar} · ${s.en}: ${v}%`);

    const header = [
        "/**",
        ` * @name ${name}`,
        ` * @author ${author}`,
        ` * @description ثيم من منشئ إشراق · Built with the Esharq theme creator — #${hex}`,
        " * @version 1.0.0",
        " *",
        " * أُنتج آلياً: يُعاد تعريف سلّم ديسكورد الرمادي كلّه انطلاقاً من لونٍ واحد،",
        " * مع الحفاظ على فروق الإضاءة بين درجاته — فيبقى النصّ مقروءاً.",
        surfaceLines.length > 0 ? " *\n * شفافية الأسطح:" : "",
        ...surfaceLines,
        state.background.enabled
            ? " *\n * ⚠️ صورة الخلفية ليست في هذا الملفّ (صورةٌ لا تُكتب نصّاً). اخترها من منشئ الثيمات."
            : "",
        " */",
        ""
    ].filter(line => line !== "");

    const blocks = [
        header.join("\n"),
        neutrals.size > 0 ? buildRampCss(neutrals, hex) : "",
        state.glass ? buildGlassCss(state.surfaces, state.panelBlur) : "",
        buildTextCss(state.text),
        buildGradientCss(state.gradient),
        buildGlowCss(state.glow),
        buildFontCss(state.fonts.interface, state.fonts.mono)
    ].filter(block => block !== "");

    return blocks.join("\n\n") + "\n";
}
