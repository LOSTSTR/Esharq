/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./surveillance.css";

import { t } from "@utils/esharqI18n";
import { useEffect, useMemo, useState } from "@webpack/common";

import { Card, NoticeStrip, StatRow } from "./Card";
import { stagger } from "./motion";

/**
 * **الرصد** — قائمة المواقع المسموح للعميل بجلب شيء منها.
 *
 * ## 🔴 لماذا أُعيدت كتابة هذه الصفحة كاملةً
 *
 * أوّل نسخة وسمت كل مضيف بأسماء توجيهات سياسة المحتوى مترجمةً: «صور»
 * و«اتّصال بيانات». وقرأها المالك كما سيقرأها أي إنسان غير تقنيّ: **«هذا
 * الموقع يأخذ صوري»**. والحقيقة عكسها تماماً — الوسم يقول إن العميل مسموحٌ له
 * أن **يعرض صورةً آتيةً من** ذلك الموقع.
 *
 * والخطأ كان في الصياغة لا في البيانات، وثمنه أفدح من خطأ بيانات: صفحةٌ
 * أُنشئت لتطمئن صارت تُفزع.
 *
 * ⇒ القواعد التي تلتزمها هذه الصفحة الآن:
 *
 * 1. **كل وسم يذكر الاتّجاه**: «يعرض صورةً منه» لا «صور». كلمة «منه» وحدها
 *    تقلب المعنى من أخذٍ إلى جلب.
 * 2. **القائمة قائمة قُفل**: تُشرَح أوّلاً على أنها ما **لا** يستطيع العميل
 *    تجاوزه، لا ما يُسمح له بأخذه منك.
 * 3. **كل موقع معروف يُشرَح بجملة**: ما هو ولماذا هو هنا.
 * 4. **ما لا نعرفه يُوصَف بقواعده وحدها** ولا يُخترع له سبب. جملةٌ مطمئنة عن
 *    موقع لا نعرفه أسوأ من الصمت.
 */

interface Policy {
    host: string;
    directives: string[];
}

/**
 * ماذا يعني كل توجيه — **بالاتّجاه**.
 *
 * صيغة كل وسم: فعلٌ ينتهي بـ«منه»، فلا يبقى احتمالٌ لقراءته أخذاً من المستخدم.
 */
const DIRECTIVES: Record<string, { ar: string; en: string; longAr: string; longEn: string; tone: "net" | "media" | "style" | "code"; }> = {
    "img-src": {
        ar: "يعرض صورةً منه", en: "May show an image from it", tone: "media",
        longAr: "يُسمح للعميل بتنزيل صورة من هذا الموقع وعرضها لك. ولا يُرسَل شيء من صورك أنت إليه.",
        longEn: "The client may download an image from this site and show it to you. Nothing of your own images is sent to it."
    },
    "media-src": {
        ar: "يشغّل صوتاً أو فيديو منه", en: "May play audio or video from it", tone: "media",
        longAr: "يُسمح بتشغيل مقطع صوتيّ أو مرئيّ مصدره هذا الموقع.",
        longEn: "Audio or video hosted on this site may be played."
    },
    "style-src": {
        ar: "يأخذ تنسيقاً منه", en: "May take styling from it", tone: "style",
        longAr: "يُسمح بتحميل ملفّ تنسيق (ألوان ومقاسات) من هذا الموقع — تستعمله الثيمات.",
        longEn: "A stylesheet (colours and sizes) may be loaded from this site — themes use this."
    },
    "font-src": {
        ar: "يأخذ خطّاً منه", en: "May take a font from it", tone: "style",
        longAr: "يُسمح بتحميل ملفّ خطّ من هذا الموقع.",
        longEn: "A font file may be downloaded from this site."
    },
    "connect-src": {
        ar: "يطلب بيانات منه", en: "May request data from it", tone: "net",
        longAr: "يُسمح للعميل بسؤال هذا الموقع وتلقّي جوابه — مثل «هل يوجد تحديث؟». وما يحمله السؤال يُحدّده الكود الذي يسأل، لا هذه القائمة.",
        longEn: "The client may query this site and receive an answer — such as “is there an update?”. What the query carries is decided by the code that asks, not by this list."
    },
    "frame-src": {
        ar: "يفتح إطاراً منه", en: "May embed a frame from it", tone: "code",
        longAr: "يُسمح بعرض صفحة من هذا الموقع داخل إطار.",
        longEn: "A page from this site may be embedded in a frame."
    },
    "worker-src": {
        ar: "يشغّل عاملاً منه", en: "May run a worker from it", tone: "code",
        longAr: "يُسمح بتشغيل شيفرة خلفية مصدرها هذا الموقع.",
        longEn: "Background code hosted on this site may be run."
    },
    "script-src": {
        ar: "يحمّل شيفرة منه", en: "May load code from it", tone: "code",
        longAr: "الأخطر: يُسمح بتحميل برنامج من هذا الموقع وتشغيله داخل ديسكورد.",
        longEn: "The riskiest: a program from this site may be downloaded and run inside Discord."
    }
};

