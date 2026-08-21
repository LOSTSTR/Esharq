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
import { CatalogueTheme, installTheme, loadCatalogue } from "./themeLibrary/catalogue";

/**
 * **مكتبة الثيمات** — معرض BetterDiscord داخل إشراق.
 *
 * ## وأين تقف من صفحة «الثيمات»
 *
 * تلك تُدير **ما عندك**: تشغيلٌ وإطفاءٌ وروابطك. وهذه تُريك **ما لا تعرفه
 * بعد**، وتُثبّته بضغطة.
 *
 * ## 🔴 ولا حساب ولا تفويض
 *
 * نقرأ صفحةً عامّة ونُنزّل ملفّاً. لا تسجيل دخول، ولا إعجابات تُرسَل، ولا شيء
 * يُعرَف به مَن تصفّح. (مكتبةٌ أخرى في هذا المجال تطلب OAuth بصلاحيّتَي
 * `identify` و`connections` لتُسجّل الإعجابات — ثمنٌ لا يستحقّه تصفّحُ ثيمات.)
 *
 * ## وما يُثبَّت ليس منّا
 *
 * الثيمات من مؤلّفيها في المعرض، لا من إشراق. والصفحة تقول ذلك بوضوح: ثيمٌ
 * هو CSS يعمل داخل ديسكورد، ومن يُثبّته يثق بكاتبه.
 */

const NUMBER = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

type Busy = { id: number; } | null;
type Sort = "downloads" | "likes" | "name";

