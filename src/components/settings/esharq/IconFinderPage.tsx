/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./iconFinder.css";

import ErrorBoundary from "@components/ErrorBoundary";
import * as Icons from "@components/Icons";
import { copyToClipboard } from "@utils/clipboard";
import { t } from "@utils/esharqI18n";
import { Toasts, useMemo, useState } from "@webpack/common";

import { Card, NoticeStrip } from "./Card";
import { stagger } from "./motion";
import { UNIT } from "./tokens";

/**
 * **باحث الأيقونات** — كل أيقونة يملكها إشراق، مرئيّةً وقابلةً للنسخ.
 *
 * صار له معنى حين صارت **إضافات المجتمع** ممكنة: من يكتب إضافةً يحتاج أيقونة،
 * فإمّا أن يقرأ ملفّ أيقونات بألفَي سطر ليعرف ما فيه، أو يراها هنا ويأخذ سطر
 * الاستيراد بنقرة. والثاني هو ما تفعله هذه الصفحة.
 *
 * 🔴 والقائمة **تُشتقّ من الوحدة نفسها** لا تُكتب يدوياً: كل ما يُصدَّر من
 * `@components/Icons` ويصلح مكوّناً يظهر هنا. فأي أيقونة تُضاف غداً تظهر بلا
 * أن يتذكّر أحد تحديث قائمة — والقائمة اليدوية تتعفّن بلا استثناء.
 */

type IconComponent = (props: { width?: number; height?: number; className?: string; }) => any;

/** ما يُصدَّر من الوحدة وليس أيقونة — يُستثنى بالاسم لا بالتخمين. */
const NOT_ICONS = new Set(["Icon", "IconProps"]);

function collectIcons(): { name: string; Component: IconComponent; }[] {
    const out: { name: string; Component: IconComponent; }[] = [];
    for (const [name, value] of Object.entries(Icons)) {
        if (NOT_ICONS.has(name)) continue;
        if (typeof value !== "function") continue;
        // المكوّنات بأسماء تبدأ بحرف كبير — الدوالّ المساعدة لا.
        if (!/^[A-Z]/.test(name)) continue;
        out.push({ name, Component: value as IconComponent });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 🔴 **يُجرَد عند أوّل تصيير لا عند تقييم الحزمة.**
 *
 * `Object.entries` على وحدةٍ فيها صادرات كسولة يُقيّمها كلّها. والحزمة تُقيَّم
 * **قبل أن يُقلع webpack** عند ديسكورد، فأي صادر يعتمد عليه يكون `undefined`
 * حينها. وثمن الخطأ هنا ليس صفحةً معطوبة بل **إشراق كلّه لا يُحمَّل**.
 */
let iconsCache: { name: string; Component: IconComponent; }[] | null = null;
function allIcons() {
    iconsCache ??= collectIcons();
    return iconsCache;
}

function IconTile({ name, Component, index, onCopy }: {
    name: string;
    Component: IconComponent;
    index: number;
    onCopy: (name: string) => void;
}) {
    return (
        <button type="button" className="esharq-if-tile esharq-rise" style={stagger(index, 14)}
            onClick={() => onCopy(name)}
            title={t(`انسخ سطر استيراد ${name}`, `Copy the import line for ${name}`)}>
            <span className="esharq-if-glyph">
                {/* انفجار أيقونة واحدة يجب ألّا يُسقط الشبكة كلّها.
                    ونستعمل حاجز الأخطاء القائم لا صنفاً جديداً: الصنف الذي
                    يرث `React.Component` يُقيَّم مع الحزمة، و`React` حينها
                    كسولٌ غير جاهز. */}
                <ErrorBoundary noop>
                    <Component width={26} height={26} />
                </ErrorBoundary>
            </span>
            <span className="esharq-if-name">{name}</span>
        </button>
    );
}

export function IconFinderPage() {
    const [query, setQuery] = useState("");
    const [copied, setCopied] = useState<string | null>(null);
    const total = allIcons().length;

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        const icons = allIcons();
        if (q === "") return icons;
        return icons.filter(i => i.name.toLowerCase().includes(q));
    }, [query]);

    const copy = (name: string) => {
        copyToClipboard(`import { ${name} } from "@components/Icons";`);
        setCopied(name);
        Toasts.show({
            id: Toasts.genId(),
            type: Toasts.Type.SUCCESS,
            message: t(`نُسخ سطر استيراد ${name}`, `Copied the import line for ${name}`)
        });
    };

    return (
        <>
            <NoticeStrip>
                {t("أيقونات إشراق كلّها. اضغط أي واحدة لتنسخ سطر استيرادها — يلزمك إن كنت تكتب إضافة.",
                    "All of Esharq's icons. Click one to copy its import line — you need it if you're writing a plugin.")}
            </NoticeStrip>

            <Card index={0}
                title={t("باحث الأيقونات", "Icon finder")}
                subtitle={t("ابحث بالاسم، واضغط لتنسخ.", "Search by name, click to copy.")}
                badge={query.trim() === ""
                    ? t(`${total} أيقونة`, `${total} icons`)
                    : t(`${shown.length} من ${total}`, `${shown.length} of ${total}`)}
                badgeTone={shown.length === 0 ? "danger" : "info"}>

                <div className="esharq-if-search">
                    <span aria-hidden="true">🔍</span>
                    <input
                        type="text"
                        value={query}
                        placeholder={t("ابحث… مثلاً: cloud، arrow، icon", "Search… e.g. cloud, arrow, icon")}
                        aria-label={t("ابحث في الأيقونات", "Search icons")}
                        onChange={e => setQuery(e.currentTarget.value)}
                    />
                    {query !== "" && (
                        <button type="button" onClick={() => setQuery("")}
                            aria-label={t("امسح البحث", "Clear search")}>✕</button>
                    )}
                </div>

                {shown.length === 0 ? (
                    <div className="esharq-if-empty">
                        {t(`لا أيقونة اسمها يحوي «${query}».`, `No icon whose name contains “${query}”.`)}
                    </div>
                ) : (
                    <div className="esharq-if-grid" style={{ marginTop: UNIT * 2 }}>
                        {shown.map((icon, i) => (
                            <IconTile key={icon.name} name={icon.name} Component={icon.Component} index={i} onCopy={copy} />
                        ))}
                    </div>
                )}

                {copied !== null && (
                    <NoticeStrip>
                        <code className="esharq-if-code">{`import { ${copied} } from "@components/Icons";`}</code>
                    </NoticeStrip>
                )}
            </Card>

            <Card index={1}
                title={t("كيف تستعملها", "How to use one")}
                subtitle={t("في إضافة تكتبها بنفسك أو تستوردها من صفحة إضافات المجتمع.",
                    "In a plugin you write yourself, or import from the Community Plugins page.")}>
                <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                    <div>{t("① اضغط الأيقونة فيُنسَخ سطر الاستيراد.", "① Click the icon to copy its import line.")}</div>
                    <div>{t("② ألصقه في أعلى ملفّك.", "② Paste it at the top of your file.")}</div>
                    <div>{t("③ استعملها هكذا:", "③ Use it like this:")}</div>
                </div>
                <code className="esharq-if-code block">{"<CogWheel width={20} height={20} />"}</code>
                <NoticeStrip>
                    {t("كلّها تقبل width وheight وclassName، وتأخذ لونها من النصّ المحيط (currentColor) — فلا تحتاج تحديد لون.",
                        "They all accept width, height and className, and take their colour from the surrounding text (currentColor) — so you don't need to set one.")}
                </NoticeStrip>
            </Card>
        </>
    );
}
