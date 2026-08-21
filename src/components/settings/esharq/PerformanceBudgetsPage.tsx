/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./performanceBudgets.css";

import { Settings, useSettings } from "@api/Settings";
import { getPluginStartups } from "@debug/esharqStartup";
import { t } from "@utils/esharqI18n";
import { useEffect, useMemo, useRef, useState } from "@webpack/common";

import { Card, NoticeStrip, StatRow } from "./Card";
import { stagger } from "./motion";

/**
 * **ميزانيات الأداء** — حدٌّ لكل مقياس، ومخالفةٌ حين يُتجاوَز.
 *
 * والفرق بينها وبين «أزمنة الإقلاع» فرقُ زمن: تلك تصف **لحظة الإقلاع** مرّةً
 * واحدة، وهذه تقيس **الآن** ما دامت الصفحة مفتوحة.
 *
 * 🔴 **ولا تقيس شيئاً وهي مغلقة.** لا مؤقّت يبقى ولا مستمع: العيّنات تبدأ عند
 * فتح الصفحة وتتوقّف بإغلاقها. مقياسٌ دائم يُكلّف كل مستخدم ثمناً ليقرأه واحد.
 *
 * 🔴 **وقياس المعالج لكل عملية لا لكل إضافة.** إلكترون يُعطي أرقام العمليات،
 * ولا سبيل لنسب دورةٍ من المُصيِّر إلى إضافةٍ بعينها — كلّها تعمل في نفس
 * العملية ونفس الخيط. والصفحة تقول هذا بدل أن يُقرأ الرقم على غير معناه.
 */

interface ProcMetric {
    type: string;
    pid: number;
    cpu: number | null;
    memMB: number;
}

/**
 * الحدود الافتراضية — و**الصفر يُعطّل الفحص**، فمن لا يريد حدّاً يمحوه ولا
 * يضطرّ إلى رقم كبير يخترعه.
 */
const DEFAULT_BUDGETS = {
    cpuPercent: 60,
    memoryMB: 1500,
    heapMB: 900,
    startupMs: 400
} as const;

type BudgetKey = keyof typeof DEFAULT_BUDGETS;

const BUDGET_META: Record<BudgetKey, { ar: string; en: string; unit: string; hintAr: string; hintEn: string; }> = {
    cpuPercent: {
        ar: "المعالج (كل العمليات)", en: "CPU (all processes)", unit: "%",
        hintAr: "100% = نواة واحدة مشغولة بالكامل، وقد يتجاوزها على عدّة أنوية.",
        hintEn: "100% = one core fully busy; it can exceed that across multiple cores."
    },
    memoryMB: {
        ar: "الذاكرة (كل العمليات)", en: "Memory (all processes)", unit: "MB",
        hintAr: "مجموعة العمل لكل عمليات ديسكورد مجتمعةً.",
        hintEn: "The working set of all Discord processes combined."
    },
    heapMB: {
        ar: "كومة جافاسكربت", en: "JavaScript heap", unit: "MB",
        hintAr: "ذاكرة المُصيِّر التي تشغلها الشيفرة — إشراق وديسكورد معاً.",
        hintEn: "The renderer memory the code occupies — Esharq and Discord together."
    },
    startupMs: {
        ar: "تكلفة الإضافات على الإقلاع", en: "Plugin startup cost", unit: "ms",
        hintAr: "مجموع ما كلّفته إضافاتك عند آخر إقلاع.",
        hintEn: "What your plugins cost in total at the last startup."
    }
};

function readBudgets(): Record<BudgetKey, number> {
    const stored = (Settings as any).esharq?.budgets ?? {};
    const out = {} as Record<BudgetKey, number>;
    for (const key of Object.keys(DEFAULT_BUDGETS) as BudgetKey[]) {
        const v = stored[key];
        out[key] = typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : DEFAULT_BUDGETS[key];
    }
    return out;
}

function writeBudget(key: BudgetKey, value: number) {
    const store = Settings as Record<string, any>;
    store.esharq = { ...(store.esharq ?? {}), budgets: { ...(store.esharq?.budgets ?? {}), [key]: value } };
}

function heapMB(): number | null {
    const mem = (performance as { memory?: { usedJSHeapSize?: number; }; }).memory;
    const used = mem?.usedJSHeapSize;
    return typeof used === "number" ? Math.round(used / 1048576) : null;
}

