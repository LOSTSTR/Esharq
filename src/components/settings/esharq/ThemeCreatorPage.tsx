/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./themeCreator.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { Switch } from "@components/Switch";
import { t } from "@utils/esharqI18n";
import { Button, Slider, useEffect, useMemo, useRef, UserStore, useState } from "@webpack/common";

import { Card, NoticeStrip } from "./Card";
import { stagger } from "./motion";
import {
    checkContrast,
    hexToHsl,
    NeutralMap,
    parseHex,
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
 * **منشئ الثيمات** — لونٌ واحد يُعيد صبغ ديسكورد كلّه، وشفافيةٌ لكل سطح،
 * وصورة خلفية، وملفُّ ثيمٍ يخرج من كل ذلك.
 *
 * ## لماذا لونٌ واحد يكفي
 *
 * ديسكورد يبني كل خلفيّاته ونصوصه من سلّمٍ رماديّ من مئة درجة. فبدل أن نطارد
 * أصنافه واحداً واحداً — وهي تتغيّر مع كل تحديث — نُعيد تعريف السلّم نفسه
 * محافظين على فروق الإضاءة بين درجاته. الشرح الكامل في `themeCreator/engine.ts`.
 *
 * ## وماذا يفعل «تصدير»
 *
 * يكتب ملفّ `.css` في مجلد الثيمات فيظهر في صفحة «الثيمات» كأيّ ثيم. وهذا
 * الفرق بين منشئ ثيمات ومجرّد مبدّل لون: ما تصنعه يبقى، ويُشارَك، ويعمل ولو
 * أطفأتَ المنشئ.
 */

/* ── لبنات صغيرة ─────────────────────────────────────────────────────────── */

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode; }) {
    return (
        <div className="esharq-tc-row">
            <div className="esharq-tc-row-text">
                <div className="esharq-tc-row-label">{label}</div>
                {hint !== undefined && <div className="esharq-tc-row-hint">{hint}</div>}
            </div>
            <div className="esharq-tc-row-control">{children}</div>
        </div>
    );
}

/**
 * مِقبض نسبة مع قيمته مكتوبة.
 *
 * `onValueRender` يُظهر الرقم على المِقبض نفسه أثناء السحب: الشفافية لا
 * يُحسّ فرقُ خمسة بالمئة فيها بالعين، فالرقم هو ما يُطمئن الساحب أنّه يتحرّك.
 */
