/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./startupTimings.css";

import { getPluginStartups, type PluginStartRecord } from "@debug/esharqStartup";
import { t } from "@utils/esharqI18n";
import { findByPropsLazy } from "@webpack";
import { useEffect, useMemo, useState } from "@webpack/common";

import { Card, NoticeStrip, StatRow } from "./Card";
import { countUpFrames, stagger } from "./motion";
import { UNIT } from "./tokens";

/**
 * **أزمنة الإقلاع** — من أين يذهب الوقت بين ضغطة التشغيل وظهور الواجهة.
 *
 * مصدران، وكلٌّ يُقال من أين جاء:
 *
 * 1. **خطوات ديسكورد** — من `AppStartPerformance` الذي يُسجّله هو أصلاً.
 *    نقرأ ولا نقيس، فتكلفتها صفر.
 * 2. **إضافات إشراق** — من قياسٍ نُضيفه نحن (`@debug/esharqStartup`)، لأن
 *    قياس ڤينكورد لا يعمل عند المستخدم: `traceFunction` تصير بلا عمل خارج
 *    بناء التطوير، و`patchTimings` لا تُملأ إلّا في بناء المُبلِّغ. فمن يُشغّل
 *    من المُثبِّت كان بلا رقم واحد عن إضافاته — وهو صاحب السؤال.
 *
 * وتكلفة قياسنا نداءا توقيتٍ لكل إضافة تبدأ ولكل ترقيعة تُنفَّذ: أقلّ من ميلي
 * ثانية على إقلاعٍ يستغرق آلافها.
 */

interface StartupLog {
    emoji: string;
    prefix: string;
    log: string;
    timestamp?: number;
    delta?: number;
}

interface LogGroup {
    index: number;
    timestamp: number;
    logs: StartupLog[];
    serverTrace?: string;
}

interface AppStartPerformance {
    prefix: string;
    logs: StartupLog[];
    logGroups: LogGroup[];
    endTime_: number;
    isTracing_: boolean;
}

const AppStart = findByPropsLazy("markWithDelta", "markAndLog", "markAt") as AppStartPerformance;

/** رقم يتسلّق مرّة واحدة عند فتح الصفحة — لا عند كل تغيّر. */
function CountUp({ value, suffix = "" }: { value: number; suffix?: string; }) {
    const [shown, setShown] = useState(value);

    useEffect(() => {
        const frames = countUpFrames(value);
        if (frames.length <= 1) return setShown(value);
        let i = 0;
        setShown(frames[0]);
        const id = setInterval(() => {
            i++;
            if (i >= frames.length) { clearInterval(id); return setShown(value); }
            setShown(frames[i]);
        }, 16);
        return () => clearInterval(id);
    }, []);

    return <>{shown.toLocaleString()}{suffix}</>;
}

/**
 * تصنيف الخطوة من رمزها — ديسكورد يضع رمزاً لكل نوع، فنقرأه بدل أن نُخمّن
 * من النصّ. وما لا نعرفه يبقى «أخرى» ولا يُلوَّن بغير لونه.
 */
const CATEGORIES = {
    network: { emojis: ["🌐", "📡", "☁️"], ar: "شبكة", en: "Network", color: "#5865f2" },
    lazy: { emojis: ["🦥"], ar: "تحميل مؤجَّل", en: "Lazy load", color: "#c9a227" },
    render: { emojis: ["🖼️", "🎨", "⚛️"], ar: "رسم", en: "Render", color: "#23a55a" },
    other: { emojis: [], ar: "أخرى", en: "Other", color: "#8a8a99" }
} as const;

type CategoryKey = keyof typeof CATEGORIES;

function categorise(emoji: string): CategoryKey {
    for (const [key, cat] of Object.entries(CATEGORIES)) {
        if ((cat.emojis as readonly string[]).includes(emoji)) return key as CategoryKey;
    }
    return "other";
}

/**
 * صفّ خطوة: شريطٌ يملأ بقدر ما استغرقت، ورقمٌ بجواره.
 *
 * الشريط `scaleX` لا `width` — الأوّل على المُركِّب بلا إعادة تخطيط، والثاني
 * يُجبر المتصفّح على حساب التخطيط في كل إطار. و234 صفّاً تجعل الفرق محسوساً.
 */