/** صفّ ميزانية: القيمة الآن، الحدّ، وشريطٌ يقول كم بقي منه. */
function BudgetRow({ label, hint, unit, value, budget, index, onBudget }: {
    label: string; hint: string; unit: string;
    value: number | null; budget: number; index: number;
    onBudget: (v: number) => void;
}) {
    const off = budget === 0;
    const over = !off && value !== null && value > budget;
    const ratio = off || value === null || budget === 0 ? 0 : Math.min(1, value / budget);

    return (
        <div className={"esharq-pb-row esharq-rise" + (over ? " over" : "") + (off ? " off" : "")} style={stagger(index, 8)}>
            <div className="esharq-pb-head">
                <span className="esharq-pb-label">{label}</span>
                <span className="esharq-pb-value">
                    {value === null ? t("لم يُقَس", "Not measured") : `${value} ${unit}`}
                    {!off && <span className="esharq-pb-of"> / {budget} {unit}</span>}
                </span>
            </div>

            <div className="esharq-pb-track" aria-hidden="true">
                <i style={{ transform: `scaleX(${ratio})` }} className={over ? "over" : ratio > 0.8 ? "near" : ""} />
            </div>

            <div className="esharq-pb-foot">
                <span className="esharq-pb-hint">{hint}</span>
                <label className="esharq-pb-input">
                    {t("الحدّ", "Budget")}
                    <input type="number" min={0} value={budget}
                        aria-label={t(`حدّ ${label}`, `Budget for ${label}`)}
                        onChange={e => {
                            const n = parseInt(e.currentTarget.value, 10);
                            if (Number.isFinite(n) && n >= 0) onBudget(n);
                        }} />
                    <span>{unit}</span>
                </label>
            </div>

            {off && <div className="esharq-pb-note">{t("الفحص مُعطَّل — الصفر يعني «لا تُراقب هذا».", "Check disabled — zero means “don't watch this”.")}</div>}
            {over && <div className="esharq-pb-note over">{t("تجاوز الحدّ.", "Over budget.")}</div>}
        </div>
    );
}