function ThemeLibraryPageInner() {
    const [themes, setThemes] = useState<CatalogueTheme[] | null>(null);
    const [failed, setFailed] = useState<"offline" | "http" | "shape" | null>(null);
    const [installed, setInstalled] = useState<Set<string>>(new Set());
    const [busy, setBusy] = useState<Busy>(null);
    const [notice, setNotice] = useState<{ tone: "info" | "danger"; text: string; } | null>(null);
    const [query, setQuery] = useState("");
    const [tag, setTag] = useState<string | null>(null);
    const [sort, setSort] = useState<Sort>("downloads");
    const [shownCount, setShownCount] = useState(24);

    const settings = useSettings(["enabledThemes"]);
    const started = useRef(false);

    async function refreshInstalled() {
        try {
            const list = await (window as any).VencordNative?.themes?.getThemesList?.();
            setInstalled(new Set((list ?? []).map((theme: any) => theme.fileName)));
        } catch { /* تُعرَض القائمة بلا حالة تثبيت */ }
    }

    async function refresh() {
        setThemes(null);
        setFailed(null);
        const loaded = await loadCatalogue();
        if (loaded.status === "ok") setThemes(loaded.themes);
        else setFailed(loaded.reason);
    }

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        refresh();
        refreshInstalled();
    }, []);

    /** أشهر الوسوم أوّلاً: المعرض فيه عشرات، وقائمةٌ بلا ترتيب لا تُقرأ. */
    const tags = useMemo(() => {
        const count = new Map<string, number>();
        for (const theme of themes ?? []) for (const value of theme.tags) count.set(value, (count.get(value) ?? 0) + 1);
        return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([value]) => value);
    }, [themes]);

    const shown = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const list = (themes ?? []).filter(theme => {
            if (tag !== null && !theme.tags.includes(tag)) return false;
            if (needle === "") return true;
            return `${theme.name} ${theme.description} ${theme.author} ${theme.tags.join(" ")}`
                .toLowerCase().includes(needle);
        });

        return [...list].sort((a, b) => {
            if (sort === "likes") return b.likes - a.likes;
            if (sort === "name") return a.name.localeCompare(b.name);
            return b.downloads - a.downloads;
        });
    }, [themes, query, tag, sort]);

    // البحث يبدأ من أوّل النتائج لا من حيث انتهى التمرير السابق.
    useEffect(() => setShownCount(24), [query, tag, sort]);

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

            const enabled: string[] = Settings.enabledThemes ?? [];
            if (!enabled.includes(outcome.fileName)) Settings.enabledThemes = [...enabled, outcome.fileName];

            await refreshInstalled();
            setNotice({
                tone: "info",
                text: t(`ثُبِّت «${theme.name}» وشُغِّل. تُطفئه من صفحة «الثيمات» متى شئت.`,
                    `“${theme.name}” is installed and on. Turn it off from the Themes page whenever you like.`)
            });
        } finally {
            setBusy(null);
        }
    }

    const badge = themes === null
        ? (failed ? { text: t("تعذّرت القراءة", "Unavailable"), tone: "danger" as const } : { text: t("يقرأ…", "Loading…"), tone: "info" as const })
        : { text: t(`${themes.length} ثيماً`, `${themes.length} themes`), tone: "ok" as const };

    return (
        <>
            <NoticeStrip>
                {t("هذه ثيمات مجتمع BetterDiscord، من مؤلّفيها لا من إشراق. والثيم ملفُّ CSS يعمل داخل ديسكورد — فمن يُثبّته يثق بكاتبه.",
                    "These are BetterDiscord community themes, from their authors and not from Esharq. A theme is a CSS file that runs inside Discord — installing one means trusting whoever wrote it.")}
            </NoticeStrip>

            <Card index={0}
                title={t("مكتبة الثيمات", "Theme Library")}
                subtitle={t("تصفّح ثيمات المجتمع وثبّتها بضغطة.", "Browse the community's themes and install one in a click.")}
                badge={badge.text} badgeTone={badge.tone}>

                <div className="esharq-tl-toolbar">
                    <input
                        type="search"
                        className="esharq-tl-search"
                        value={query}
                        placeholder={t("ابحث بالاسم أو المؤلّف أو الوصف…", "Search by name, author or description…")}
                        onChange={e => setQuery(e.currentTarget.value)}
                        aria-label={t("ابحث في المكتبة", "Search the library")}
                    />
                    <select
                        className="esharq-tl-sort"
                        value={sort}
                        onChange={e => setSort(e.currentTarget.value as Sort)}
                        aria-label={t("رتّب حسب", "Sort by")}>
                        <option value="downloads">{t("الأكثر تنزيلاً", "Most downloaded")}</option>
                        <option value="likes">{t("الأكثر إعجاباً", "Most liked")}</option>
                        <option value="name">{t("الاسم", "Name")}</option>
                    </select>
                    <Button size={Button.Sizes.SMALL} look={Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={() => { refresh(); refreshInstalled(); }}>
                        {t("حدّث", "Refresh")}
                    </Button>
                </div>

                {tags.length > 0 && (
                    <div className="esharq-tl-tags">
                        <button type="button" className={"esharq-tl-tag" + (tag === null ? " on" : "")} onClick={() => setTag(null)}>
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

                {themes !== null && (
                    <div className="esharq-tl-count">
                        {t(`${shown.length} نتيجة`, `${shown.length} results`)}
                    </div>
                )}

                {notice && <NoticeStrip tone={notice.tone}>{notice.text}</NoticeStrip>}
            </Card>

            {themes === null && failed === null && (
                <Card index={1} title={t("يقرأ المعرض…", "Reading the gallery…")} />
            )}

            {failed !== null && (
                <Card index={1}
                    title={t("تعذّر فتح المعرض", "Couldn't open the gallery")}
                    subtitle={failed === "shape"
                        ? t("المعرض فُتح لكنّ شكل صفحته تغيّر، فلم نتعرّف على ثيماته.",
                            "The gallery opened but its page shape changed, so we couldn't read its themes.")
                        : t("لم يُجب المعرض. تحقّق من اتّصالك ثم أعد المحاولة.",
                            "The gallery didn't answer. Check your connection and try again.")}
                    badge={t("خطأ", "Error")} badgeTone="danger">
                    <Button onClick={() => { refresh(); refreshInstalled(); }}>{t("أعد المحاولة", "Try again")}</Button>
                </Card>
            )}

            {themes !== null && (
                <>
                    <div className="esharq-tl-grid">
                        {shown.slice(0, shownCount).map((theme, i) => {
                            const isInstalled = installed.has(theme.file);
                            const isOn = (settings.enabledThemes ?? []).includes(theme.file);

                            return (
                                <div key={theme.id} className="esharq-tl-card esharq-rise" style={stagger(Math.min(i, 12), 5)}>
                                    <div className="esharq-tl-shot">
                                        <img src={theme.thumbnail} alt="" loading="lazy" />
                                    </div>

                                    <div className="esharq-tl-body">
                                        <div className="esharq-tl-name">{theme.name}</div>
                                        {/* بعض المؤلّفين لا تُعرَّف أسماؤهم في صفحة المعرض أصلاً؛
                                            وسطرُ «بواسطة» بلا اسمٍ أسوأ من غيابه. */}
                                        {theme.author !== "" && (
                                            <div className="esharq-tl-author">{t("بواسطة", "by")} {theme.author}</div>
                                        )}
                                        <p className="esharq-tl-desc">{theme.description}</p>

                                        <div className="esharq-tl-chips">
                                            {theme.tags.slice(0, 4).map(value => (
                                                <span key={value} className="esharq-tl-chip">{value}</span>
                                            ))}
                                        </div>

                                        <div className="esharq-tl-meta">
                                            <span title={t("تنزيلات", "Downloads")}>⭳ {NUMBER.format(theme.downloads)}</span>
                                            <span title={t("إعجابات", "Likes")}>♥ {NUMBER.format(theme.likes)}</span>
                                        </div>

                                        <div className="esharq-tl-actions">
                                            {isInstalled ? (
                                                <span className={"esharq-tl-state" + (isOn ? " on" : "")}>
                                                    {isOn ? t("مثبَّت ويعمل", "Installed and on") : t("مثبَّت — مُطفأ", "Installed — off")}
                                                </span>
                                            ) : (
                                                <Button size={Button.Sizes.SMALL} disabled={busy?.id === theme.id} onClick={() => install(theme)}>
                                                    {busy?.id === theme.id ? t("يُثبِّت…", "Installing…") : t("ثبّته", "Install")}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {shown.length === 0 && (
                            <div className="esharq-tl-none">{t("لا ثيم يطابق بحثك.", "No theme matches your search.")}</div>
                        )}
                    </div>

                    {/* عرضٌ تدريجيّ: مئات البطاقات دفعةً واحدة تُثقل الصفحة بلا داعٍ. */}
                    {shown.length > shownCount && (
                        <div className="esharq-tl-more">
                            <Button onClick={() => setShownCount(n => n + 24)}>
                                {t(`اعرض المزيد (${shown.length - shownCount})`, `Show more (${shown.length - shownCount})`)}
                            </Button>
                        </div>
                    )}
                </>
            )}

            <Card index={2}
                title={t("قبل أن تُثبّت", "Before you install")}
                subtitle={t("لأن ما لا يُعرَف مصدره لا يُثبَّت.", "Because you shouldn't install what you can't trace.")}>
                <div className="esharq-tl-how">
                    <div>{t("① الثيمات من مجتمع BetterDiscord، وكلٌّ منها من مؤلّفه. إشراق يعرضها ويُنزّلها ولا يكتبها ولا يراجعها.",
                        "① The themes come from the BetterDiscord community, each from its own author. Esharq lists and downloads them; it doesn't write or review them.")}</div>
                    <div>{t("② والثيم ملفُّ CSS: يُغيّر الشكل ولا يقرأ رسائلك ولا يصل حسابك.",
                        "② A theme is a CSS file: it changes appearance, and cannot read your messages or reach your account.")}</div>
                    <div>{t("③ وما تُثبّته يصير ملفّاً في مجلد ثيماتك، تُعدّله أو تحذفه من صفحة «الثيمات».",
                        "③ What you install becomes a file in your themes folder — edit or delete it from the Themes page.")}</div>
                    <div>{t("④ ولا يُرسَل شيء عنك: لا تسجيل دخول، ولا إعجاب يُسجَّل، ولا أثر لمن تصفّح.",
                        "④ And nothing about you is sent: no sign-in, no like recorded, no trace of who browsed.")}</div>
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
