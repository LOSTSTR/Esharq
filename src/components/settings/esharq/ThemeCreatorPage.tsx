/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./themeCreator.css";

import { PlainSettings, useSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Switch } from "@components/Switch";
import { IS_WINDOWS } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import type { Theme } from "@vencord/discord-types";
import { findByCodeLazy } from "@webpack";
import { Button, ClientThemesBackgroundStore, Slider, ThemeStore, useEffect, useMemo, useRef, UserStore, useState, useStateFromStores } from "@webpack/common";

import { Card, NoticeStrip } from "./Card";
import { stagger } from "./motion";
import {
    availableFonts,
    checkContrast,
    Direction,
    DIRECTIONS,
    hexToHsl,
    INTERFACE_FONTS,
    MONO_FONTS,
    NeutralMap,
    PAINT_TARGETS,
    parseHex,
    SURFACE_GROUPS,
    SURFACES,
    TEXT_TARGETS
} from "./themeCreator/engine";
import {
    applyTheme,
    DEFAULT_STATE,
    exportCss,
    loadNeutrals,
    PRESETS,
    readState,
    removeTheme,
    ThemeCreatorState,
    writeState
} from "./themeCreator/state";

/**
 * **منشئ الثيمات.**
 *
 * لونٌ واحد يُعيد صبغ ديسكورد كلّه، وزجاجٌ لكل سطح، وصورة خلفية، وتدرّجٌ
 * وتوهّجٌ على النصّ، وخطوطٌ من النظام — ثم ملفُّ ثيمٍ يخرج من ذلك كلّه.
 *
 * الشرح التقنيّ في `themeCreator/engine.ts`؛ وهنا الواجهة وحدها.
 *
 * ## قاعدة هذه الصفحة
 *
 * **كل مِقبضٍ هنا مُتحقَّقٌ من أثره على عميل حيّ.** لا هدفَ تدرّجٍ باسمٍ جميل
 * لا يُطابق عنصراً، ولا سطحَ زجاجٍ شفّافٍ أصلاً، ولا خطَّ نظامٍ غير مثبَّت.
 * ما لم يُقَس لم يُعرَض — لأن مِقبضاً لا يفعل شيئاً أسوأ من غيابه: صاحبه
 * يظنّ أنه ضبط شيئاً، ثم يبحث عن العطل في مكانٍ آخر.
 */

/** تبديل وضع ديسكورد نفسه — إعدادُه هو، لا إعدادنا. */
const saveClientTheme = findByCodeLazy('type:"UNSYNCED_USER_SETTINGS_UPDATE', '"system"===');

/**
 * أسماء أوضاع ديسكورد الأربعة كما يسمّيها هو.
 *
 * 🔴 أربعة لا اثنان: `ThemeStore.theme` يردّ `light | dark | darker | midnight`
 * (`@vencord/discord-types`). وتسطيحُها إلى «فاتح أو داكن» يجعل صاحب Onyx
 * يقرأ عن نفسه «داكن» — وهو ليس عليه.
 *
 * والأسماء المعروضة هي أسماء ديسكورد نفسه (Ash · Onyx)، لا ترجمةً من عندنا
 * للاسم الداخليّ: صاحبها يبحث عنها في «المظهر» عند ديسكورد بهذه الأسماء.
 * ومصدرها في هذا المستودع `equicordplugins/commandPalette/commands/discordActions.tsx:21-25`.
 */
const THEME_NAMES: Record<Theme, { ar: string; en: string; }> = {
    light: { ar: "فاتح", en: "Light" },
    darker: { ar: "رماديّ (Ash)", en: "Ash" },
    dark: { ar: "داكن", en: "Dark" },
    midnight: { ar: "أسود (Onyx)", en: "Onyx" }
};

/**
 * المادّة التي أُنشئت بها نافذةُ ديسكورد القائمة.
 *
 * 🔴 شريط «أعد التشغيل» كان معلّقاً على **وجود مادّةٍ مختارة**، لا على
 * **تغيّر الاختيار**. فمن ضبط Mica قبل شهرٍ وأعاد التشغيل يومها ظلّ الشريط
 * الأحمر يطالبه بإعادة تشغيلٍ نفّذها فعلاً — تحذيرٌ دائم لا يزول، وهو أسوأ من
 * غيابه: من رأى تحذيراً لا يزول كفّ عن قراءة التحذيرات.
 *
 * والمقارنة تحتاج القيمة التي **قرأتها العملية الرئيسة عند إنشاء النافذة**
 * (`main/patcher.ts:120-121`). ولا واجهةَ أصليّة تردّها، لكنّ هذه الوحدة
 * تُحمَّل من `plugins/_core/settings.tsx` عند إقلاع إشراق — قبل أن يبلغ
 * المستخدمُ أيّ مِقبض — فقراءتها هنا مرّةً واحدة تلتقط حالة النافذة نفسها.
 */
const MATERIAL_AT_LAUNCH: string = (() => {
    try { return (PlainSettings as any)?.windowsMaterial ?? "none"; } catch { return "none"; }
})();

/* ── لبنات ───────────────────────────────────────────────────────────────── */

function Row({ label, hint, children }: { label: string; hint?: string; children?: React.ReactNode; }) {
    return (
        <div className="esharq-tc-row">
            <div className="esharq-tc-row-text">
                <div className="esharq-tc-row-label">{label}</div>
                {hint !== undefined && <div className="esharq-tc-row-hint">{hint}</div>}
            </div>
            {children !== undefined && <div className="esharq-tc-row-control">{children}</div>}
        </div>
    );
}

/**
 * مِقبض بقيمةٍ مكتوبة.
 *
 * `onValueRender` يُظهر الرقم على المِقبض أثناء السحب: فرقُ خمسة بالمئة في
 * الشفافية لا تُحسّه العين، فالرقم هو ما يُطمئن الساحب أنّه يتحرّك.
 */
function ValueSlider({ value, onChange, min = 0, max = 100, unit = "%" }: {
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    unit?: string;
}) {
    const span = max - min;

    /**
     * 🔴 `Slider` مكوّنٌ صنفيّ **غير مُتحكَّمٍ به**.
     *
     * لا `value` عنده أصلاً: يقرأ `initialValue` مرّةً واحدة عند التركيب ثمّ
     * لا ينظر إليه ثانية (`@vencord/discord-types` — `components.d.ts:290`).
     * فكلّ ضبطٍ يأتي من **خارج** المِقبض — زرٌّ جاهز، أو «كل الأسطح»، أو
     * «صفّر الأسطح» — كان يُحرّك الرقم المكتوب ويترك الإبهام مكانه. فيضغط
     * صاحبه «متوازن» فيقرأ ٢٥٪ في خمسة عشر موضعاً، والأباهيم الخمسة عشر لم
     * تتزحزح: رقمان متناقضان لضبطٍ واحد، ولا يدري أيّهما الصادق.
     *
     * والعلاج الوحيد لمكوّنٍ كهذا إعادةُ تركيبه بمفتاح. والشرط أن يثبت
     * المفتاح **أثناء السحب**، وإلّا تركّب المِقبض من جديد تحت الإصبع فانقطع
     * السحب في كل حركة — عطلٌ أسوأ من الأوّل.
     *
     * والتمييز هنا: نحفظ آخر قيمةٍ بعثها المِقبض نفسه. فإن عادت القيمة
     * مساويةً لها فهي **صداه هو** راجعاً عبر الحالة، ولا يُحرَّك المفتاح؛ وإن
     * خالفتها فهي من الخارج، فيُعاد التركيب على القيمة الجديدة.
     */
    const echo = useRef(value);
    const generation = useRef(0);
    if (value !== echo.current) {
        generation.current++;
        echo.current = value;
    }

    return (
        <Slider
            key={generation.current}
            initialValue={value}
            minValue={min}
            maxValue={max}
            markers={[min, min + span / 4, min + span / 2, min + (span * 3) / 4, max]}
            stickToMarkers={false}
            onValueChange={v => {
                const next = Math.round(v);
                echo.current = next;
                onChange(next);
            }}
            onValueRender={v => `${Math.round(v)}${unit}`}
            className="esharq-tc-slider"
        />
    );
}