export function PerformanceBudgetsPage() {
    useSettings(["esharq" as any]);

    const [metrics, setMetrics] = useState<ProcMetric[] | null>(null);
    const [heap, setHeap] = useState<number | null>(heapMB);
    const [sampling, setSampling] = useState(true);
    const [failed, setFailed] = useState(false);
    const [budgets, setBudgets] = useState(readBudgets);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);

    // 🔴 العيّنات تُوقَف عند الخروج من الصفحة — لا مؤقّت يبقى بعدها.
    useEffect(() => {
        const perf = (window as any).VencordNative?.perf;
        if (perf?.appMetrics == null) { setFailed(true); return; }

        let alive = true;
        const tick = () => {
            perf.appMetrics()
                .then((m: ProcMetric[]) => { if (alive) setMetrics(m); })
                .catch(() => { if (alive) setFailed(true); });
            if (alive) setHeap(heapMB());
        };
        tick();
        if (sampling) timer.current = setInterval(tick, 2000);

        return () => {
            alive = false;
            if (timer.current !== null) clearInterval(timer.current);
            timer.current = null;
        };
    }, [sampling]);

    const startupCost = useMemo(
        () => Math.round(getPluginStartups().reduce((n, r) => n + r.startMs + r.patchMs, 0)),
        []
    );

    if (failed) {
        return (
            <NoticeStrip tone="danger">
                {t("قياس العمليات متاح في تطبيق سطح المكتب فقط.", "Process metrics are available in the desktop app only.")}
            </NoticeStrip>
        );
    }

    const cpuTotal = metrics === null
        ? null
        : metrics.some(m => m.cpu !== null)
            ? Math.round(metrics.reduce((n, m) => n + (m.cpu ?? 0), 0) * 10) / 10
            : null;
    const memTotal = metrics === null ? null : metrics.reduce((n, m) => n + m.memMB, 0);

    const values: Record<BudgetKey, number | null> = {
        cpuPercent: cpuTotal,
        memoryMB: memTotal,
        heapMB: heap,
        startupMs: startupCost
    };

    const violations = (Object.keys(DEFAULT_BUDGETS) as BudgetKey[])
        .filter(k => budgets[k] > 0 && values[k] !== null && values[k]! > budgets[k]);

    const setBudget = (key: BudgetKey, value: number) => {
        writeBudget(key, value);
        setBudgets(b => ({ ...b, [key]: value }));
    };

    return (
        <>
            <NoticeStrip>
                {t("حدٌّ لكل مقياس، ومخالفةٌ حين يُتجاوَز. والقياس يعمل ما دامت هذه الصفحة مفتوحة ويتوقّف بإغلاقها — فلا يُكلّفك شيئاً وأنت لا تنظر.",
                    "A budget for each measure, and a violation when it is exceeded. Measuring runs while this page is open and stops when you leave — so it costs you nothing while you aren't looking.")}
            </NoticeStrip>

            <Card index={0}
                title={t("الميزانيات", "Budgets")}
                subtitle={t("غيّر أي حدّ كما تشاء. والصفر يُعطّل فحصه.", "Change any budget as you like. Zero disables its check.")}
                badge={violations.length === 0 ? t("ضمن الحدود", "Within budget") : t(`${violations.length} مخالفة`, `${violations.length} over`)}
                badgeTone={violations.length === 0 ? "ok" : "danger"}>

                <StatRow items={[
                    { label: t("المعالج الآن", "CPU now"), value: cpuTotal === null ? "—" : `${cpuTotal}%` },
                    { label: t("الذاكرة", "Memory"), value: memTotal === null ? "—" : `${memTotal} MB` },
                    { label: t("الكومة", "Heap"), value: heap === null ? "—" : `${heap} MB` },
                    { label: t("عمليات", "Processes"), value: metrics === null ? "—" : String(metrics.length) }
                ]} />

                <div className="esharq-pb-list">
                    {(Object.keys(DEFAULT_BUDGETS) as BudgetKey[]).map((key, i) => (
                        <BudgetRow key={key}
                            label={t(BUDGET_META[key].ar, BUDGET_META[key].en)}
                            hint={t(BUDGET_META[key].hintAr, BUDGET_META[key].hintEn)}
                            unit={BUDGET_META[key].unit}
                            value={values[key]}
                            budget={budgets[key]}
                            index={i}
                            onBudget={v => setBudget(key, v)} />
                    ))}
                </div>

                <button type="button" className="esharq-pb-toggle" onClick={() => setSampling(v => !v)}>
                    {sampling ? t("أوقف القياس", "Stop measuring") : t("استأنف القياس", "Resume measuring")}
                </button>
            </Card>

            <Card index={1}
                title={t("العمليات", "Processes")}
                subtitle={t("ديسكورد ليس عمليةً واحدة — وهذه أرقام كلٍّ منها.",
                    "Discord is not one process — these are the numbers for each of them.")}
                badge={metrics === null ? t("جارٍ…", "Working…") : String(metrics.length)}
                badgeTone="info">
                {metrics === null ? (
                    <div className="esharq-pb-empty">{t("أوّل عيّنة…", "First sample…")}</div>
                ) : (
                    <div className="esharq-pb-procs">
                        {[...metrics].sort((a, b) => b.memMB - a.memMB).map((m, i) => (
                            <div key={m.pid} className="esharq-pb-proc esharq-rise" style={stagger(i, 10)}>
                                <span className="esharq-pb-ptype">{m.type}</span>
                                <span className="esharq-pb-ppid">#{m.pid}</span>
                                <span className="esharq-pb-pcpu">{m.cpu === null ? "—" : `${m.cpu}%`}</span>
                                <span className="esharq-pb-pmem">{m.memMB} MB</span>
                            </div>
                        ))}
                    </div>
                )}
                <NoticeStrip>
                    {t("أوّل عيّنة لا تعطي رقم معالج: النسبة تُشتقّ من فارق عيّنتين. انتظر ثانيتين ويظهر.",
                        "The first sample gives no CPU figure: the percentage is derived from the difference between two samples. Wait two seconds and it appears.")}
                </NoticeStrip>
            </Card>

            <Card index={2}
                title={t("ما لا تقوله هذه الأرقام", "What these numbers do not say")}
                subtitle={t("حدود القياس، مكتوبةً — رقمٌ يُقرأ على غير معناه أسوأ من لا رقم.",
                    "The limits of the measurement, written down — a number read wrongly is worse than no number.")}>
                <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                    <div>{t("① المعالج يُقاس لكل عملية لا لكل إضافة. كل الإضافات تعمل في عملية المُصيِّر نفسها وخيطها نفسه، فلا سبيل لنسب دورةٍ إلى إضافةٍ بعينها.",
                        "① CPU is measured per process, not per plugin. All plugins run in the same renderer process and thread, so no cycle can be attributed to one plugin.")}</div>
                    <div>{t("② الرقم لحظيّ: يقفز بفتح قائمة أو تشغيل فيديو. القراءة الواحدة لا تصف جلسةً.",
                        "② The figure is instantaneous: it jumps when a menu opens or a video plays. One reading does not describe a session.")}</div>
                    <div>{t("③ «تكلفة الإقلاع» وحدها منسوبة إلى الإضافات — وهي مقيسة لحظة الإقلاع لا الآن.",
                        "③ Only “startup cost” is attributed to plugins — and it was measured at startup, not now.")}</div>
                    <div>{t("④ ولا شيء يُقاس وهذه الصفحة مغلقة.", "④ And nothing is measured while this page is closed.")}</div>
                </div>
            </Card>
        </>
    );
}
