/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./startupTimings.css";

import { t } from "@utils/esharqI18n";
import { findByPropsLazy } from "@webpack";
import { useEffect, useMemo, useState } from "@webpack/common";

import { Card, NoticeStrip, StatRow } from "./Card";
import { countUpFrames, stagger } from "./motion";
import { UNIT } from "./tokens";

/**
 * **أزمنة الإقلاع** — من أين يذهب الوقت بين ضغطة التشغيل وظهور الواجهة.
 *
 * 🔴 **البيانات من ديسكورد نفسه لا من قياسٍ نُضيفه.** وهذا مقصود: قياسنا
 * الخاصّ كان سيكلّف كل إقلاع شيئاً ولو يسيراً، وديسكورد يُسجّل هذا أصلاً في
 * `AppStartPerformance`. فالصفحة **تقرأ ولا تقيس** — تكلفتها على الإقلاع صفر.
 *
 * ⚠️ ولذلك حدودها حدود ما يُسجّله ديسكورد: تظهر خطواته هو، **ولا يظهر فيها
 * زمن إضافات إشراق** — فتلك لا يقيسها أحد. وهذا مكتوب في الصفحة صراحةً بدل
 * أن يظنّ القارئ أن الجدول يشمل كل شيء.
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

            <Card index={2}
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

            <Card index={3}
                title={t("ما لا تقوله هذه الأرقام", "What these numbers do not say")}
                subtitle={t("حدود القياس مكتوبة كي لا تُقرأ الأرقام أكثر ممّا تحتمل.",
                    "The limits of the measurement, written down so the numbers aren't read for more than they hold.")}>
                <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                    <div>{t("① الأرقام من سجلّ ديسكورد نفسه، فهي تصف **خطواته هو**.", "① The numbers come from Discord's own log, so they describe its own steps.")}</div>
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