function ColorField({ value, fallback, onChange }: { value: string; fallback: string; onChange: (hex: string) => void; }) {
    const hex = parseHex(value);

    /**
     * 🔴 لا تُعرَض قيمة `fallback` على أنّها اللون المختار.
     *
     * كان الحقل يضع `fallback` مكان القيمة الغائبة، فتُظهر تجاوزاتُ النصّ
     * السّتّة مربّعاً أبيض و`#ffffff` مكتوباً — وعنوان البطاقة فوقها يقول
     * «اتركه فارغاً ليتبع النصّ لونَ ثيمك». فالعين ترى لوناً مضبوطاً والنصّ
     * يقول غير مضبوط، والصادق منهما `buildTextCss` الذي لا يكتب لها شيئاً
     * (`themeCreator/engine.ts:507-512`).
     *
     * وأثر الكذبة أسوأ منها: منتقي اللون كان يحمل `#ffffff` أصلاً، فمن فتحه
     * واختار الأبيض **قصداً** لم يُغيّر شيئاً، فلا حدث `change` ولا تجاوزٌ
     * يُكتَب. لونٌ واحد من ستّة عشر مليوناً كان يستحيل ضبطه، بلا رسالةٍ ولا
     * سبب.
     *
     * فالحقل الآن يقول «غير محدّد» صراحةً، والضبط خطوةٌ يقصدها صاحبها — وبها
     * يصير الأبيض قابلاً للاختيار كأيّ لونٍ آخر.
     */
    if (hex === null) {
        return (
            <div className="esharq-tc-colour-pair">
                <span
                    aria-hidden="true"
                    style={{
                        inlineSize: 44,
                        blockSize: 34,
                        borderRadius: 8,
                        border: "1px dashed var(--border-medium, #ffffff1f)",
                        background: "repeating-linear-gradient(45deg, #ffffff0f 0 5px, transparent 5px 10px)"
                    }}
                />
                <code className="esharq-tc-code">{t("غير محدّد", "Not set")}</code>
                <Button
                    size={Button.Sizes.SMALL}
                    look={Button.Looks.LINK}
                    color={Button.Colors.PRIMARY}
                    onClick={() => onChange(fallback)}>
                    {t("عيّن لوناً", "Set a colour")}
                </Button>
            </div>
        );
    }

    return (
        <div className="esharq-tc-colour-pair">
            <input
                type="color"
                className="esharq-tc-picker"
                value={`#${hex}`}
                onChange={e => onChange(e.currentTarget.value.replace("#", ""))}
                aria-label={`#${hex}`}
            />
            <code className="esharq-tc-code">#{hex}</code>
        </div>
    );
}

/**
 * الأهداف: بطاقةُ اختيارٍ لكلٍّ، بوصفٍ يقول ما الذي ستطاله.
 *
 * قائمةٌ منسدلة متعدّدة الاختيار تُخفي ما لم يُفتَح، ووسمٌ بكلمةٍ واحدة لا
 * يقول ماذا تعني «تفاصيل المحادثة». والبطاقة تقول الاثنين معاً.
 */