function StepRow({ log, index, max, showBar }: {
    log: StartupLog;
    index: number;
    max: number;
    showBar: boolean;
}) {
    const delta = log.delta ?? 0;
    const category = categorise(log.emoji);
    const ratio = max > 0 ? Math.min(1, delta / max) : 0;

    return (
        <div className="esharq-st-row esharq-rise" style={stagger(index, 10)}>
            <span className="esharq-st-emoji" aria-hidden="true">{log.emoji || "•"}</span>
            <span className="esharq-st-label" title={log.prefix + log.log}>{log.prefix}{log.log}</span>
            {showBar && (
                <span className="esharq-st-bar" aria-hidden="true">
                    <i style={{ transform: `scaleX(${ratio})`, background: CATEGORIES[category].color }} />
                </span>
            )}
            <span className={"esharq-st-ms" + (delta >= 100 ? " slow" : "")}>
                {delta > 0 ? `${delta} ms` : "—"}
            </span>
        </div>
    );
}

/**
 * **تكلفة إضافات إشراق** — أيّها يأكل وقت إقلاعك.
 *
 * التكلفة شقّان: زمن `start()`، وزمن ترقيعات الإضافة على وحدات ديسكورد.
 * والثاني يُنسى غالباً وهو الأثقل في إضافات كثيرة — ترقيعةٌ تبحث بنمطٍ في
 * وحدةٍ ضخمة تُكلّف أضعاف ما يُكلّفه `start()` فارغ.
 */
function PluginCostCard({ index }: { index: number; }) {
    const [showAll, setShowAll] = useState(false);

    const rows = useMemo(() => {
        return getPluginStartups()
            .map(r => ({ ...r, totalMs: r.startMs + r.patchMs }))
            .filter(r => r.totalMs > 0.05 || r.failed)
            .sort((a, b) => b.totalMs - a.totalMs);
    }, []);

    if (rows.length === 0) {
        return (
            <Card index={index} title={t("تكلفة الإضافات", "Plugin cost")}
                subtitle={t("كم كلّفت كل إضافة من وقت إقلاعك.", "How much of your startup each plugin cost.")}>
                <NoticeStrip>
                    {t("لم تُقَس إضافات في هذه الجلسة. أعد تشغيل ديسكورد ثم عُد إلى هنا.",
                        "No plugins were measured this session. Restart Discord, then come back.")}
                </NoticeStrip>
            </Card>
        );
    }

    const total = rows.reduce((n, r) => n + r.totalMs, 0);
    const max = rows[0].totalMs;
    const shown = showAll ? rows : rows.slice(0, 12);
    const failed = rows.filter(r => r.failed).length;

    return (
        <Card index={index}
            title={t("تكلفة الإضافات", "Plugin cost")}
            subtitle={t("كم كلّفت كل إضافة من وقت إقلاعك — بدؤها وترقيعاتها معاً.",
                "How much of your startup each plugin cost — its start and its patches together.")}
            badge={`${total.toFixed(0)} ms`}
            badgeTone={total > 1500 ? "danger" : total > 600 ? "warn" : "ok"}>

            <StatRow items={[
                { label: t("إضافات مقيسة", "Measured plugins"), value: String(rows.length) },
                { label: t("مجموع التكلفة", "Total cost"), value: `${total.toFixed(0)} ms` },
                { label: t("الأثقل", "Heaviest"), value: `${max.toFixed(0)} ms` },
                { label: t("فشل بدؤها", "Failed to start"), value: String(failed) }
            ]} />

            <div className="esharq-st-list" style={{ marginTop: UNIT * 2 }}>
                {shown.map((r, i) => <PluginRow key={r.name} record={r} index={i} max={max} />)}
            </div>

            {rows.length > 12 && (
                <button type="button" className="esharq-st-more" onClick={() => setShowAll(v => !v)}>
                    {showAll
                        ? t("اعرض الأثقل فقط", "Show the heaviest only")
                        : t(`اعرض الباقي (${rows.length - 12})`, `Show the rest (${rows.length - 12})`)}
                </button>
            )}

            <NoticeStrip>
                {t("«البدء» زمن تشغيل الإضافة نفسها، و«الترقيع» زمن تعديلها لوحدات ديسكورد. وإضافة بلا رقم لم تُكلّف شيئاً يُذكر — لا أنها معطَّلة.",
                    "“Start” is the time the plugin itself took to run; “Patch” is the time it spent modifying Discord's modules. A plugin with no number cost nothing measurable — it isn't disabled.")}
            </NoticeStrip>
        </Card>
    );
}

/**
 * صفّ إضافة: شريط واحد مقسوم قسمين — بدءٌ ثمّ ترقيع.
 *
 * 🔴 القسمان **متلاصقان بنسبتهما من الأطول**، لا نصفان متساويان. أوّل نسخة
 * جعلت لكلٍّ نصف المسار فكان القسم الذهبيّ يبدأ من المنتصف مهما صغر زمنه —
 * فتُقارَن الصفوف ببعضها خطأً. كُشف باللقطة لا بالقراءة.
 *
 * والكشف بـ`scaleX` على الغلاف: النِّسَب داخله ثابتة، والمتحرّك واحدٌ فقط.
 */