/** الأخطر أوّلاً: ما يُنفَّذ، ثم ما يُطلَب، ثم ما يُعرض. */
const RISK_ORDER = ["script-src", "worker-src", "frame-src", "connect-src", "media-src", "img-src", "font-src", "style-src"];

/** ما هذا الموقع ولماذا هو مسموح؟ وما ليس هنا لا يُخترع له سبب. */
const HOST_NOTES: { match: (h: string) => boolean; ar: string; en: string; group: string; }[] = [
    {
        match: h => h === "*" || h === "*:*",
        ar: "قاعدة مفتوحة: تعني «أي موقع». تُبطل فائدة القائمة كقُفل.",
        en: "An open rule: it means “any site”. It defeats the point of the list as a lock.",
        group: "wildcard"
    },
    {
        match: h => h.includes("cdnjs") || h.includes("cdn.jsdelivr"),
        ar: "شبكة توزيع برمجيات — ومنها وحدها يُسمح بتحميل شيفرة تُشغَّل.",
        en: "A software delivery network — the only kind allowed to load executable code.",
        group: "code"
    },
    {
        match: h => h.includes("localhost") || h.includes("127.0.0.1"),
        ar: "جهازك أنت. لا يغادر شيء منه إلى الإنترنت — يُستعمل لتجربة ثيم تكتبه بنفسك.",
        en: "Your own machine. Nothing leaves it to the internet — used to preview a theme you are writing.",
        group: "local"
    },
    {
        match: h => h.includes("discordapp") || h.includes("discord.com"),
        ar: "ديسكورد نفسه — من هنا تأتي صور الأعضاء والملفّات المرفوعة في المحادثات.",
        en: "Discord itself — where member images and files shared in chats come from.",
        group: "discord"
    },
    {
        match: h => h.includes("github") || h.includes("gitlab") || h.includes("codeberg") || h.includes("githack") || h.includes("jsdelivr"),
        ar: "موقع استضافة مفتوح — أكثر الثيمات تضع صورها وملفّاتها فيه.",
        en: "An open hosting site — most themes keep their images and files there.",
        group: "themes"
    },
    {
        match: h => h.includes("fonts.googleapis") || h.includes("gstatic"),
        ar: "خطوط جوجل — تأخذ منها الثيمات خطوطها.",
        en: "Google Fonts — themes take their typefaces from here.",
        group: "themes"
    },
    {
        match: h => h.includes("imgur") || h.includes("ibb.co") || h.includes("pinimg") || h.includes("catbox"),
        ar: "موقع استضافة صور — تُشير إليه الثيمات لعرض خلفياتها.",
        en: "An image host — themes point at it to show their backgrounds.",
        group: "themes"
    },
    {
        match: h => h.includes("vencord.dev") || h.includes("vendicated.dev") || h.includes("equicord"),
        ar: "خدمة من المُعدِّل الأصليّ الذي بُني عليه إشراق — شارات ومراجعات.",
        en: "A service of the upstream mod Esharq is built on — badges and reviews.",
        group: "feature"
    }
];