function TargetGrid({ selected, onChange }: { selected: string[]; onChange: (next: string[]) => void; }) {
    const all = PAINT_TARGETS.map(target => target.key);
    const everything = selected.length === all.length;

    return (
        <div className="esharq-tc-targets">
            <button
                type="button"
                className={"esharq-tc-target all" + (everything ? " on" : "")}
                onClick={() => onChange(everything ? [] : all)}>
                <span className="esharq-tc-target-box" aria-hidden="true" />
                <span className="esharq-tc-target-text">
                    <b>{t("الكلّ", "Everything")}</b>
                    <span>{t("يختار كل الأهداف أو يمسحها معاً.", "Select or clear every target together.")}</span>
                </span>
            </button>

            <div className="esharq-tc-target-grid">
                {PAINT_TARGETS.map(target => (
                    <button
                        key={target.key}
                        type="button"
                        className={"esharq-tc-target" + (selected.includes(target.key) ? " on" : "")}
                        onClick={() => onChange(selected.includes(target.key)
                            ? selected.filter(k => k !== target.key)
                            : [...selected, target.key])}>
                        <span className="esharq-tc-target-box" aria-hidden="true" />
                        <span className="esharq-tc-target-text">
                            <b>{t(target.ar, target.en)}</b>
                            <span>{t(target.ar_hint, target.en_hint)}</span>
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function Choices<T extends string>({ value, options, onChange }: {
    value: T;
    options: readonly { key: T; ar: string; en: string; }[];
    onChange: (key: T) => void;
}) {
    return (
        <div className="esharq-tc-choices">
            {options.map(option => (
                <button
                    key={option.key}
                    type="button"
                    className={"esharq-tc-choice" + (value === option.key ? " on" : "")}
                    onClick={() => onChange(option.key)}>
                    {t(option.ar, option.en)}
                </button>
            ))}
        </div>
    );
}

/* ── الصفحة ──────────────────────────────────────────────────────────────── */

function ThemeCreatorPageInner() {
    const [state, setState] = useState<ThemeCreatorState>(() => readState());
    const [neutrals, setNeutrals] = useState<NeutralMap | null>(null);
    const [background, setBackground] = useState<string | null>(null);
    const [notice, setNotice] = useState<{ tone: "info" | "danger"; text: string; } | null>(null);
    const [saving, setSaving] = useState(false);
    const [themeName, setThemeName] = useState("");

    /** مادّة النافذة إعدادٌ أصليّ (يُقرأ عند إنشاء النافذة)، لا جزءٌ من حالتنا. */
    const native = useSettings(["windowsMaterial"]);

    /**
     * 🔴 `useMemo` ليس تحسيناً هنا، بل شرطُ صحّة.
     *
     * `supportsWindowsMaterial` تُنفَّذ بـ`ipcRenderer.sendSync`
     * (`VencordNative.ts:112`)، وهي **تُجمّد خيط العرض** حتى تردّ العملية
     * الرئيسة. وكانت تُستدعى في جسم المكوّن مباشرةً، أي عند **كل رسمة** — وهذه
     * الصفحة تُعيد الرسم مع كل حركة إصبعٍ على أيّ من مقابضها الخمسة عشر. فكان
     * السحب يوقف الخيط عشرات المرّات في الثانية على رحلةٍ بين عمليتين، وجوابها
     * لا يتغيّر أبداً: قدرةُ الجهاز لا تتبدّل أثناء فتح الصفحة.
     */
    const canFrost = useMemo(() => {
        if (!IS_WINDOWS || IS_WEB) return false;
        try { return VencordNative.native.supportsWindowsMaterial(); } catch { return false; }
    }, []);

    /** الوضع الحيّ عند ديسكورد — من مخزنه لا من إعداداتنا، فيتحدّث لو بدّله من مكانٍ آخر. */
    const discordTheme = useStateFromStores([ThemeStore], () => ThemeStore.theme);
    /**
     * `isLight` يصلح لسؤالٍ **ثنائيٍّ حقّاً** وحده: أفاتحٌ هو أم لا؟ وذلك سؤال
     * فحص التباين، فـ`darker` و`midnight` كلاهما داكن (`api/Themes.ts:76`).
     *
     * 🔴 ولا يصلح مصدراً يُعاد منه بناء الوضع: `isLight ? "light" : "dark"`
     * تُحوّل Ash وOnyx إلى `dark` وتكتبها عند ديسكورد — فيفقد صاحبها وضعه
     * ولا سبيل إلى ردّه. فما يُكتَب يُكتب من `discordTheme` خاماً.
     */
    const isLight = discordTheme === "light";

    /**
     * ثيم Nitro المتدرّج مُشتغل؟
     *
     * 🔴 هذا العطل يبدو **عطلاً فينا**: يختار المستخدم لوناً فلا يتغيّر شيء أو
     * يتغيّر نصف الواجهة، فيظنّ منشئ الثيمات مكسوراً. والسبب أنّ ديسكورد يفرض
     * تدرّجه فوق أسطحه، فيغلب ما نكتبه على السلّم الرماديّ.
     *
     * ويُقرأ من `gradientPreset`: `null` تعني «لا تدرّج»، وأي قيمة تعني تدرّجاً
     * فعّالاً — وهو ما تفحصه إضافة `clientTheme` الأصلية نفسها
     * (`plugins/clientTheme/components/Settings.tsx:47`).
     */
    const nitroGradient = useStateFromStores(
        [ClientThemesBackgroundStore],
        () => ClientThemesBackgroundStore.gradientPreset != null
    );

    /** خطوطٌ مثبَّتةٌ فعلاً على هذا الجهاز — لا قائمةٌ مكتوبةٌ على أمل. */
    const interfaceChoices = useMemo(() => availableFonts(INTERFACE_FONTS), []);
    const monoChoices = useMemo(() => availableFonts(MONO_FONTS), []);

    const loading = useRef(false);
    useEffect(() => {
        if (loading.current) return;
        loading.current = true;
        loadNeutrals().then(setNeutrals).catch(() => setNeutrals(new Map()));

        if (state.background.enabled) {
            (window as any).VencordNative?.themeCreator?.getBackground?.()
                .then((r: any) => { if (r?.ok && r.dataUrl) setBackground(r.dataUrl); })
                .catch(() => { /* الألوان تعمل بدونها */ });
        }
    }, []);

    const hex = parseHex(state.color) ?? DEFAULT_STATE.color;
    const verdict = checkContrast(hex, isLight);
    const hsl = hexToHsl(hex);

    function update(next: Partial<ThemeCreatorState>, dataUrl: string | null = background) {
        setState(prev => {
            const merged = { ...prev, ...next };
            writeState(merged);
            if (neutrals != null) applyTheme({ state: merged, neutrals, backgroundDataUrl: dataUrl });
            return merged;
        });
    }

    function setEnabled(enabled: boolean) {
        if (!enabled) removeTheme();
        update({ enabled });
    }

    function setDiscordMode(mode: Theme) {
        try { saveClientTheme({ theme: mode }); } catch { /* إعداد ديسكورد، وقد يتغيّر موضعه */ }
    }

    async function pickBackground() {
        setNotice(null);
        const api = (window as any).VencordNative?.themeCreator;
        if (api?.pickBackground == null) return;

        const picked = await api.pickBackground();
        if (!picked?.ok) {
            if (picked?.reason === "cancelled") return;
            const messages: Record<string, string> = {
                "too-big": t("الصورة أكبر من ١٢ ميغابايت. اختر صورةً أصغر.", "That image is over 12 MB. Pick a smaller one."),
                unsupported: t("صيغة غير مدعومة. استعمل PNG أو JPG أو GIF أو WebP.", "Unsupported format. Use PNG, JPG, GIF or WebP."),
                unreadable: t("تعذّرت قراءة الملفّ.", "Couldn't read that file.")
            };
            setNotice({ tone: "danger", text: messages[picked?.reason] ?? t("تعذّر الاختيار.", "Couldn't pick that file.") });
            return;
        }

        setBackground(picked.dataUrl);
        update({ enabled: true, background: { ...state.background, enabled: true } }, picked.dataUrl);
    }

    async function clearBackground() {
        try { await (window as any).VencordNative?.themeCreator?.clearBackground?.(); } catch { /* لا شيء */ }
        setBackground(null);
        update({ background: { ...state.background, enabled: false } }, null);
    }

    async function saveTheme() {
        setNotice(null);
        setSaving(true);
        try {
            const me = (() => { try { return UserStore.getCurrentUser(); } catch { return null; } })();
            const name = themeName.trim() || t("ثيمي من إشراق", "My Esharq theme");
            const css = exportCss(state, name, me?.username ?? "Esharq");
            const result = await (window as any).VencordNative?.themeCreator?.saveCss?.(name, css);

            if (result?.ok) {
                setNotice({
                    tone: "info",
                    text: t(`حُفظ باسم ${result.fileName} في مجلد الثيمات — فعّله من صفحة «الثيمات».`,
                        `Saved as ${result.fileName} in your themes folder — turn it on from the Themes page.`)
                });
            } else {
                setNotice({
                    tone: "danger",
                    text: result?.reason === "bad-name"
                        ? t("الاسم غير صالح. استعمل حروفاً وأرقاماً.", "That name isn't usable. Use letters and numbers.")
                        : t("تعذّر الحفظ. أعد تشغيل ديسكورد إن كنت قد حدّثت إشراق للتوّ.",
                            "Couldn't save. Restart Discord if you just updated Esharq.")
                });
            }
        } finally {
            setSaving(false);
        }
    }

    const activeSurfaces = state.glass ? SURFACES.filter(s => (state.surfaces[s.key] ?? 0) > 0).length : 0;
    const first = state.surfaces[SURFACES[0].key] ?? 0;
    /**
     * 🔴 `null` علامةَ الاختلاف، لا `0`.
     *
     * كانت `0` تُستعمل علامةً على «الأسطح غير متساوية»، و`0` نفسها هي قيمة
     * «صلب» الحقيقية. فمن اختار «منفتح» (٥٥٪) ثمّ حرّك سطحاً واحداً أضاءت له
     * بطاقةُ **«صلب — أعلى تباين»** وضعاً قائماً، وأربعةَ عشرَ سطحاً تحتها على
     * ٥٥٪ من الشفافية. علامةٌ تصلح قيمةً ليست علامة.
     */
    const uniformSurface: number | null =
        SURFACES.every(s => (state.surfaces[s.key] ?? 0) === first) ? first : null;

    return (
        <>
            <NoticeStrip>
                {t("لونٌ واحد يُعيد صبغ ديسكورد كلّه: خلفياته وأسطحه ونصوصه مبنيّةٌ على سلّمٍ رماديّ واحد، ونحن نُعيد تعريف السلّم ونحفظ فروق الإضاءة بين درجاته — فيتغيّر اللون ويبقى النصّ مقروءاً.",
                    "One colour re-tints all of Discord: its backgrounds, surfaces and text are all built from a single grey ramp. We redefine the ramp and keep the lightness gaps between its steps — so the colour changes and the text stays readable.")}
            </NoticeStrip>

            <Card index={0}
                title={t("منشئ الثيمات", "Theme Creator")}
                subtitle={t("يُطبَّق فوراً، ويعود بعد إعادة التشغيل.", "Applies instantly and comes back after a restart.")}
                badge={state.enabled ? t("يعمل", "On") : t("مُطفأ", "Off")}
                badgeTone={state.enabled ? "ok" : "info"}>
                <Row
                    label={t("فعّل الثيم", "Enable the theme")}
                    hint={t("عند الإطفاء يعود ديسكورد إلى ألوانه فوراً — لا شيء يبقى محقوناً.",
                        "Turning it off restores Discord's own colours immediately — nothing stays injected.")}>
                    <Switch checked={state.enabled} onChange={setEnabled} />
                </Row>
            </Card>

            <Card index={1}
                title={t("لون الثيم", "Theme colour")}
                subtitle={t("اختره بنفسك أو ابدأ من لونٍ جاهز.", "Pick your own, or start from a preset.")}
                badge={`#${hex}`}>

                <div className="esharq-tc-colour">
                    <div className="esharq-tc-swatch" style={{ background: `#${hex}` }}>
                        <span>#{hex}</span>
                    </div>

                    <div className="esharq-tc-colour-fields">
                        <input
                            type="color"
                            className="esharq-tc-picker"
                            value={`#${hex}`}
                            onChange={e => update({ color: e.currentTarget.value.replace("#", "") })}
                            aria-label={t("لون الثيم", "Theme colour")}
                        />
                        <input
                            type="text"
                            className="esharq-tc-hex"
                            value={`#${state.color}`}
                            spellCheck={false}
                            onChange={e => {
                                const raw = e.currentTarget.value.replace("#", "");
                                // القيمة الخام تُعرَض أثناء الكتابة، والتطبيق ينتظر لوناً كاملاً:
                                // تطبيقُ كل حرفٍ يُومض الواجهة بألوانٍ لم يقصدها أحد.
                                const valid = parseHex(raw);
                                if (valid !== null) update({ color: valid });
                                else setState(prev => ({ ...prev, color: raw.slice(0, 6) }));
                            }}
                            aria-label={t("اللون بالنظام السداسي", "Hex colour")}
                        />
                        <Button
                            size={Button.Sizes.SMALL}
                            look={Button.Looks.LINK}
                            color={Button.Colors.PRIMARY}
                            onClick={() => update({ color: DEFAULT_STATE.color })}>
                            {t("استعادة", "Reset")}
                        </Button>
                    </div>
                </div>

                <div className="esharq-tc-presets">
                    {PRESETS.map(preset => (
                        <button
                            key={preset}
                            type="button"
                            className={"esharq-tc-preset" + (preset === hex ? " on" : "")}
                            style={{ background: `#${preset}` }}
                            title={`#${preset}`}
                            aria-label={`#${preset}`}
                            onClick={() => update({ color: preset })}
                        />
                    ))}
                </div>

                <div className="esharq-tc-hsl">
                    {t(`الصبغة ${Math.round(hsl.h)}° · التشبّع ${Math.round(hsl.s)}% · الإضاءة ${Math.round(hsl.l)}%`,
                        `Hue ${Math.round(hsl.h)}° · Saturation ${Math.round(hsl.s)}% · Lightness ${Math.round(hsl.l)}%`)}
                </div>

                {/* يسبق فحصَ التباين قصداً: ما دام التدرّج مُشتغلاً فاللون لا يظهر
                    أصلاً، فلا معنى لمناقشة قراءة النصّ فوق لونٍ لا يُرى. */}
                {nitroGradient && (
                    <div className="esharq-tc-warn">
                        <div className="esharq-tc-warn-text">
                            <b>{t("ثيم Nitro يغلب لونك", "Your Nitro theme is overriding this")}</b>
                            <span>
                                {t(
                                    "لديك ثيم Nitro متدرّج مُشتغل، وديسكورد يفرضه فوق أسطحه — فلونك هنا لن يظهر أو سيظهر نصفه. أطفئه ليعود المنشئ إلى عمله.",
                                    "You have a Nitro gradient theme on, and Discord paints it over its own surfaces — so your colour here will not show, or will show only half. Turn it off and the creator works again."
                                )}
                            </span>
                        </div>
                        {/* 🔴 `discordTheme` خاماً، لا `isLight ? "light" : "dark"`.
                            إعادةُ حفظ الوضع الحاليّ **نفسه** هي ما يمسح التدرّج، وهي
                            طريقة ديسكورد لا حيلةً من عندنا — وكذلك تفعل الإضافة
                            الأصلية (`plugins/clientTheme/components/Settings.tsx:89`:
                            `setDiscordTheme(currentTheme)`).

                            والسطر القديم لم يكن يُعيد حفظ الوضع الحاليّ، بل يمرّ به
                            على منطقٍ ثنائيّ يُخرج أحد قيمتين: فمن كان على Ash أو Onyx
                            كتب له الزرُّ `dark`. فيُطفأ التدرّج ويُفقَد وضعه معه، بلا
                            تنبيهٍ ولا رجعة — وهو يظنّ أنّه ضغط زرّ إطفاءٍ لا زرّ
                            تبديل. */}
                        <Button size={Button.Sizes.SMALL} color={Button.Colors.RED}
                            onClick={() => setDiscordMode(discordTheme)}>
                            {t("أطفئ ثيم Nitro", "Turn off the Nitro theme")}
                        </Button>
                    </div>
                )}

                {verdict !== "fine" && (
                    <div className="esharq-tc-warn">
                        <div className="esharq-tc-warn-text">
                            <b>{t("فحص المظهر", "Appearance check")}</b>
                            <span>
                                {verdict === "wrong-mode"
                                    ? t(`هذا اللون ${isLight ? "داكنٌ على وضعٍ فاتح" : "فاتحٌ على وضعٍ داكن"} — سيصعب قراءة النصّ.`,
                                        `This colour is ${isLight ? "dark on a light mode" : "light on a dark mode"} — text will be hard to read.`)
                                    : t("هذا اللون في منتصف المدى، فلا يصلح لوضعٍ داكن ولا فاتح. اختر لوناً أغمق أو أفتح بوضوح.",
                                        "This colour sits mid-range, so it suits neither dark nor light mode. Pick something clearly darker or lighter.")}
                            </span>
                        </div>
                        {/* الحلّ لا التحذير وحده — وزرٌّ واحدٌ يُنفّذه. */}
                        {verdict === "wrong-mode" && (
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.RED}
                                onClick={() => setDiscordMode(isLight ? "dark" : "light")}>
                                {isLight ? t("استخدم الوضع الداكن", "Use dark mode") : t("استخدم الوضع الفاتح", "Use light mode")}
                            </Button>
                        )}
                    </div>
                )}
            </Card>

            <Card index={2}
                title={t("المظهر الأساس", "Base appearance")}
                subtitle={t("الوضع الذي يُبنى لونك فوقه — وهو إعداد ديسكورد نفسه، يبقى كما تتركه ولو أزلت إشراق.",
                    "The mode your colour is built on — Discord's own setting, which stays as you leave it even if you remove Esharq.")}
                badge={t(THEME_NAMES[discordTheme]?.ar ?? discordTheme, THEME_NAMES[discordTheme]?.en ?? discordTheme)}>
                <div className="esharq-tc-modes">
                    {([
                        // 🔴 الأربعة كلّها معروضة — والسؤال الذي منع عرضها حُسم بالقياس:
                        // هل ينطبق سلّم إشراق (المحصور في `.theme-dark`) على Ash وOnyx؟
                        // قِيس على عميل حيّ: `darker` تحمل ["theme-dark","theme-darker"]
                        // و`midnight` تحمل ["theme-dark","theme-midnight"] — فالسلّم ينطبق
                        // على الثلاثة. ولولا القياس لبقيت البطاقتان محجوبتين بلا سبب.
                        { key: "dark", ar: "داكن", en: "Dark", hintAr: "أسطحٌ عميقة ونصٌّ فاتح.", hintEn: "Deep surfaces with light text.", swatch: "#1e1f22" },
                        { key: "darker", ar: "رماديّ (Ash)", en: "Ash", hintAr: "أعمقُ من الداكن قليلاً.", hintEn: "A shade deeper than Dark.", swatch: "#131416" },
                        { key: "midnight", ar: "أسود (Onyx)", en: "Onyx", hintAr: "أسودُ خالص، أوفرُ للشاشات المضيئة ذاتياً.", hintEn: "Pure black, kinder to OLED screens.", swatch: "#000000" },
                        { key: "light", ar: "فاتح", en: "Light", hintAr: "أسطحٌ ساطعة ونصٌّ داكن.", hintEn: "Bright surfaces with dark text.", swatch: "#ffffff" }
                    ] as const).map(mode => (
                        <button
                            key={mode.key}
                            type="button"
                            // 🔴 مقارنةٌ بالقيمة الخام، لا بمنطقٍ ثنائيّ.
                            // `(mode.key === "light") === isLight` كانت تُضيء «داكن»
                            // لصاحب Ash وOnyx، فيقرأ عن نفسه ما ليس عليه — ثم يظنّ
                            // أنّ الزرّ لا يعمل حين يضغطه فلا «يتغيّر» شيء ظاهر.
                            className={"esharq-tc-mode" + (mode.key === discordTheme ? " on" : "")}
                            onClick={() => setDiscordMode(mode.key)}>
                            <span className="esharq-tc-mode-swatch" style={{ background: mode.swatch }} />
                            <span className="esharq-tc-mode-text">
                                <b>{t(mode.ar, mode.en)}</b>
                                <span>{t(mode.hintAr, mode.hintEn)}</span>
                            </span>
                        </button>
                    ))}
                </div>

                {/* لا بطاقة مضيئة الآن، فيلزم قولُ السبب: بطاقتان معروضتان وأربعةُ
                    أوضاع موجودة. والصمت هنا يُقرأ عطلاً.

                    ولا تُعرض بطاقتان لـAsh وOnyx: هذه البطاقات تقول ما يفعله
                    اختيارُها، وسلّم المنشئ مكتوبٌ لـ`.theme-dark` و`.theme-light`
                    وحدهما (`themeCreator/engine.ts:190-192`) — فبطاقةٌ تنقل صاحبها
                    إلى وضعٍ لم يُقَس أثرُ المنشئ فيه تَعِد بما لم يُتحقَّق منه. */}
                {discordTheme !== "dark" && discordTheme !== "light" && (
                    <NoticeStrip>
                        {t(`أنت على وضع «${THEME_NAMES[discordTheme]?.ar ?? discordTheme}» من أوضاع ديسكورد الأربعة، ولذلك لا تُضيء أيٌّ من البطاقتين. وهما تضبطان الوضعين الأساسيين — واختيار إحداهما يبدّل وضعك الحاليّ.`,
                            `You are on Discord's “${THEME_NAMES[discordTheme]?.en ?? discordTheme}” mode, which is why neither tile is lit. These two set the base modes — picking one replaces the mode you are on.`)}
                    </NoticeStrip>
                )}
            </Card>

            <Card index={3}
                title={t("الوضع الزجاجي", "Glass mode")}
                subtitle={t("تحكّم بقوّة ظهور ما خلف كل جزء — بلا إبهات النصّ.",
                    "Control how much shows through each part — without fading the text.")}
                badge={!state.glass
                    ? t("مُطفأ", "Off")
                    : activeSurfaces > 0 ? t(`${activeSurfaces} أسطح`, `${activeSurfaces} surfaces`) : t("لا شيء", "None")}
                badgeTone={state.glass && activeSurfaces > 0 ? "warn" : "info"}>

                <Row
                    label={t("فعّل الوضع الزجاجي", "Enable glass mode")}
                    hint={t("مفتاحٌ واحد يُطفئ الشفافية كلّها ويُعيدها — بلا فقد قيمةٍ ضبطتها.",
                        "One switch turns all transparency off and back on — without losing a value you set.")}>
                    <Switch checked={state.glass} onChange={glass => update({ glass })} />
                </Row>

                {state.glass && (
                    <>
                        {/* 🔴 أهمّ سطرٍ في هذه البطاقة.
                            الشفافية تُظهر **ما خلفها**؛ فإن لم يكن خلفها شيء لم يتغيّر
                            شيء. قِيس حيّاً: عند 55٪ صارت أسطح التطبيق فعلاً
                            `alpha 0.45` بتمويه 40px — ومع ذلك لا يرى صاحبها فرقاً،
                            لأن ما تحتها أسودُ النافذة نفسه. فالمقبض يعمل والنتيجة
                            غير مرئية، وهو أسوأ أنواع الأعطال: لا رسالة ولا سبب. */}
                        {/* 🔴 النصّان مختلفان لأن المعروض مختلف.
                            صفّ «شفافية النافذة» مشروطٌ بـ`canFrost`، أي ويندوز
                            وحده. وكان النصّ يقول لكلّ أحد «فعّل شفافية النافذة
                            **أدناه**» — فيبحث صاحب لينكس وماك ولوحة الويب عن مِقبضٍ
                            غير مرسوم، فيظنّه مخفيّاً أو نفسه أعمى. وإحالةٌ إلى ما
                            ليس موجوداً أسوأ من لا إحالة. */}
                        <NoticeStrip>
                            {canFrost
                                ? t("الشفافية تُظهر ما خلفها — فإن لم يكن خلف ديسكورد شيء لن ترى فرقاً. اختر صورة خلفية من البطاقة التالية، أو فعّل «شفافية النافذة» أدناه ليظهر سطح مكتبك.",
                                    "Transparency reveals what is behind it — with nothing behind Discord you will see no difference. Either pick a background image in the next card, or turn on window transparency below to reveal your desktop.")
                                : t("الشفافية تُظهر ما خلفها — فإن لم يكن خلف ديسكورد شيء لن ترى فرقاً. اختر صورة خلفية من البطاقة التالية ليظهر تحتها شيء. (وشفافية النافذة نفسها ميزةُ ويندوز، ولا يُتيحها نظامك.)",
                                    "Transparency reveals what is behind it — with nothing behind Discord you will see no difference. Pick a background image in the next card so there is something to reveal. (Making the window itself translucent is a Windows feature your system doesn't offer.)")}
                        </NoticeStrip>

                        {canFrost && (
                            <Row
                                label={t("شفافية النافذة", "Window transparency")}
                                hint={t("يجعل نافذة ديسكورد نفسها شبه شفّافة فيظهر سطح مكتبك خلفها. وهو نفسه «مواد الخلفية» في صفحة «نظرة عامّة» — إعدادٌ واحد بمدخلين، لا اثنان.",
                                    "Makes the Discord window itself translucent so your desktop shows through. It is the same setting as “Background Material” on the Overview page — one setting with two entry points, not two.")}>
                                <select
                                    className="esharq-tc-select"
                                    value={native.windowsMaterial ?? "none"}
                                    onChange={e => { native.windowsMaterial = e.currentTarget.value as any; }}
                                    aria-label={t("شفافية النافذة", "Window transparency")}>
                                    <option value="none">{t("مُطفأة", "Off")}</option>
                                    <option value="mica">{t("Mica — خلفية سطح المكتب بلونٍ خافت", "Mica — your wallpaper, faintly tinted")}</option>
                                    <option value="tabbed">{t("Tabbed — مثل Mica بتلوينٍ أقوى", "Tabbed — like Mica, more tinted")}</option>
                                    <option value="acrylic">{t("Acrylic — يُضبِّب ما خلف النافذة", "Acrylic — blurs whatever is behind the window")}</option>
                                </select>
                            </Row>
                        )}

                        {/* 🔴 الشرط «تغيّر الاختيار»، لا «وُجد اختيار».
                            كان الشريط الأحمر يظهر ما دامت مادّةٌ مختارة، فمن ضبط
                            Mica وأعاد التشغيل يومها ظلّ يُطالَب بإعادة تشغيلٍ
                            نفّذها — إنذارٌ دائم لا يُطفأ، فيتعلّم صاحبه تجاهله، ثم
                            يتجاهل معه الإنذار الصادق حين يجيء. */}
                        {canFrost && (native.windowsMaterial ?? "none") !== MATERIAL_AT_LAUNCH && (
                            <NoticeStrip tone="danger">
                                {(native.windowsMaterial ?? "none") === "none"
                                    ? t("أطفأتَ شفافية النافذة — لن تزول عن نافذتك حتى تُغلق ديسكورد وتفتحه من جديد. (ويندوز يقرأ هذا عند إنشاء النافذة، لا بعده.)",
                                        "You turned window transparency off — it won't leave your window until you fully close and reopen Discord. (Windows reads this when the window is created, not after.)")
                                    : t("غيّرتَ شفافية النافذة — لن تظهر حتى تُغلق ديسكورد وتفتحه من جديد. (ويندوز يقرأ هذا عند إنشاء النافذة، لا بعده.)",
                                        "You changed window transparency — it won't appear until you fully close and reopen Discord. (Windows reads this when the window is created, not after.)")}
                            </NoticeStrip>
                        )}

                        <div className="esharq-tc-quick">
                            {([
                                { key: "solid", ar: "صلب", en: "Solid", value: 0, hintAr: "أعلى تباين", hintEn: "Maximum contrast" },
                                { key: "balanced", ar: "متوازن", en: "Balanced", value: 25, hintAr: "واضح ومقروء", hintEn: "Clear and readable" },
                                { key: "open", ar: "منفتح", en: "Open", value: 55, hintAr: "خلفيةٌ أظهر", hintEn: "More backdrop" }
                            ] as const).map(preset => (
                                <button
                                    key={preset.key}
                                    type="button"
                                    className={"esharq-tc-quick-btn" + (uniformSurface === preset.value ? " on" : "")}
                                    onClick={() => update({ surfaces: Object.fromEntries(SURFACES.map(s => [s.key, preset.value])) })}>
                                    <span className="esharq-tc-quick-name">{t(preset.ar, preset.en)}</span>
                                    <span className="esharq-tc-quick-hint">{t(preset.hintAr, preset.hintEn)}</span>
                                </button>
                            ))}
                        </div>

                        <Row label={t("كل الأسطح", "All surfaces")} hint={t(`يضبط الـ${SURFACES.length} كلّها معاً.`, `Sets all ${SURFACES.length} together.`)}>
                            {/* مِقبضٌ يضبط ولا يقرأ: حين تختلف الأسطح فلا قيمة واحدة
                                تُمثّلها، فيقف على قيمة أوّلها — قيمةٌ حقيقيّة من
                                المجموعة، لا صفرٌ يقفز إليه المِقبض كلّما مُسّ سطحٌ
                                واحد. */}
                            <ValueSlider
                                value={uniformSurface ?? first}
                                onChange={v => update({ surfaces: Object.fromEntries(SURFACES.map(s => [s.key, v])) })}
                            />
                        </Row>

                        <Row label={t("تمويه اللوحات", "Panel blur")} hint={t("يُنعّم ما يظهر خلف الأسطح الشفّافة.", "Softens whatever shows through.")}>
                            <ValueSlider value={state.panelBlur} max={40} unit="px" onChange={v => update({ panelBlur: v })} />
                        </Row>

                        {SURFACE_GROUPS.map(group => {
                            const members = SURFACES.filter(s => s.group === group.key);
                            if (members.length === 0) return null;
                            return (
                                <div key={group.key} className="esharq-tc-group">
                                    <div className="esharq-tc-group-head">
                                        <b>{t(group.ar, group.en)}</b>
                                        <span>{t(group.ar_hint, group.en_hint)}</span>
                                    </div>
                                    <div className="esharq-tc-surfaces">
                                        {members.map((surface, i) => (
                                            <div key={surface.key} className="esharq-tc-surface esharq-rise" style={stagger(i, 4)}>
                                                <div className="esharq-tc-surface-head">
                                                    <span>{t(surface.ar, surface.en)}</span>
                                                    <span className="esharq-tc-surface-value">{state.surfaces[surface.key] ?? 0}%</span>
                                                </div>
                                                <div className="esharq-tc-surface-hint">{t(surface.ar_hint, surface.en_hint)}</div>
                                                <ValueSlider
                                                    value={state.surfaces[surface.key] ?? 0}
                                                    onChange={v => update({ surfaces: { ...state.surfaces, [surface.key]: v } })}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        <div className="esharq-tc-actions end">
                            <Button size={Button.Sizes.SMALL} look={Button.Looks.LINK} color={Button.Colors.PRIMARY}
                                onClick={() => update({ surfaces: {}, panelBlur: 0 })}>
                                {t("صفّر الأسطح", "Reset surfaces")}
                            </Button>
                        </div>
                    </>
                )}
            </Card>

            <Card index={4}
                title={t("صورة الخلفية", "Background image")}
                subtitle={t("من جهازك، ولا تُرفَع إلى أي مكان.", "From your machine, never uploaded anywhere.")}
                badge={background ? t("مختارة", "Chosen") : t("لا شيء", "None")}
                badgeTone={background ? "ok" : "info"}>

                <div className="esharq-tc-bg">
                    <div className="esharq-tc-bg-preview">
                        {background ? <img src={background} alt="" /> : <span>{t("لا صورة", "No image")}</span>}
                    </div>

                    <div className="esharq-tc-bg-side">
                        <p>{t("PNG أو JPG أو GIF أو WebP أو AVIF أو BMP، حتى ١٢ ميغابايت.",
                            "PNG, JPG, GIF, WebP, AVIF or BMP, up to 12 MB.")}</p>
                        <div className="esharq-tc-bg-buttons">
                            <Button size={Button.Sizes.SMALL} onClick={pickBackground}>
                                {background ? t("غيّر الصورة", "Change image") : t("اختر صورة", "Choose image")}
                            </Button>
                            {background && (
                                <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} look={Button.Looks.LINK} onClick={clearBackground}>
                                    {t("أزلها", "Remove")}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {background && (
                    <>
                        <Row label={t("الملاءمة", "Fit")}>
                            <Choices
                                value={state.background.fit}
                                options={[
                                    { key: "cover", ar: "املأ النافذة", en: "Fill" },
                                    { key: "contain", ar: "كاملة", en: "Contain" },
                                    { key: "tile", ar: "مكرّرة", en: "Tile" },
                                    { key: "stretch", ar: "ممطوطة", en: "Stretch" }
                                ] as const}
                                onChange={fit => update({ background: { ...state.background, fit } })}
                            />
                        </Row>

                        <Row label={t("الموضع", "Position")}>
                            <Choices
                                value={state.background.position}
                                options={[
                                    { key: "center", ar: "الوسط", en: "Centre" },
                                    { key: "top", ar: "الأعلى", en: "Top" },
                                    { key: "bottom", ar: "الأسفل", en: "Bottom" },
                                    { key: "left", ar: "اليسار", en: "Left" },
                                    { key: "right", ar: "اليمين", en: "Right" }
                                ] as const}
                                onChange={position => update({ background: { ...state.background, position } })}
                            />
                        </Row>

                        <Row label={t("التمويه", "Blur")}>
                            <ValueSlider value={state.background.blur} max={40} unit="px"
                                onChange={v => update({ background: { ...state.background, blur: v } })} />
                        </Row>

                        <Row label={t("التعتيم", "Dim")}>
                            <ValueSlider value={state.background.dim}
                                onChange={v => update({ background: { ...state.background, dim: v } })} />
                        </Row>

                        {(!state.glass || (state.surfaces.appFrame ?? 0) < 20) && (
                            <NoticeStrip>
                                {t("الصورة خلف واجهة معتمة الآن. فعّل «الوضع الزجاجي» وارفع شفافية «خلفية التطبيق» لتظهر.",
                                    "The image sits behind an opaque interface. Enable glass mode and raise “App backdrop” transparency to reveal it.")}
                            </NoticeStrip>
                        )}
                    </>
                )}
            </Card>

            <Card index={5}
                title={t("ألوان النصّ", "Text colours")}
                subtitle={t("تجاوزٌ اختياري — اتركه فارغاً ليتبع النصّ لونَ ثيمك.",
                    "Optional overrides — leave empty and text follows your theme colour.")}>
                {TEXT_TARGETS.map(target => (
                    <Row key={target.key} label={t(target.ar, target.en)}>
                        <div className="esharq-tc-text-control">
                            <ColorField
                                value={state.text[target.key] ?? ""}
                                fallback="ffffff"
                                onChange={value => update({ text: { ...state.text, [target.key]: value } })}
                            />
                            {parseHex(state.text[target.key] ?? "") !== null && (
                                <Button size={Button.Sizes.SMALL} look={Button.Looks.LINK} color={Button.Colors.PRIMARY}
                                    onClick={() => {
                                        const next = { ...state.text };
                                        delete next[target.key];
                                        update({ text: next });
                                    }}>
                                    {t("استعادة", "Reset")}
                                </Button>
                            )}
                        </div>
                    </Row>
                ))}
            </Card>

            <Card index={6}
                title={t("التدرّج", "Gradient")}
                subtitle={t("لونان يتدرّجان عبر النصّ الذي تختاره.", "Two colours blending across the text you choose.")}
                badge={state.gradient.enabled
                    ? t(`${state.gradient.targets.length} أهداف`, `${state.gradient.targets.length} targets`)
                    : t("مُطفأ", "Off")}
                badgeTone={state.gradient.enabled ? "warn" : "info"}>

                <Row label={t("فعّل التدرّج", "Enable gradient")}>
                    <Switch checked={state.gradient.enabled}
                        onChange={enabled => update({ gradient: { ...state.gradient, enabled } })} />
                </Row>

                {state.gradient.enabled && (
                    <>
                        <Row label={t("الأهداف", "Targets")}
                            hint={t("كلّها مُتحقَّقٌ من مطابقتها لعناصر موجودة فعلاً.", "Every one is verified to match real elements.")} />
                        <TargetGrid selected={state.gradient.targets}
                            onChange={targets => update({ gradient: { ...state.gradient, targets } })} />

                        <Row label={t("لون البداية", "Start colour")}>
                            <ColorField value={state.gradient.start} fallback="c9a227"
                                onChange={start => update({ gradient: { ...state.gradient, start } })} />
                        </Row>
                        <Row label={t("لون النهاية", "End colour")}>
                            <ColorField value={state.gradient.end} fallback="e3c25a"
                                onChange={end => update({ gradient: { ...state.gradient, end } })} />
                        </Row>
                        <Row label={t("الاتّجاه", "Direction")}>
                            <Choices value={state.gradient.direction} options={DIRECTIONS}
                                onChange={(direction: Direction) => update({ gradient: { ...state.gradient, direction } })} />
                        </Row>
                        <Row label={t("الحركة", "Motion")} hint={t("يُحرّك التدرّج عبر النصّ.", "Sweeps the gradient across the text.")}>
                            <Switch checked={state.gradient.motion}
                                onChange={motion => update({ gradient: { ...state.gradient, motion } })} />
                        </Row>

                        {state.gradient.motion && (
                            <>
                                <Row label={t("مدّة الدورة", "Cycle length")}>
                                    <ValueSlider value={state.gradient.speed} min={2} max={30} unit="s"
                                        onChange={speed => update({ gradient: { ...state.gradient, speed } })} />
                                </Row>
                                <Row
                                    label={t("سقف الإطارات", "Frame cap")}
                                    hint={t("الحركة تُكلّف معالجاً. اخفضه على جهازٍ ضعيف — يُحسّ فرقُ الأداء قبل أن يُرى فرقُ النعومة.",
                                        "Motion costs CPU. Lower it on a weak machine — the performance difference is felt before the smoothness difference is seen.")}>
                                    <ValueSlider value={state.gradient.fps} min={5} max={60} unit=" fps"
                                        onChange={fps => update({ gradient: { ...state.gradient, fps } })} />
                                </Row>
                            </>
                        )}

                        <div className="esharq-tc-preview gradient" style={{
                            backgroundImage: `linear-gradient(${state.gradient.direction}, #${parseHex(state.gradient.start) ?? "c9a227"}, #${parseHex(state.gradient.end) ?? "e3c25a"})`
                        }}>
                            {t("هكذا سيبدو النصّ", "This is how the text will look")}
                        </div>
                    </>
                )}
            </Card>

            <Card index={7}
                title={t("التوهّج", "Glow")}
                subtitle={t("هالةٌ حول الحروف — مستقلّة عن التدرّج.", "A halo around the letters — independent of the gradient.")}
                badge={state.glow.enabled
                    ? t(`${state.glow.targets.length} أهداف`, `${state.glow.targets.length} targets`)
                    : t("مُطفأ", "Off")}
                badgeTone={state.glow.enabled ? "warn" : "info"}>

                <Row label={t("فعّل التوهّج", "Enable glow")}>
                    <Switch checked={state.glow.enabled}
                        onChange={enabled => update({ glow: { ...state.glow, enabled } })} />
                </Row>

                {state.glow.enabled && (
                    <>
                        <Row label={t("الأهداف", "Targets")} />
                        <TargetGrid selected={state.glow.targets}
                            onChange={targets => update({ glow: { ...state.glow, targets } })} />

                        <Row label={t("اللون", "Colour")}>
                            <ColorField value={state.glow.color} fallback="c9a227"
                                onChange={color => update({ glow: { ...state.glow, color } })} />
                        </Row>
                        <Row label={t("القوّة", "Strength")}>
                            <ValueSlider value={state.glow.strength}
                                onChange={strength => update({ glow: { ...state.glow, strength } })} />
                        </Row>
                        <Row label={t("الانتشار", "Blur")}>
                            <ValueSlider value={state.glow.blur} min={2} max={40} unit="px"
                                onChange={blur => update({ glow: { ...state.glow, blur } })} />
                        </Row>
                        <Row label={t("النبض", "Pulse")}>
                            <Switch checked={state.glow.motion}
                                onChange={motion => update({ glow: { ...state.glow, motion } })} />
                        </Row>

                        {state.glow.motion && (
                            <>
                                <Row label={t("مدّة النبضة", "Pulse length")}>
                                    <ValueSlider value={state.glow.speed} min={2} max={30} unit="s"
                                        onChange={speed => update({ glow: { ...state.glow, speed } })} />
                                </Row>
                                <Row label={t("سقف الإطارات", "Frame cap")}>
                                    <ValueSlider value={state.glow.fps} min={5} max={60} unit=" fps"
                                        onChange={fps => update({ glow: { ...state.glow, fps } })} />
                                </Row>
                            </>
                        )}

                        <div className="esharq-tc-preview" style={{
                            color: `#${parseHex(state.glow.color) ?? "c9a227"}`,
                            textShadow: `0 0 ${state.glow.blur}px #${parseHex(state.glow.color) ?? "c9a227"}`
                        }}>
                            {t("هكذا سيبدو النصّ", "This is how the text will look")}
                        </div>
                    </>
                )}
            </Card>

            <Card index={8}
                title={t("الخطوط", "Typography")}
                subtitle={t("من خطوط جهازك وحدها — إشراق لا يُنزّل خطّاً أبداً.",
                    "From your own installed fonts only — Esharq never downloads a font.")}
                badge={String(interfaceChoices.length + monoChoices.length)}>

                <Row label={t("خطّ الواجهة", "Interface font")}>
                    <select
                        className="esharq-tc-select"
                        value={state.fonts.interface}
                        onChange={e => update({ fonts: { ...state.fonts, interface: e.currentTarget.value } })}>
                        <option value="">{t("خطّ ديسكورد", "Discord's own")}</option>
                        {interfaceChoices.map(family => <option key={family} value={family}>{family}</option>)}
                    </select>
                </Row>

                <Row label={t("الخطّ الأحادي", "Monospace font")} hint={t("للأكواد والمقاطع البرمجية.", "For code blocks and snippets.")}>
                    <select
                        className="esharq-tc-select"
                        value={state.fonts.mono}
                        onChange={e => update({ fonts: { ...state.fonts, mono: e.currentTarget.value } })}>
                        <option value="">{t("خطّ ديسكورد", "Discord's own")}</option>
                        {monoChoices.map(family => <option key={family} value={family}>{family}</option>)}
                    </select>
                </Row>

                <NoticeStrip>
                    {t("لا تُعرَض إلّا الخطوط المثبَّتة فعلاً على جهازك — فحصناها واحداً واحداً. والخطّ العربي يُضبَط في صفحة «اللغة» ولا يتأثّر بهذا.",
                        "Only fonts actually installed on your machine are listed — each one was checked. The Arabic font is set on the Language page and is unaffected here.")}
                </NoticeStrip>
            </Card>

            <Card index={9}
                title={t("احفظه ثيماً", "Save it as a theme")}
                subtitle={t("ملفّ CSS في مجلد ثيماتك — يبقى ويُشارَك ويعمل ولو أطفأت المنشئ.",
                    "A CSS file in your themes folder — it stays, it shares, and it works with the creator off.")}>

                <Row label={t("اسم الثيم", "Theme name")}>
                    <input
                        type="text"
                        className="esharq-tc-name"
                        value={themeName}
                        maxLength={60}
                        placeholder={t("ثيمي من إشراق", "My Esharq theme")}
                        onChange={e => setThemeName(e.currentTarget.value)}
                    />
                </Row>

                {notice && <NoticeStrip tone={notice.tone}>{notice.text}</NoticeStrip>}

                <div className="esharq-tc-actions">
                    <Button disabled={saving} onClick={saveTheme}>
                        {saving ? t("يحفظ…", "Saving…") : t("احفظ في مجلد الثيمات", "Save to themes folder")}
                    </Button>
                    <Button look={Button.Looks.LINK} color={Button.Colors.PRIMARY}
                        onClick={() => (window as any).VencordNative?.themeCreator?.openFolder?.()}>
                        {t("افتح المجلد", "Open folder")}
                    </Button>
                </div>

                <NoticeStrip>
                    {t("صورة الخلفية لا تدخل الملفّ — صورةٌ لا تُكتب نصّاً، وإدخالها يُضخّم ملفّاً يُفترَض أن يُشارَك. أمّا اللون والزجاج والتدرّج والتوهّج والخطوط فتدخل كلّها.",
                        "The background image is not in the file — an image can't be written as text, and embedding it bloats a file meant to be shared. Colour, glass, gradient, glow and fonts all go in.")}
                </NoticeStrip>
            </Card>

            {neutrals != null && (
                <Card index={10}
                    title={t("كيف يعمل", "How it works")}
                    subtitle={t("لأن ما لا يُفهَم لا يُوثَق به.", "Because what isn't understood isn't trusted.")}>
                    <div className="esharq-tc-how">
                        <div>{t(`① قرأنا سلّم ديسكورد الرمادي من أوراق أنماطه: ${neutrals.size} درجة.`,
                            `① We read Discord's grey ramp from its own stylesheets: ${neutrals.size} steps.`)}</div>
                        <div>{t("② كل خلفية وكل نصّ عنده مشتقٌّ من درجةٍ في هذا السلّم.",
                            "② Every background and every text colour it has derives from a step on that ramp.")}</div>
                        <div>{t("③ نُعيد بناء الدرجات من لونك، محافظين على فرق الإضاءة بين كل درجة والأساس.",
                            "③ We rebuild the steps from your colour, keeping each step's lightness gap from the base.")}</div>
                        <div>{t("④ فلا نلمس اسم صنفٍ واحد من أصناف ديسكورد — ولذلك لا يكسر تحديثُه ثيمَك.",
                            "④ So we touch none of Discord's class names — which is why its updates don't break your theme.")}</div>
                        <div>{t("⑤ والحركة تُلغى تلقائياً لمن فعّل «تقليل الحركة» في نظامه.",
                            "⑤ And motion switches itself off for anyone who enabled “reduce motion” in their system.")}</div>
                    </div>
                </Card>
            )}
        </>
    );
}

export function ThemeCreatorPage() {
    return (
        <ErrorBoundary>
            <ThemeCreatorPageInner />
        </ErrorBoundary>
    );
}
