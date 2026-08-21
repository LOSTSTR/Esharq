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
 * **الرصد** — كل وجهة يستطيع إشراق الاتّصال بها، مسرودةً.
 *
 * 🔴 **تُقرأ من `CspPolicies` نفسه** — الجدول الذي يُطبَّق فعلاً على الشبكة، لا
 * قائمةٌ تُكتب بجانبه في الواجهة. والقائمة المكتوبة بجانبٍ تتعفّن: يُضاف مضيف
 * إلى السياسة ولا يُضاف إلى الجدول، فتقول الصفحة «ممنوع» وهو مسموح — وهو أسوأ
 * من ألّا تقول شيئاً.
 *
 * وما تعنيه هذه الصفحة بدقّة: **ما يُسمح به**، لا ما جرى فعلاً. سياسة المحتوى
 * حدٌّ أعلى للإمكان لا سجلّ اتّصالات. وهذا مكتوب في الصفحة بدل أن يُفهم منها
 * أنها مراقبة حيّة.
 */

interface Policy {
    host: string;
    directives: string[];
}

/** ماذا يعني كل توجيه بلغة تُقرأ — لا `connect-src` وحدها. */
const DIRECTIVES: Record<string, { ar: string; en: string; tone: "net" | "media" | "style" | "code"; }> = {
    "connect-src": { ar: "اتّصال بيانات", en: "Data connection", tone: "net" },
    "img-src": { ar: "صور", en: "Images", tone: "media" },
    "media-src": { ar: "صوت وفيديو", en: "Audio and video", tone: "media" },
    "style-src": { ar: "أنماط", en: "Styles", tone: "style" },
    "font-src": { ar: "خطوط", en: "Fonts", tone: "style" },
    "frame-src": { ar: "إطارات", en: "Frames", tone: "code" },
    "worker-src": { ar: "عمّال", en: "Workers", tone: "code" },
    "script-src": { ar: "شيفرة", en: "Scripts", tone: "code" }
};