function noteFor(host: string) {
    return HOST_NOTES.find(n => n.match(host)) ?? null;
}

function riskOf(directives: string[]): number {
    let worst = RISK_ORDER.length;
    for (const d of directives) {
        const i = RISK_ORDER.indexOf(d);
        if (i !== -1 && i < worst) worst = i;
    }
    return worst;
}

function PolicyRow({ policy, index, custom }: { policy: Policy; index: number; custom: boolean; }) {
    const sorted = [...policy.directives].sort((a, b) => RISK_ORDER.indexOf(a) - RISK_ORDER.indexOf(b));
    const executes = policy.directives.some(d => d === "script-src" || d === "worker-src");
    const note = noteFor(policy.host);

    return (
        <div className={"esharq-sv-row esharq-rise" + (executes ? " exec" : "")} style={stagger(index, 12)}>
            <div className="esharq-sv-top">
                <span className="esharq-sv-host">{policy.host}</span>
                {custom && <span className="esharq-sv-mine">{t("أضفتَه أنت", "Added by you")}</span>}
            </div>

            {note !== null && <div className="esharq-sv-note">{t(note.ar, note.en)}</div>}

            <div className="esharq-sv-tags">
                {sorted.map(d => {
                    const meta = DIRECTIVES[d];
                    return (
                        <span key={d} className={`esharq-sv-tag ${meta?.tone ?? "other"}`}
                            title={meta ? t(meta.longAr, meta.longEn) : d}>
                            {meta ? t(meta.ar, meta.en) : d}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}

export function SurveillancePage() {
    const [data, setData] = useState<{ builtIn: Policy[]; custom: Policy[]; } | null>(null);
    const [failed, setFailed] = useState(false);
    const [query, setQuery] = useState("");

    const load = () => {
        const csp = (window as any).VencordNative?.csp;
        if (csp?.listPolicies == null) return setFailed(true);
        csp.listPolicies().then(setData).catch(() => setFailed(true));
    };
    useEffect(load, []);

    const view = useMemo(() => {
        if (data === null) return null;
        const q = query.trim().toLowerCase();
        const match = (p: Policy) => q === "" || p.host.toLowerCase().includes(q);
        const sort = (a: Policy, b: Policy) => riskOf(a.directives) - riskOf(b.directives) || a.host.localeCompare(b.host);
        return { builtIn: data.builtIn.filter(match).sort(sort), custom: data.custom.filter(match).sort(sort) };
    }, [data, query]);

    if (failed) {
        return (
            <NoticeStrip tone="danger">
                {t("هذه القائمة متاحة في تطبيق سطح المكتب فقط.", "This list is available in the desktop app only.")}
            </NoticeStrip>
        );
    }

    if (data === null || view === null) {
        return <NoticeStrip>{t("جارٍ القراءة…", "Reading…")}</NoticeStrip>;
    }

    const all = [...data.builtIn, ...data.custom];
    const wildcards = all.filter(p => p.host === "*" || p.host === "*:*");
    const executing = all.filter(p => p.directives.some(d => d === "script-src" || d === "worker-src"));

    return (
        <>
            <Card index={0}
                title={t("ما هذه الصفحة؟", "What is this page?")}
                subtitle={t("اقرأ هذا أوّلاً — من دونه تبدو القائمة مُقلقة وهي ليست كذلك.",
                    "Read this first — without it the list looks alarming, and it isn't.")}>

                <div className="esharq-sv-explain">
                    <p>
                        <b>{t("هذه قائمة قُفل، لا قائمة أشياء تُؤخَذ منك.", "This is a lock list, not a list of things taken from you.")}</b>
                        {" "}
                        {t("العميل ممنوع من جلب أي شيء من أي موقع، إلّا المواقع المكتوبة هنا. فكل اسمٍ في هذه الصفحة موقعٌ سُمح للعميل أن يُنزّل منه شيئاً — وكل موقع ليس هنا ممنوع تماماً.",
                            "The client is forbidden from fetching anything from anywhere, except the sites listed here. Every name on this page is a site the client may download something from — and every site not here is blocked outright.")}
                    </p>
                    <p>
                        {t("والاتّجاه هو المهمّ: «يعرض صورةً منه» تعني أن الصورة تأتي من الموقع إليك. لا تعني أن صورك تذهب إليه. ولا شيء في هذه الصفحة يصف إرسال شيء من ملفّاتك أو رسائلك إلى أحد.",
                            "Direction is what matters: “may show an image from it” means the image comes from the site to you. It does not mean your images go there. Nothing on this page describes sending any of your files or messages to anyone.")}
                    </p>
                    <p>
                        {t("وأكثر ما في القائمة موجود لأجل الثيمات: الثيم يحتاج خلفيةً أو خطّاً مرفوعاً على موقع ما، فيُسمح للعميل بجلبه لتراه.",
                            "Most of the list exists for themes: a theme needs a background or a font hosted somewhere, so the client is allowed to fetch it for you to see.")}
                    </p>
                </div>

                <StatRow items={[
                    { label: t("موقعاً مسموحاً", "Allowed sites"), value: String(all.length) },
                    { label: t("لأجل الثيمات", "For themes"), value: String(all.filter(p => noteFor(p.host)?.group === "themes").length) },
                    { label: t("يُسمح لها بشيفرة", "May load code"), value: String(executing.length) },
                    { label: t("أضفتَها أنت", "Added by you"), value: String(data.custom.length) }
                ]} />
            </Card>

            <Card index={1}
                title={t("ماذا يعني كل وسم؟", "What does each tag mean?")}
                subtitle={t("كل وسم فعلٌ ينتهي بـ«منه» — أي أن الشيء يأتي من الموقع، لا يذهب إليه.",
                    "Every tag is an action ending in “from it” — the thing comes from the site, it does not go to it.")}>
                <div className="esharq-sv-legend">
                    {RISK_ORDER.map(key => {
                        const meta = DIRECTIVES[key];
                        if (!meta) return null;
                        return (
                            <div key={key} className="esharq-sv-legend-row">
                                <span className={`esharq-sv-tag ${meta.tone}`}>{t(meta.ar, meta.en)}</span>
                                <span className="esharq-sv-legend-text">{t(meta.longAr, meta.longEn)}</span>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {wildcards.length > 0 && (
                <Card index={2}
                    title={t("قاعدة مفتوحة تُبطل القفل", "An open rule that unlocks the list")}
                    subtitle={t("قاعدة اسمها «*» تعني «أي موقع» — فلا يبقى للقائمة معنى كقفل.",
                        "A rule named “*” means “any site” — so the list stops working as a lock.")}
                    badge={t("مفتوح", "Open")} badgeTone="danger">
                    <div className="esharq-sv-list">
                        {wildcards.map((p, i) => <PolicyRow key={i} policy={p} index={i} custom={false} />)}
                    </div>
                    <div className="esharq-sv-explain">
                        <p>{t("مصدرها إضافة اسمها EquicordHelper، وهي ضرورية فلا يمكن تعطيلها — فالقاعدة سارية دائماً. أضافها من بنى المُعدِّل الأصليّ لتعمل الثيمات مهما كان موقع ملفّاتها.",
                            "It comes from a plugin called EquicordHelper, which is required and cannot be disabled — so the rule is always in force. Whoever built the upstream mod added it so themes work wherever their files are hosted.")}</p>
                        <p>{t("وما بقي محدوداً رغمها هو الأهمّ: تحميل شيفرة تُشغَّل. ذاك ما زال مقصوراً على موقعين اثنين تراهما أدناه.",
                            "What stays restricted despite it is the important part: loading code that runs. That is still limited to the two sites you see below.")}</p>
                        <p>{t("ومعناها عملياً: إضافةٌ تكتبها أنت أو تستوردها تستطيع طلب بيانات من أي موقع — ولذلك تقول صفحة إضافات المجتمع ما تقوله.",
                            "In practice: a plugin you write or import can request data from any site — which is why the Community Plugins page says what it says.")}</p>
                    </div>
                </Card>
            )}

            {executing.length > 0 && (
                <Card index={3}
                    title={t("المواقع المسموح لها بتحميل شيفرة", "Sites allowed to load code")}
                    subtitle={t("هذه وحدها التي يعني السماح لها أكثر من عرض صورة أو خطّ.",
                        "These are the only ones where being allowed means more than showing an image or a font.")}
                    badge={String(executing.length)} badgeTone="warn">
                    <div className="esharq-sv-list">
                        {executing.map((p, i) => (
                            <PolicyRow key={p.host + i} policy={p} index={i} custom={data.custom.some(c => c.host === p.host)} />
                        ))}
                    </div>
                </Card>
            )}

            <Card index={4}
                title={t("القائمة كاملة", "The full list")}
                subtitle={t("مرتّبةً بالأهمّ أوّلاً: ما يُشغّل شيفرة، ثم ما يطلب بيانات، ثم ما يعرض صوراً وخطوطاً.",
                    "Sorted by what matters first: what runs code, then what requests data, then what shows images and fonts.")}
                badge={query.trim() === "" ? String(view.builtIn.length) : `${view.builtIn.length} / ${data.builtIn.length}`}
                badgeTone="info">

                <div className="esharq-sv-search">
                    <span aria-hidden="true">🔍</span>
                    <input type="text" value={query}
                        placeholder={t("ابحث عن موقع…", "Search for a site…")}
                        aria-label={t("ابحث عن موقع", "Search for a site")}
                        onChange={e => setQuery(e.currentTarget.value)} />
                    {query !== "" && <button type="button" onClick={() => setQuery("")} aria-label={t("امسح", "Clear")}>✕</button>}
                </div>

                {view.custom.length > 0 && (
                    <>
                        <div className="esharq-sv-subhead">{t("مواقع أضفتَها أنت", "Sites you added yourself")}</div>
                        <div className="esharq-sv-list">
                            {view.custom.map((p, i) => <PolicyRow key={"c" + p.host} policy={p} index={i} custom />)}
                        </div>
                    </>
                )}

                {view.builtIn.length === 0 ? (
                    <div className="esharq-sv-empty">{t("لا موقع يطابق بحثك.", "No site matches your search.")}</div>
                ) : (
                    <div className="esharq-sv-list">
                        {view.builtIn.map((p, i) => <PolicyRow key={p.host} policy={p} index={i} custom={false} />)}
                    </div>
                )}
            </Card>

            <Card index={5}
                title={t("ما لا تعنيه هذه الصفحة", "What this page does not mean")}
                subtitle={t("حتى لا يُقرأ منها ما ليس فيها.", "So nothing is read into it that isn't there.")}>
                <div className="esharq-sv-explain">
                    <p>{t("① لا تعني أن هذه المواقع أخذت شيئاً منك. تعني أن العميل مسموحٌ له أن يُنزّل منها.",
                        "① It does not mean these sites took anything from you. It means the client is allowed to download from them.")}</p>
                    <p>{t("② لا تعني أن العميل اتّصل بها فعلاً. أكثرها لا يُلمَس أبداً ما لم تُشغّل ثيماً يستعمله.",
                        "② It does not mean the client actually contacted them. Most are never touched unless you run a theme that uses one.")}</p>
                    <p>{t("③ لا تشمل ديسكورد نفسه: طلباته هو لا تمرّ بهذه القائمة ولا يحكمها إشراق.",
                        "③ It does not cover Discord itself: its own requests don't go through this list and Esharq doesn't govern them.")}</p>
                    <p>{t("④ ولا تشمل مكالماتك: الصوت يمرّ في وحدة ديسكورد الأصلية خارج المتصفّح كلّه.",
                        "④ It does not cover your calls: voice runs in Discord's native module, outside the browser entirely.")}</p>
                </div>
            </Card>
        </>
    );
}