function PluginRow({ record, index, max }: {
    record: PluginStartRecord & { totalMs: number; };
    index: number;
    max: number;
}) {
    const pct = (ms: number) => (max > 0 ? Math.min(100, (ms / max) * 100) : 0);

    return (
        <div className="esharq-st-row plugin esharq-rise" style={stagger(index, 10)}>
            <span className="esharq-st-emoji" aria-hidden="true">{record.failed ? "⚠" : "🧩"}</span>
            <span className="esharq-st-label plugin" title={record.name}>
                {record.name}
                {record.patchCount > 0 && (
                    <span className="esharq-st-sub">{t(`${record.patchCount} ترقيعة`, `${record.patchCount} patches`)}</span>
                )}
            </span>
            <span className="esharq-st-bar split" aria-hidden="true">
                <span className="esharq-st-fill">
                    <i className="start" style={{ inlineSize: `${pct(record.startMs)}%` }}
                        title={`start ${record.startMs.toFixed(1)}ms`} />
                    <i className="patch" style={{ inlineSize: `${pct(record.patchMs)}%` }}
                        title={`patch ${record.patchMs.toFixed(1)}ms`} />
                </span>
            </span>
            <span className={"esharq-st-ms" + (record.totalMs >= 100 ? " slow" : "")}>
                {record.totalMs.toFixed(record.totalMs < 10 ? 1 : 0)} ms
            </span>
        </div>
    );
}