/** الأخطر أوّلاً: ما يُنفَّذ، ثم ما يُرسل، ثم ما يُعرض. */
const RISK_ORDER = ["script-src", "worker-src", "frame-src", "connect-src", "media-src", "img-src", "font-src", "style-src"];

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

    return (
        <div className={"esharq-sv-row esharq-rise" + (executes ? " exec" : "")} style={stagger(index, 12)}>
            <span className="esharq-sv-host">{policy.host}</span>
            <span className="esharq-sv-tags">
                {sorted.map(d => {
                    const meta = DIRECTIVES[d];
                    return (
                        <span key={d} className={`esharq-sv-tag ${meta?.tone ?? "other"}`} title={d}>
                            {meta ? t(meta.ar, meta.en) : d}
                        </span>
                    );
                })}
            </span>
            {custom && <span className="esharq-sv-mine">{t("أضفتَه أنت", "Added by you")}</span>}
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
        return {
            builtIn: data.builtIn.filter(match).sort(sort),
            custom: data.custom.filter(match).sort(sort)
        };
    }, [data, query]);

    if (failed) {
        return (
            <NoticeStrip tone="danger">
                {t("جرد الوجهات متاح في تطبيق سطح المكتب فقط.", "The destination inventory is available in the desktop app only.")}
            </NoticeStrip>
        );
    }

    if (data === null || view === null) {
        return <NoticeStrip>{t("جارٍ قراءة السياسة…", "Reading the policy…")}</NoticeStrip>;
    }

    // 🔴 قاعدةٌ نطاقها `*` تُبطل الجدول كلّه: لا معنى لسرد 41 مضيفاً إن كان
    // كل مضيف مسموحاً. تُرفَع إلى أعلى الصفحة بدل أن تختفي صفّاً بين الصفوف.
    const wildcards = [...data.builtIn, ...data.custom].filter(p => p.host === "*" || p.host === "*:*");

    const total = data.builtIn.length + data.custom.length;
    const executing = [...data.builtIn, ...data.custom].filter(p =>
        p.directives.some(d => d === "script-src" || d === "worker-src"));
    const connecting = [...data.builtIn, ...data.custom].filter(p => p.directives.includes("connect-src"));

    return (
        <>
            <NoticeStrip>
                {t("هذه الوجهات التي يُسمح لإشراق بالاتّصال بها — لا سجلّ ما اتّصل به فعلاً. سياسة المحتوى حدٌّ أعلى للإمكان، وأي وجهة خارجها يمنعها المتصفّح.",
                    "These are the destinations Esharq is allowed to reach — not a log of what it actually contacted. The content policy is an upper bound on what is possible; anything outside it is blocked by the browser.")}
            </NoticeStrip>

            {wildcards.length > 0 && (
                <Card index={0}
                    title={t("قاعدة مفتوحة تُبطل الجدول", "An open rule that overrides the table")}
                    subtitle={t("قاعدة نطاقها «*» تعني: كل مضيف مسموح، لا هؤلاء وحدهم.",
                        "A rule whose host is “*” means: every host is allowed, not just the ones listed.")}
                    badge={t("مفتوح", "Open")} badgeTone="danger">
                    <NoticeStrip tone="danger">
                        {t("توجد قاعدة تسمح لكل النطاقات بالأنواع التالية:", "There is a rule allowing every domain for the following:")}
                        <div className="esharq-sv-list" style={{ marginTop: 10 }}>
                            {wildcards.map((p, i) => <PolicyRow key={i} policy={p} index={i} custom={data.custom.some(c => c.host === p.host)} />)}
                        </div>
                    </NoticeStrip>
                    <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                        <div>{t("• مصدرها إضافة EquicordHelper، وهي مطلوبة فلا تُعطَّل — القاعدة سارية دائماً.",
                            "• It comes from the EquicordHelper plugin, which is required and cannot be disabled — so the rule is always in force.")}</div>
                        <div>{t("• ما يبقى محدوداً فعلاً هو الشيفرة (script-src): لا يُحمَّل كود إلّا من المضيفين في البطاقة التالية.",
                            "• What remains genuinely restricted is code (script-src): scripts load only from the hosts in the next card.")}</div>
                        <div>{t("• وهذا يعني أن أي إضافة تستطيع إرسال طلب بيانات إلى أي وجهة — فاقرأ ما تُشغّله.",
                            "• It also means any plugin can send a data request to any destination — so read what you run.")}</div>
                    </div>
                </Card>
            )}

            <Card index={wildcards.length > 0 ? 1 : 0}
                title={t("الوجهات المسموح بها", "Allowed destinations")}
                subtitle={t("مقروءةً من السياسة المُطبَّقة نفسها، لا من قائمة مكتوبة بجانبها.",
                    "Read from the enforced policy itself, not from a list written beside it.")}
                badge={`${total}`} badgeTone="info">

                <StatRow items={[
                    { label: t("وجهة", "Destinations"), value: String(total) },
                    { label: t("تُرسَل إليها بيانات", "Can receive data"), value: String(connecting.length) },
                    { label: t("يُسمح لها بشيفرة", "May load scripts"), value: String(executing.length) },
                    { label: t("أضفتَها أنت", "Added by you"), value: String(data.custom.length) }
                ]} />

                <div className="esharq-sv-search">
                    <span aria-hidden="true">🔍</span>
                    <input type="text" value={query}
                        placeholder={t("ابحث عن مضيف…", "Search for a host…")}
                        aria-label={t("ابحث عن مضيف", "Search for a host")}
                        onChange={e => setQuery(e.currentTarget.value)} />
                    {query !== "" && (
                        <button type="button" onClick={() => setQuery("")} aria-label={t("امسح", "Clear")}>✕</button>
                    )}
                </div>
            </Card>

            {executing.length > 0 && (
                <Card index={2}
                    title={t("يُسمح لها بتحميل شيفرة", "Allowed to load code")}
                    subtitle={t("أخطر ما في الجدول، فيُعرَض وحده أوّلاً.", "The riskiest entries in the table, shown on their own first.")}
                    badge={String(executing.length)} badgeTone="warn">
                    <div className="esharq-sv-list">
                        {executing.map((p, i) => (
                            <PolicyRow key={p.host} policy={p} index={i} custom={data.custom.some(c => c.host === p.host)} />
                        ))}
                    </div>
                    <NoticeStrip tone="danger">
                        {t("هذه شبكات توزيع محتوى يُحمَّل منها كود فعلاً. وهي الوحيدة في الجدول التي يعني السماح لها أكثر من عرض صورة أو خطّ.",
                            "These are content delivery networks that actually serve executable code. They are the only entries where allowing them means more than showing an image or a font.")}
                    </NoticeStrip>
                </Card>
            )}

            {data.custom.length > 0 && (
                <Card index={3}
                    title={t("وجهات أضفتَها أنت", "Destinations you added")}
                    subtitle={t("استثناءات وافقتَ عليها بنفسك — تبقى حتى تُزيلها.",
                        "Exceptions you approved yourself — they stay until you remove them.")}
                    badge={String(data.custom.length)} badgeTone="warn">
                    <div className="esharq-sv-list">
                        {view.custom.map((p, i) => <PolicyRow key={p.host} policy={p} index={i} custom />)}
                    </div>
                </Card>
            )}

            <Card index={4}
                title={t("الجدول كامل", "The full table")}
                subtitle={t("مرتّباً بالأخطر أوّلاً: ما يُنفَّذ، ثم ما تُرسَل إليه بيانات، ثم ما يُعرض.",
                    "Sorted by risk: what executes, then what receives data, then what is merely displayed.")}
                badge={query.trim() === "" ? String(view.builtIn.length) : t(`${view.builtIn.length} من ${data.builtIn.length}`, `${view.builtIn.length} of ${data.builtIn.length}`)}
                badgeTone="info">
                {view.builtIn.length === 0 ? (
                    <div className="esharq-sv-empty">{t("لا مضيف يطابق بحثك.", "No host matches your search.")}</div>
                ) : (
                    <div className="esharq-sv-list">
                        {view.builtIn.map((p, i) => <PolicyRow key={p.host} policy={p} index={i} custom={false} />)}
                    </div>
                )}
            </Card>

            <Card index={5}
                title={t("ما لا يقوله هذا الجدول", "What this table does not say")}
                subtitle={t("حدود ما يصفه، مكتوبةً.", "The limits of what it describes, written down.")}>
                <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                    <div>{t("① يصف ما يُسمح به لا ما جرى. وجهة مسموحة قد لا تُلمَس أبداً.", "① It describes what is allowed, not what happened. An allowed destination may never be touched.")}</div>
                    <div>{t("② يخصّ طلبات المُعدِّل والثيمات. طلبات ديسكورد نفسه لا تمرّ بهذه السياسة.", "② It covers the mod's and themes' requests. Discord's own requests do not go through this policy.")}</div>
                    <div>{t("③ ولا يشمل الصوت: نقل المكالمات يجري في وحدة ديسكورد الأصلية خارج المتصفّح.", "③ It does not cover voice: call transport happens in Discord's native module, outside the browser.")}</div>
                    <div>{t("④ الوجهة المسموحة لصورة لا تستطيع تحميل شيفرة — التوسيم بجوارها يقول أيّها.", "④ A host allowed for images cannot load code — the tags beside it say which is which.")}</div>
                </div>
            </Card>
        </>
    );
}
