/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./themeLibrary.css";

import { Settings, useSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { t } from "@utils/esharqI18n";
import { Button, useEffect, useMemo, useRef, useState } from "@webpack/common";

import { Card, NoticeStrip } from "./Card";
import { stagger } from "./motion";
import { NeutralMap, Palette, previewPalette } from "./themeCreator/engine";
import { loadNeutrals } from "./themeCreator/state";
import { Catalogue, CatalogueTheme, installTheme, loadCatalogue } from "./themeLibrary/catalogue";

/**
 * **مكتبة الثيمات** — تصفّح ثيماتٍ جاهزة وثبّتها بضغطة.
 *
 * ## وأين تقف من صفحة «الثيمات»
 *
 * تلك تُدير **ما عندك**: تشغيل وإطفاء وروابطك الخاصّة. وهذه تُريك **ما لا
 * تعرفه بعد**. ولو خلطناهما لصارت صفحةٌ واحدة تفعل شيئين نصفَ فعل.
 *
 * ## 🔴 والمعاينة محسوبة لا مصوَّرة
 *
 * لا لقطةَ شاشةٍ لأي ثيم هنا. بل تُحسَب ألوانه **بنفس رياضيات التطبيق**:
 * فرقُ إضاءة كل درجة عن الأساس يُضاف إلى إضاءة لون الثيم. فما تراه في البطاقة
 * هو اللون الذي سيظهر عندك بعد التثبيت، لا صورةٌ قد تكون قديمة أو من جهازٍ آخر.
 *
 * ## ولا حساب ولا تفويض
 *
 * المكتبة تقرأ ملفّاً عامّاً وتُنزّل ملفّاً. لا تسجيل دخول، ولا إعجابات،
 * ولا شيء يُعرَف به مَن تصفّح. التفصيل في `themeLibrary/catalogue.ts`.
 */

function MiniPreview({ palette }: { palette: Palette; }) {
    // مُحاكاةٌ صغيرة لتخطيط ديسكورد: سكّة، ثم قائمة، ثم محادثة.
    return (
        <div className="esharq-tl-preview" style={{ background: palette.app }} aria-hidden="true">
            <div className="esharq-tl-rail" style={{ background: palette.app }}>
                <span style={{ background: palette.accent }} />
                <span style={{ background: palette.raised }} />
                <span style={{ background: palette.raised }} />
            </div>
            <div className="esharq-tl-side" style={{ background: palette.sidebar }}>
                <i style={{ background: palette.muted }} />
                <i style={{ background: palette.muted, width: "62%" }} />
                <i style={{ background: palette.raised, width: "78%" }} />
                <i style={{ background: palette.muted, width: "48%" }} />
            </div>
            <div className="esharq-tl-chat" style={{ background: palette.app }}>
                <b style={{ background: palette.text }} />
                <i style={{ background: palette.muted }} />
                <i style={{ background: palette.muted, width: "70%" }} />
                <b style={{ background: palette.accent, width: "36%" }} />
                <i style={{ background: palette.muted, width: "55%" }} />
            </div>
        </div>
    );
}

type Busy = { id: string; } | null;

function ThemeLibraryPageInner() {
    const [result, setResult] = useState<"loading" | "empty" | "error" | Catalogue>("loading");
    const [neutrals, setNeutrals] = useState<NeutralMap | null>(null);
    const [installed, setInstalled] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState<Busy>(null);
    const [notice, setNotice] = useState<{ tone: "info" | "danger"; text: string; } | null>(null);
    const [query, setQuery] = useState("");
    const [tag, setTag] = useState<string | null>(null);
    const [sort, setSort] = useState<"name" | "newest" | "size">("name");

    const settings = useSettings(["enabledThemes"]);
    const started = useRef(false);

    async function refreshInstalled() {
        try {
            const list = await (window as any).VencordNative?.themes?.getThemesList?.();
            setInstalled(new Set((list ?? []).map((theme: any) => theme.fileName)));
        } catch { /* القائمة تُعرَض بلا حالة تثبيت */ }
    }

    async function refreshCatalogue() {
        setResult("loading");
        const loaded = await loadCatalogue();
        setResult(loaded.status === "ok" ? loaded.catalogue : loaded.status);
    }

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        loadNeutrals().then(setNeutrals).catch(() => setNeutrals(new Map()));
        refreshCatalogue();
        refreshInstalled();
    }, []);

    const catalogue = typeof result === "object" ? result : null;

    const tags = useMemo(() => {
        const set = new Set<string>();
        for (const theme of catalogue?.themes ?? []) for (const value of theme.tags) set.add(value);
        return [...set].sort();
    }, [catalogue]);

    const shown = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const list = (catalogue?.themes ?? []).filter(theme => {
            if (tag !== null && !theme.tags.includes(tag)) return false;
            if (needle === "") return true;
            return `${theme.name.ar} ${theme.name.en} ${theme.description.ar} ${theme.description.en} ${theme.author}`
                .toLowerCase().includes(needle);
        });

        // نسخةٌ قبل الترتيب: `sort` تُغيّر المصفوفة في مكانها، وهي هنا نتيجةُ
        // `filter` فمِلكُنا — لكن الترتيب على مصفوفةٍ مشتركة يُفسد المصدر.
        return [...list].sort((a, b) => {
            if (sort === "size") return b.bytes - a.bytes;
            if (sort === "newest") return b.id.localeCompare(a.id);
            return a.name.en.localeCompare(b.name.en);
        });
    }, [catalogue, query, tag, sort]);

    async function install(theme: CatalogueTheme) {
        setBusy({ id: theme.id });
        setNotice(null);
        try {
            const outcome = await installTheme(theme);
            if (!outcome.ok) {
                const messages: Record<string, string> = {
                    download: t("تعذّر تنزيل الثيم. تحقّق من اتّصالك.", "Couldn't download the theme. Check your connection."),
                    empty: t("الملفّ فارغ — لم يُثبَّت شيء.", "The file is empty — nothing was installed."),
                    save: t("تعذّرت الكتابة في مجلد الثيمات. أعد تشغيل ديسكورد إن كنت قد حدّثت إشراق للتوّ.",
                        "Couldn't write to your themes folder. Restart Discord if you just updated Esharq.")
                };
                setNotice({ tone: "danger", text: messages[outcome.reason] });
                return;
            }

            // التثبيت وحده لا يُشغّل الثيم؛ والتشغيل هو ما جاء المستخدم لأجله.
            const enabled: string[] = Settings.enabledThemes ?? [];
            if (!enabled.includes(outcome.fileName)) Settings.enabledThemes = [...enabled, outcome.fileName];

            await refreshInstalled();
            setNotice({
                tone: "info",
                text: t(`ثُبِّت «${theme.name.ar}» وشُغِّل. تُطفئه من صفحة «الثيمات» متى شئت.`,
                    `“${theme.name.en}” is installed and on. Turn it off from the Themes page whenever you like.`)
            });
        } finally {
            setBusy(null);
        }
    }

    const stateBadge = result === "loading"
        ? { text: t("يقرأ…", "Loading…"), tone: "info" as const }
        : catalogue
            ? { text: t(`${catalogue.themes.length} ثيماً`, `${catalogue.themes.length} themes`), tone: "ok" as const }
            : { text: t("فارغة", "Empty"), tone: "warn" as const };

    return (
        <>
            <NoticeStrip>
                {t("هذه المكتبة تقرأ ملفّاً عامّاً وتُنزّل ملفّاً — بلا تسجيل دخول ولا حساب ولا إعجابات، ولا شيء يُعرَف به من تصفّح.",
                    "This library reads a public file and downloads a file — no sign-in, no account, no likes, and nothing that identifies who browsed.")}
            </NoticeStrip>

            <Card index={0}
                title={t("مكتبة الثيمات", "Theme Library")}
                subtitle={t("ثيمات جاهزة من إشراق — عاينها ثم ثبّتها بضغطة.",
                    "Ready-made themes from Esharq — preview one, then install it in a click.")}
                badge={stateBadge.text} badgeTone={stateBadge.tone}>

                <div className="esharq-tl-toolbar">
                    <input
                        type="search"
                        className="esharq-tl-search"
                        value={query}
                        placeholder={t("ابحث بالاسم أو الوصف…", "Search by name or description…")}
                        onChange={e => setQuery(e.currentTarget.value)}
                        aria-label={t("ابحث في المكتبة", "Search the library")}
                    />
                    <select
                        className="esharq-tl-sort"
                        value={sort}
                        onChange={e => setSort(e.currentTarget.value as typeof sort)}
                        aria-label={t("رتّب حسب", "Sort by")}>
                        <option value="name">{t("الاسم", "Name")}</option>
                        <option value="newest">{t("الأحدث", "Newest")}</option>
                        <option value="size">{t("الحجم", "Size")}</option>
                    </select>
                    <Button size={Button.Sizes.SMALL} look={Button.Looks.LINK} color={Button.Colors.PRIMARY}
                        onClick={() => { refreshCatalogue(); refreshInstalled(); }}>
                        {t("حدّث", "Refresh")}
                    </Button>
                </div>

                {tags.length > 0 && (
                    <div className="esharq-tl-tags">
                        <button type="button" className={"esharq-tl-tag" + (tag === null ? " on" : "")}
                            onClick={() => setTag(null)}>
                            {t("الكلّ", "All")}
                        </button>
                        {tags.map(value => (
                            <button key={value} type="button"
                                className={"esharq-tl-tag" + (tag === value ? " on" : "")}
                                onClick={() => setTag(tag === value ? null : value)}>
                                {value}
                            </button>
                        ))}
                    </div>
                )}

                {notice && <NoticeStrip tone={notice.tone}>{notice.text}</NoticeStrip>}
            </Card>

            {result === "loading" && (
                <Card index={1} title={t("يقرأ الفهرس…", "Reading the index…")} />
            )}

            {result === "empty" && (
                <Card index={1}
                    title={t("المكتبة فارغة بعد", "The library is empty for now")}
                    subtitle={t("لم يُنشَر فهرس الثيمات بعد.", "The theme index has not been published yet.")}>
                    <div className="esharq-tl-empty">
                        {t("الصفحة تعمل وتنتظر الفهرس. وحين يُنشَر تظهر الثيمات هنا بلا تحديثٍ للعميل — تماماً كالشارات.",
                            "The page works and is waiting for the index. Once it is published the themes appear here with no client update — exactly like the badges.")}
                    </div>
                </Card>
            )}

            {result === "error" && (
                <Card index={1}
                    title={t("تعذّر قراءة المكتبة", "Couldn't read the library")}
                    subtitle={t("لا شيء تعطّل عندك — المصدر لم يُجب.", "Nothing broke on your side — the source didn't answer.")}
                    badge={t("خطأ", "Error")} badgeTone="danger">
                    <Button onClick={() => { refreshCatalogue(); refreshInstalled(); }}>
                        {t("أعد المحاولة", "Try again")}
                    </Button>
                </Card>
            )}

            {catalogue && (
                <div className="esharq-tl-grid">
                    {shown.map((theme, i) => {
                        const palette = neutrals != null
                            ? previewPalette(neutrals, theme.color.replace("#", ""))
                            : null;
                        const fileName = theme.file;
                        const isInstalled = installed.has(fileName);
                        const isOn = (settings.enabledThemes ?? []).includes(fileName);

                        return (
                            <div key={theme.id} className="esharq-tl-card esharq-rise" style={stagger(i, 6)}>
                                {palette
                                    ? <MiniPreview palette={palette} />
                                    : <div className="esharq-tl-preview flat" style={{ background: theme.color }} />}

                                <div className="esharq-tl-body">
                                    <div className="esharq-tl-head">
                                        <div className="esharq-tl-name">{t(theme.name.ar, theme.name.en)}</div>
                                        <span className="esharq-tl-swatch" style={{ background: theme.color }} title={theme.color} />
                                    </div>
                                    <div className="esharq-tl-author">{t("بواسطة", "by")} {theme.author}</div>
                                    <p className="esharq-tl-desc">{t(theme.description.ar, theme.description.en)}</p>

                                    <div className="esharq-tl-chips">
                                        {theme.tags.map(value => <span key={value} className="esharq-tl-chip">{value}</span>)}
                                    </div>

                                    <div className="esharq-tl-meta">
                                        <span>v{theme.version}</span>
                                        <span>{(theme.bytes / 1024).toFixed(0)} KB</span>
                                    </div>

                                    <div className="esharq-tl-actions">
                                        {isInstalled ? (
                                            <span className={"esharq-tl-state" + (isOn ? " on" : "")}>
                                                {isOn ? t("مثبَّت ويعمل", "Installed and on") : t("مثبَّت — مُطفأ", "Installed — off")}
                                            </span>
                                        ) : (
                                            <Button
                                                size={Button.Sizes.SMALL}
                                                disabled={busy?.id === theme.id}
                                                onClick={() => install(theme)}>
                                                {busy?.id === theme.id ? t("يُثبِّت…", "Installing…") : t("ثبّته", "Install")}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {shown.length === 0 && (
                        <div className="esharq-tl-none">
                            {t("لا ثيم يطابق بحثك.", "No theme matches your search.")}
                        </div>
                    )}
                </div>
            )}

            <Card index={2}
                title={t("من أين تأتي هذه الثيمات", "Where these themes come from")}
                subtitle={t("لأن ما لا يُعرَف مصدره لا يُثبَّت.", "Because you shouldn't install what you can't trace.")}>
                <div className="esharq-tl-how">
                    <div>{t("① كلّها من إشراق: نختار لوناً، ويُبنى الباقي بنفس محرّك «منشئ الثيمات».",
                        "① All of them are ours: we pick a colour, and the rest is built by the same engine as the Theme Creator.")}</div>
                    <div>{t("② لا ننشر عمل غيرنا هنا بلا رخصةٍ نعرفها — لإضافة ثيمٍ من الشبكة استعمل «الثيمات» بالرابط.",
                        "② We don't republish other people's work here without a licence we know — to add a theme from the web, use the Themes page and its link field.")}</div>
                    <div>{t("③ والمعاينة أعلاه محسوبة لا مصوَّرة: هي اللون الذي سيظهر عندك بالضبط.",
                        "③ And the preview above is computed, not photographed: it is exactly the colour you will get.")}</div>
                    <div>{t("④ وما تُثبّته يصير ملفّاً في مجلد ثيماتك، تُعدّله أو تحذفه كما تشاء.",
                        "④ What you install becomes a file in your themes folder — edit it or delete it as you like.")}</div>
                </div>
            </Card>
        </>
    );
}

export function ThemeLibraryPage() {
    return (
        <ErrorBoundary>
            <ThemeLibraryPageInner />
        </ErrorBoundary>
    );
}