export function StartupTimingsPage() {
    const [filter, setFilter] = useState<"all" | "slow" | CategoryKey>("all");

    const data = useMemo(() => {
        const logs: StartupLog[] = Array.isArray(AppStart?.logs) ? AppStart.logs : [];
        const group = AppStart?.logGroups?.[0];
        const start = group?.timestamp;
        const end = AppStart?.endTime_;

        const withDelta = logs.filter(l => (l.delta ?? 0) > 0);
        const slowest = [...withDelta].sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
        const maxDelta = slowest[0]?.delta ?? 0;
        const totalMs = start != null && end != null && end > start ? end - start : null;
        const accounted = withDelta.reduce((n, l) => n + (l.delta ?? 0), 0);

        const counts = {} as Record<CategoryKey, number>;
        for (const key of Object.keys(CATEGORIES) as CategoryKey[]) counts[key] = 0;
        for (const l of logs) counts[categorise(l.emoji)]++;

        return { logs, slowest, maxDelta, totalMs, accounted, counts, serverTrace: group?.serverTrace };
    }, []);

    if (data.logs.length === 0) {
        return (
            <NoticeStrip tone="danger">
                {t("لم يُسجّل ديسكورد أزمنة إقلاع في هذه الجلسة. أعد تشغيله ثم عُد إلى هنا.",
                    "Discord recorded no startup timings this session. Restart it, then come back.")}
            </NoticeStrip>
        );
    }

    const shown = data.logs.filter(l => {
        if (filter === "all") return true;
        if (filter === "slow") return (l.delta ?? 0) >= 50;
        return categorise(l.emoji) === filter;
    });

    const tabs: { key: "all" | "slow" | CategoryKey; label: string; count: number; }[] = [
        { key: "all", label: t("الكلّ", "All"), count: data.logs.length },
        { key: "slow", label: t("الأبطأ", "Slow"), count: data.logs.filter(l => (l.delta ?? 0) >= 50).length },
        ...(Object.keys(CATEGORIES) as CategoryKey[]).map(k => ({
            key: k,
            label: t(CATEGORIES[k].ar, CATEGORIES[k].en),
            count: data.counts[k]
        }))
    ];

    return (
        <>
            <NoticeStrip>
                {t("هذه أزمنة يُسجّلها ديسكورد بنفسه أثناء إقلاعه. إشراق يقرؤها ولا يقيس شيئاً — فلا تكلفة على إقلاعك.",
                    "These are timings Discord records itself while starting. Esharq reads them and measures nothing — so there is no cost to your startup.")}
            </NoticeStrip>

            <Card index={0}
                title={t("ملخّص الإقلاع", "Startup summary")}
                subtitle={t("من ضغطة التشغيل إلى جهوز الواجهة.", "From launch to a ready interface.")}
                badge={data.totalMs != null ? `${(data.totalMs / 1000).toFixed(2)}s` : t("غير معروف", "Unknown")}
                badgeTone={data.totalMs == null ? "warn" : data.totalMs > 15000 ? "danger" : data.totalMs > 8000 ? "warn" : "ok"}>
                <StatRow items={[
                    { label: t("زمن الإقلاع", "Startup time"), value: data.totalMs != null ? `${(data.totalMs / 1000).toFixed(2)}s` : "—" },
                    { label: t("خطوات مُسجَّلة", "Recorded steps"), value: String(data.logs.length) },
                    { label: t("أبطأ خطوة", "Slowest step"), value: `${data.maxDelta} ms` },
                    { label: t("مجموع المقيس", "Measured total"), value: `${(data.accounted / 1000).toFixed(2)}s` }
                ]} />
                <NoticeStrip>
                    {t("«مجموع المقيس» أقلّ من زمن الإقلاع دائماً: ديسكورد لا يُوقّت كل خطوة، والفرق انتظارٌ لا يُنسَب إلى خطوة بعينها.",
                        "“Measured total” is always less than startup time: Discord doesn't time every step, and the gap is waiting that belongs to no single step.")}
                </NoticeStrip>
            </Card>

            <Card index={1}
                title={t("أبطأ عشر خطوات", "Ten slowest steps")}
                subtitle={t("حيث يذهب أكثر الوقت فعلاً.", "Where most of the time actually goes.")}>
                <div className="esharq-st-list">
                    {data.slowest.slice(0, 10).map((log, i) => (
                        <StepRow key={i} log={log} index={i} max={data.maxDelta} showBar />
                    ))}
                </div>
            </Card>

            <PluginCostCard index={2} />

            <Card index={3}
                title={t("الخطّ الزمنيّ الكامل", "Full timeline")}
                subtitle={t("كل خطوة سجّلها ديسكورد، بترتيب وقوعها.", "Every step Discord recorded, in the order it happened.")}
                badge={t(`${shown.length} من ${data.logs.length}`, `${shown.length} of ${data.logs.length}`)}
                badgeTone="info">

                <div className="esharq-st-tabs" role="tablist">
                    {tabs.map(tab => (
                        <button key={tab.key} type="button" role="tab"
                            aria-selected={filter === tab.key}
                            className={filter === tab.key ? "on" : undefined}
                            onClick={() => setFilter(tab.key)}>
                            {tab.label}
                            <span className="esharq-st-tabcount">{tab.count}</span>
                        </button>
                    ))}
                </div>

                {shown.length === 0 ? (
                    <div className="esharq-st-empty">{t("لا خطوة في هذا التصنيف.", "No steps in this category.")}</div>
                ) : (
                    <div className="esharq-st-list scroll">
                        {shown.map((log, i) => (
                            <StepRow key={i} log={log} index={i} max={data.maxDelta} showBar={(log.delta ?? 0) > 0} />
                        ))}
                    </div>
                )}
            </Card>

            <Card index={4}
                title={t("ما لا تقوله هذه الأرقام", "What these numbers do not say")}
                subtitle={t("حدود القياس مكتوبة كي لا تُقرأ الأرقام أكثر ممّا تحتمل.",
                    "The limits of the measurement, written down so the numbers aren't read for more than they hold.")}>
                <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                    <div>{t("① الأرقام من سجلّ ديسكورد نفسه، فهي تصف خطواته هو.", "① The numbers come from Discord's own log, so they describe its own steps.")}</div>
                    <div>{t("② زمن إضافات إشراق لا يظهر هنا — لا ديسكورد يقيسه ولا نحن.", "② Esharq's plugin time does not appear here — neither Discord nor we measure it.")}</div>
                    <div>{t("③ الإقلاع يختلف بين مرّة وأخرى: الشبكة والقرص وما يعمل معك على الجهاز كلّها تُغيّره.", "③ Startup varies run to run: network, disk and whatever else runs on your machine all change it.")}</div>
                    <div>{t("④ خطوة بلا رقم ليست فورية — ديسكورد لم يُوقّتها فحسب.", "④ A step with no number isn't instant — Discord simply didn't time it.")}</div>
                </div>
                {data.serverTrace != null && (
                    <div style={{ marginTop: UNIT * 2 }}>
                        <NoticeStrip>
                            {t("ومعها أثر خادم يُصدره ديسكورد لتشخيص جانبه هو — لا يخصّ جهازك.",
                                "There is also a server trace Discord emits to diagnose its own side — it does not describe your machine.")}
                        </NoticeStrip>
                    </div>
                )}
            </Card>
        </>
    );
}