function PercentSlider({ value, onChange, max = 100, unit = "%" }: {
    value: number;
    onChange: (v: number) => void;
    max?: number;
    unit?: string;
}) {
    return (
        <Slider
            initialValue={value}
            minValue={0}
            maxValue={max}
            markers={[0, max / 4, max / 2, (max * 3) / 4, max]}
            stickToMarkers={false}
            onValueChange={v => onChange(Math.round(v))}
            onValueRender={v => `${Math.round(v)}${unit}`}
            className="esharq-tc-slider"
        />
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

    /** لا يُجلب السلّم إلّا مرّة، وقراءته أربعة ميغابايت. */
    const loading = useRef(false);
    useEffect(() => {
        if (loading.current) return;
        loading.current = true;
        loadNeutrals().then(setNeutrals).catch(() => setNeutrals(new Map()));

        // الخلفية المحفوظة تُقرأ لتظهر معاينتها ولو لم يُعد الإقلاع بعدُ.
        if (state.background.enabled) {
            (window as any).VencordNative?.themeCreator?.getBackground?.()
                .then((r: any) => { if (r?.ok && r.dataUrl) setBackground(r.dataUrl); })
                .catch(() => { /* الألوان تعمل بدونها */ });
        }
    }, []);

    /** الوضع الحالي عند ديسكورد — يُقرأ من جذر المستند لا من إعداداتنا. */
    const isLight = useMemo(() => document.documentElement.classList.contains("theme-light"), [state.enabled]);

    const hex = parseHex(state.color) ?? DEFAULT_STATE.color;
    const verdict = checkContrast(hex, isLight);

    /** كل تغيير: يُحفَظ ويُطبَّق فوراً — التغيير الذي لا يُرى لا يُختار بوعي. */
    function update(next: Partial<ThemeCreatorState>) {
        setState(prev => {
            const merged = { ...prev, ...next };
            writeState(merged);
            if (neutrals != null) applyTheme({ state: merged, neutrals, backgroundDataUrl: background });
            return merged;
        });
    }

    function updateSurface(key: string, value: number) {
        update({ surfaces: { ...state.surfaces, [key]: value } });
    }

    function setEnabled(enabled: boolean) {
        if (!enabled) removeTheme();
        update({ enabled });
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
        const merged: ThemeCreatorState = {
            ...state,
            enabled: true,
            background: { ...state.background, enabled: true }
        };
        writeState(merged);
        setState(merged);
        if (neutrals != null) applyTheme({ state: merged, neutrals, backgroundDataUrl: picked.dataUrl });
    }

    async function clearBackground() {
        await (window as any).VencordNative?.themeCreator?.clearBackground?.().catch(() => { /* لا شيء */ });
        setBackground(null);
        update({ background: { ...state.background, enabled: false } });
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
                        : t("تعذّر الحفظ.", "Couldn't save.")
                });
            }
        } finally {
            setSaving(false);
        }
    }

    const activeSurfaces = SURFACES.filter(s => (state.surfaces[s.key] ?? 0) > 0).length;
    const hsl = hexToHsl(hex);

    return (
        <>
            <NoticeStrip>
                {t("لونٌ واحد يُعيد صبغ ديسكورد كلّه: خلفياته وأسطحه ونصوصه مبنيّةٌ على سلّمٍ رمادي واحد، ونحن نُعيد تعريف السلّم ونحفظ فروق الإضاءة بين درجاته — فيتغيّر اللون ويبقى النصّ مقروءاً.",
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

                {verdict !== "fine" && (
                    <NoticeStrip tone="danger">
                        {verdict === "wrong-mode"
                            ? t(`هذا اللون ${isLight ? "داكنٌ على وضعٍ فاتح" : "فاتحٌ على وضعٍ داكن"} — سيصعب قراءة النصّ. بدّل وضع ديسكورد من إعداداته، أو اختر لوناً ${isLight ? "أفتح" : "أغمق"}.`,
                                `This colour is ${isLight ? "dark on a light mode" : "light on a dark mode"} — text will be hard to read. Switch Discord's mode in its own settings, or pick a ${isLight ? "lighter" : "darker"} colour.`)
                            : t("هذا اللون في منتصف المدى، فلا يصلح لوضعٍ داكن ولا فاتح. اختر لوناً أغمق أو أفتح بوضوح.",
                                "This colour sits mid-range, so it suits neither dark nor light mode. Pick something clearly darker or lighter.")}
                    </NoticeStrip>
                )}
            </Card>

            <Card index={2}
                title={t("الزجاج والأسطح", "Glass and surfaces")}
                subtitle={t("تحكّم بقوّة ظهور ما خلف كل جزء — بلا إبهات النصّ.",
                    "Control how much shows through each part — without fading the text.")}
                badge={activeSurfaces > 0 ? t(`${activeSurfaces} سطحاً`, `${activeSurfaces} surfaces`) : t("لا شيء", "None")}
                badgeTone={activeSurfaces > 0 ? "warn" : "info"}>

                <div className="esharq-tc-quick">
                    {([
                        { key: "solid", ar: "صلب", en: "Solid", value: 0, hintAr: "أعلى تباين", hintEn: "Maximum contrast" },
                        { key: "balanced", ar: "متوازن", en: "Balanced", value: 25, hintAr: "واضح ومقروء", hintEn: "Clear and readable" },
                        { key: "open", ar: "منفتح", en: "Open", value: 55, hintAr: "خلفيةٌ أظهر", hintEn: "More backdrop" }
                    ] as const).map(preset => (
                        <button
                            key={preset.key}
                            type="button"
                            className="esharq-tc-quick-btn"
                            onClick={() => update({
                                surfaces: Object.fromEntries(SURFACES.map(s => [s.key, preset.value]))
                            })}>
                            <span className="esharq-tc-quick-name">{t(preset.ar, preset.en)}</span>
                            <span className="esharq-tc-quick-hint">{t(preset.hintAr, preset.hintEn)}</span>
                        </button>
                    ))}
                </div>

                <Row
                    label={t("كل الأسطح", "All surfaces")}
                    hint={t("يضبط الأسطح السبعة معاً.", "Sets all seven together.")}>
                    <PercentSlider
                        value={SURFACES.every(s => (state.surfaces[s.key] ?? 0) === (state.surfaces[SURFACES[0].key] ?? 0))
                            ? (state.surfaces[SURFACES[0].key] ?? 0) : 0}
                        onChange={v => update({ surfaces: Object.fromEntries(SURFACES.map(s => [s.key, v])) })}
                    />
                </Row>

                <Row
                    label={t("تمويه اللوحات", "Panel blur")}
                    hint={t("يُنعّم ما يظهر خلف الأسطح الشفّافة.", "Softens whatever shows through.")}>
                    <PercentSlider value={state.panelBlur} max={40} unit="px" onChange={v => update({ panelBlur: v })} />
                </Row>

                <div className="esharq-tc-surfaces">
                    {SURFACES.map((surface, i) => (
                        <div key={surface.key} className="esharq-tc-surface esharq-rise" style={stagger(i, 5)}>
                            <div className="esharq-tc-surface-head">
                                <span>{t(surface.ar, surface.en)}</span>
                                <span className="esharq-tc-surface-value">{state.surfaces[surface.key] ?? 0}%</span>
                            </div>
                            <PercentSlider
                                value={state.surfaces[surface.key] ?? 0}
                                onChange={v => updateSurface(surface.key, v)}
                            />
                        </div>
                    ))}
                </div>
            </Card>

            <Card index={3}
                title={t("صورة الخلفية", "Background image")}
                subtitle={t("من جهازك، ولا تُرفَع إلى أي مكان.", "From your machine, never uploaded anywhere.")}
                badge={background ? t("مختارة", "Chosen") : t("لا شيء", "None")}
                badgeTone={background ? "ok" : "info"}>

                <div className="esharq-tc-bg">
                    <div className="esharq-tc-bg-preview">
                        {background
                            ? <img src={background} alt="" />
                            : <span>{t("لا صورة", "No image")}</span>}
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
                            <div className="esharq-tc-choices">
                                {([
                                    { key: "cover", ar: "املأ النافذة", en: "Fill" },
                                    { key: "contain", ar: "أظهرها كاملة", en: "Contain" },
                                    { key: "tile", ar: "كرّرها", en: "Tile" },
                                    { key: "stretch", ar: "مطّها", en: "Stretch" }
                                ] as const).map(option => (
                                    <button
                                        key={option.key}
                                        type="button"
                                        className={"esharq-tc-choice" + (state.background.fit === option.key ? " on" : "")}
                                        onClick={() => update({ background: { ...state.background, fit: option.key } })}>
                                        {t(option.ar, option.en)}
                                    </button>
                                ))}
                            </div>
                        </Row>

                        <Row label={t("التمويه", "Blur")}>
                            <PercentSlider
                                value={state.background.blur} max={40} unit="px"
                                onChange={v => update({ background: { ...state.background, blur: v } })}
                            />
                        </Row>

                        <Row label={t("التعتيم", "Dim")}>
                            <PercentSlider
                                value={state.background.dim}
                                onChange={v => update({ background: { ...state.background, dim: v } })}
                            />
                        </Row>

                        {(state.surfaces.appFrame ?? 0) < 20 && (
                            <NoticeStrip>
                                {t("الصورة خلف واجهة معتمة الآن. ارفع شفافية «خلفية التطبيق» في القسم أعلاه لتظهر.",
                                    "The image sits behind an opaque interface. Raise “App backdrop” transparency above to reveal it.")}
                            </NoticeStrip>
                        )}
                    </>
                )}
            </Card>

            <Card index={4}
                title={t("ألوان النصّ", "Text colours")}
                subtitle={t("تجاوزٌ اختياري — اتركه فارغاً ليتبع النصّ لونَ ثيمك.",
                    "Optional overrides — leave empty and text follows your theme colour.")}>
                {TEXT_TARGETS.map(target => (
                    <Row key={target.key} label={t(target.ar, target.en)}>
                        <div className="esharq-tc-text-control">
                            <input
                                type="color"
                                className="esharq-tc-picker"
                                value={`#${parseHex(state.text[target.key] ?? "") ?? "ffffff"}`}
                                onChange={e => update({ text: { ...state.text, [target.key]: e.currentTarget.value.replace("#", "") } })}
                                aria-label={t(target.ar, target.en)}
                            />
                            {parseHex(state.text[target.key] ?? "") !== null && (
                                <Button
                                    size={Button.Sizes.SMALL}
                                    look={Button.Looks.LINK}
                                    color={Button.Colors.PRIMARY}
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

            <Card index={5}
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
                    <Button
                        look={Button.Looks.LINK}
                        color={Button.Colors.PRIMARY}
                        onClick={() => (window as any).VencordNative?.themeCreator?.openFolder?.()}>
                        {t("افتح المجلد", "Open folder")}
                    </Button>
                </div>

                <NoticeStrip>
                    {t("صورة الخلفية لا تدخل الملفّ — صورةٌ لا تُكتب نصّاً، وإدخالها يُضخّم ملفّاً يُفترَض أن يُشارَك. الألوان والشفافية تدخل كلّها.",
                        "The background image is not in the file — an image can't be written as text, and embedding it bloats a file meant to be shared. Colours and transparency all go in.")}
                </NoticeStrip>
            </Card>

            {neutrals != null && (
                <Card index={6}
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
