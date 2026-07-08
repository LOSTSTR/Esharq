/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// ─── Layer 3: UI (render ONLY — no scanning, no scoring) ─────────────────────

import "./styles.css";

import { get as dsGet, set as dsSet } from "@api/DataStore";
import type { RenderModalProps } from "@vencord/discord-types";
import { t } from "@utils/esharqI18n";
import { saveFile } from "@utils/web";
import { Button, Modal, React, TextInput, useEffect, useState } from "@webpack/common";

import type { ImpactPhase, ImpactResult } from "./impactTest";
import { isImpactTestRunning, listImpactCandidates, runImpactTest } from "./impactTest";
import type { RuntimeReport } from "./runtimeProfiler";
import { runtimeProfiler } from "./runtimeProfiler";
import type { ScoredPlugin } from "./scoring";
import { summarize } from "./scoring";

type SortKey = "name" | "type" | "hooks" | "listeners" | "patches" | "pendingPatches" | "uiInjects" | "risk";

// ── الأساس المرجعي (baseline) — لقطة محفوظة محلياً للمقارنة عبر الزمن ─────────
const BASELINE_KEY = "EsharqDiagnostics_baseline";
interface Baseline {
    takenAt: string;
    risks: Record<string, number>; // اسم الإضافة → درجة الثِقل وقت الحفظ
}

function makeBaseline(rows: ScoredPlugin[]): Baseline {
    const risks: Record<string, number> = {};
    for (const r of rows) risks[r.name] = r.risk;
    return { takenAt: new Date().toISOString(), risks };
}

function exportJson(rows: ScoredPlugin[], heapMB: number | null, runtime: RuntimeReport | null) {
    const payload = {
        _esharq: "diagnostics",
        version: 2,
        takenAt: new Date().toISOString(),
        heapMB,
        runtime,
        plugins: rows,
    };
    const date = new Date().toISOString().slice(0, 10);
    saveFile(new File([JSON.stringify(payload, null, 2)], `esharq-diagnostics-${date}.json`, { type: "application/json" }));
}

// مخطط شراري صغير من عيّنات heap حقيقية — SVG polyline بلا مكتبات
function Sparkline({ series }: { series: number[]; }) {
    if (series.length < 2) return null;
    const w = 150, h = 30;
    const min = Math.min(...series), max = Math.max(...series);
    const span = Math.max(max - min, 1);
    const pts = series
        .map((v, i) => `${(i / (series.length - 1)) * w},${h - 3 - ((v - min) / span) * (h - 6)}`)
        .join(" ");
    return (
        <svg className="esharq-diag-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
            <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
    );
}

// أسماء عمليات Electron المعروفة → تسمية مفهومة
function procLabel(type: string): string {
    switch (type) {
        case "Browser": return t("الرئيسية", "Main");
        case "Tab": return t("العرض", "Renderer");
        case "GPU": return "GPU";
        case "Utility": return t("مساعدة", "Utility");
        default: return type;
    }
}

// ── لوحة قياس زمن التشغيل الحيّ (تظهر أثناء التسجيل) ─────────────────────────
function RuntimePanel({ report }: { report: RuntimeReport; }) {
    const cell = (label: string, value: React.ReactNode, warn = false) => (
        <div className="esharq-diag-metric">
            <div className="esharq-diag-metric-label">{label}</div>
            <div className="esharq-diag-metric-value" style={warn ? { color: "#ed4245" } : undefined}>{value}</div>
        </div>
    );
    return (
        <div className="esharq-diag-runtime">
            <div className="esharq-diag-metrics">
                {cell(t("المعالج الآن", "CPU now"), report.cpu.available ? `${report.cpu.totalNow}%` : t("غير متاح", "n/a"))}
                {cell(t("ذروة المعالج", "CPU peak"), report.cpu.available ? `${report.cpu.peakTotal}%` : "—")}
                {cell(t("ذاكرة JS", "JS heap"), report.heap.currentMB != null ? `${report.heap.currentMB} MB` : "—")}
                {cell(t("نموّ الذاكرة", "Mem growth"), `${report.heap.growthMBPerMin} MB/${t("د", "min")}`, report.heap.leakSuspected)}
                {cell("FPS", report.fps.now > 0 ? `${report.fps.now}${report.fps.min != null ? ` (${t("أدنى", "min")} ${report.fps.min})` : ""}` : "—", report.fps.min != null && report.fps.min < 30)}
                {cell(t("تأخّر متوسط", "Lag avg"), `${report.eventLoop.avgLagMs} ms`)}
                {cell("p95", `${report.eventLoop.p95LagMs} ms`, report.eventLoop.p95LagMs > 50)}
                {cell(t("تأخّر أقصى", "Lag max"), `${report.eventLoop.maxLagMs} ms`, report.eventLoop.maxLagMs > 100)}
                {cell(t("حجب الخيط", "Blocking"), `${report.longtasks.count}× / ${report.longtasks.totalBlockingMs}ms`, report.longtasks.totalBlockingMs > 500)}
                {cell(t("المدّة", "Duration"), `${report.durationSec}s`)}
            </div>
            {report.heap.series.length > 1 && (
                <div className="esharq-diag-sparkrow">
                    <span className="esharq-diag-fn-title">{t("مسار الذاكرة (آخر دقيقة)", "Heap trend (last minute)")}</span>
                    <Sparkline series={report.heap.series} />
                    <span className="esharq-diag-sparkminmax">
                        {report.heap.minMB}–{report.heap.maxMB} MB
                    </span>
                </div>
            )}
            {report.heap.leakSuspected && (
                <div className="esharq-diag-leak">{t("⚠️ اشتباه تسريب: خطّ أساس الذاكرة يرتفع باطّراد", "⚠️ Leak suspected: heap baseline is rising steadily")}</div>
            )}
            {report.cpu.available && report.cpu.perProcess.length > 0 && (
                <>
                    <div className="esharq-diag-fn-title">{t("عمليات ديسكورد (حقيقية من النظام)", "Discord processes (real system metrics)")}</div>
                    <table className="esharq-diag-table">
                        <thead>
                            <tr>
                                <th>{t("العملية", "Process")}</th>
                                <th className="num">PID</th>
                                <th className="num">CPU%</th>
                                <th className="num">RAM MB</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...report.cpu.perProcess].sort((a, b) => b.cpu - a.cpu).map(p => (
                                <tr key={p.pid} className="esharq-diag-row">
                                    <td>{procLabel(p.type)}</td>
                                    <td className="num">{p.pid}</td>
                                    <td className="num">{p.cpu}</td>
                                    <td className="num">{p.memMB}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
            {report.topDispatch.length > 0 && (
                <>
                    <div className="esharq-diag-fn-title">{t("أثقل أحداث Flux (زمن التنفيذ المتزامن)", "Heaviest Flux events (sync execution time)")}</div>
                    <table className="esharq-diag-table">
                        <thead>
                            <tr>
                                <th>{t("الحدث", "Event")}</th>
                                <th className="num">{t("مرّات", "count")}</th>
                                <th className="num">{t("متوسط ms", "avg ms")}</th>
                                <th className="num">{t("أقصى ms", "max ms")}</th>
                                <th className="num">{t("إجمالي ms", "total ms")}</th>
                                <th className="num">{t("مشتركون", "subs")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.topDispatch.map(d => (
                                <tr key={d.type} className="esharq-diag-row">
                                    <td>{d.type}</td>
                                    <td className="num">{d.count}</td>
                                    <td className="num">{d.avgMs}</td>
                                    <td className="num">{d.maxMs}</td>
                                    <td className="num">{d.totalMs}</td>
                                    <td className="num">{d.subscribers ?? "؟"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
            <div className="esharq-diag-fn-title">{t("أغلى الدوال (مقيسة)", "Top functions (measured)")}</div>
            {report.topFunctions.length === 0 ? (
                <div className="esharq-diag-empty">{t("لا قياسات بعد — تفاعل مع الواجهة أثناء التسجيل", "No samples yet — interact with the UI while recording")}</div>
            ) : (
                <table className="esharq-diag-table">
                    <thead>
                        <tr>
                            <th>{t("الدالة", "Function")}</th>
                            <th className="num">{t("نداء/ث", "calls/s")}</th>
                            <th className="num">{t("متوسط ms", "avg ms")}</th>
                            <th className="num">{t("أقصى ms", "max ms")}</th>
                            <th className="num">{t("إجمالي ms", "total ms")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {report.topFunctions.map(f => (
                            <tr key={f.name} className="esharq-diag-row">
                                <td>{f.name}</td>
                                <td className="num">{f.callsPerSec}</td>
                                <td className="num">{f.avgMs}</td>
                                <td className="num">{f.maxMs}</td>
                                <td className="num">{f.totalMs}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

// ── قياس الأثر السببي: تشغيل → قياس → إيقاف مؤقت → قياس → استعادة ────────────
function phaseLabel(ph: ImpactPhase): string {
    switch (ph) {
        case "measuring-on": return t("يقيس والإضافة تعمل…", "Measuring with plugin ON…");
        case "stopping": return t("يوقف الإضافة مؤقتاً…", "Temporarily stopping plugin…");
        case "measuring-off": return t("يقيس والإضافة متوقفة…", "Measuring with plugin OFF…");
        case "restoring": return t("يعيد تشغيل الإضافة…", "Restarting plugin…");
    }
}

const PHASE_SEC = 8;

function ImpactPanel() {
    const [{ eligible, excluded }] = useState(listImpactCandidates);
    const [target, setTarget] = useState("");
    const [phase, setPhase] = useState<ImpactPhase | null>(null);
    const [result, setResult] = useState<ImpactResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function run() {
        if (!target || isImpactTestRunning()) return;
        setResult(null);
        setError(null);
        try {
            const r = await runImpactTest(target, PHASE_SEC, setPhase);
            setResult(r);
        } catch (e) {
            setError(String(e instanceof Error ? e.message : e));
        } finally {
            setPhase(null);
        }
    }

    const verdictText = (v: ImpactResult["verdict"]) =>
        v === "high" ? t("أثر كبير — هذه الإضافة تكلّف جهازك فعلاً", "High impact — this plugin has a real cost on your machine")
            : v === "moderate" ? t("أثر ملحوظ", "Moderate impact")
                : t("أثر لا يُذكر ضمن هامش الضجيج", "Negligible — within noise margin");

    return (
        <div className="esharq-diag-impact">
            <div className="esharq-diag-fn-title">
                {t("قياس أثر إضافة (اختبار سببي حقيقي — يوقفها مؤقتاً ثم يعيدها)", "Plugin impact test (real causal test — temporarily stops it, then restores)")}
            </div>
            <div className="esharq-diag-impact-row">
                <select
                    className="esharq-diag-select"
                    value={target}
                    onChange={e => setTarget(e.currentTarget.value)}
                    disabled={phase != null}
                >
                    <option value="">{t("اختر إضافة…", "Pick a plugin…")}</option>
                    {eligible.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <Button size={Button.Sizes.SMALL} disabled={!target || phase != null} onClick={run}>
                    {phase != null ? phaseLabel(phase) : t(`قياس (${PHASE_SEC * 2 + 1} ثانية)`, `Measure (${PHASE_SEC * 2 + 1}s)`)}
                </Button>
            </div>
            <div className="esharq-diag-impact-note">
                {t(
                    `مؤهَّلة: ${eligible.length} إضافة. غير مؤهَّلة: ${excluded.filter(x => x.reason === "patches").length} تتطلب إعادة تشغيل (ترقيعات لا تُزال حيّاً)، ${excluded.filter(x => x.reason === "dependants").length} تعتمد عليها إضافات أخرى.`,
                    `Eligible: ${eligible.length}. Not eligible: ${excluded.filter(x => x.reason === "patches").length} need a restart (patches can't be unloaded live), ${excluded.filter(x => x.reason === "dependants").length} have dependants.`
                )}
            </div>
            {error && <div className="esharq-diag-leak">⚠️ {error}</div>}
            {result && (
                <div className="esharq-diag-impact-result">
                    <div className={`esharq-diag-verdict v-${result.verdict}`}>{verdictText(result.verdict)}</div>
                    {result.restoreFailed && (
                        <div className="esharq-diag-leak">
                            {t("⚠️ فشلت إعادة تشغيل الإضافة تلقائياً — فعّلها يدوياً من الإعدادات الآن!", "⚠️ Auto-restart failed — re-enable the plugin manually from settings NOW!")}
                        </div>
                    )}
                    <table className="esharq-diag-table">
                        <thead>
                            <tr>
                                <th>{t("المقياس", "Metric")}</th>
                                <th className="num">{t("تعمل", "ON")}</th>
                                <th className="num">{t("متوقفة", "OFF")}</th>
                                <th className="num">Δ</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="esharq-diag-row">
                                <td>{t("تأخّر الحلقة (متوسط ms)", "Loop lag (avg ms)")}</td>
                                <td className="num">{result.on.lagAvgMs}</td>
                                <td className="num">{result.off.lagAvgMs}</td>
                                <td className="num">{result.lagImprovementMs > 0 ? `-${result.lagImprovementMs}` : `+${-result.lagImprovementMs}`}</td>
                            </tr>
                            <tr className="esharq-diag-row">
                                <td>p95 (ms)</td>
                                <td className="num">{result.on.lagP95Ms}</td>
                                <td className="num">{result.off.lagP95Ms}</td>
                                <td className="num">{Math.round((result.on.lagP95Ms - result.off.lagP95Ms) * 100) / 100}</td>
                            </tr>
                            <tr className="esharq-diag-row">
                                <td>{t("حجب/دقيقة (ms)", "Blocking/min (ms)")}</td>
                                <td className="num">{result.on.blockingMsPerMin}</td>
                                <td className="num">{result.off.blockingMsPerMin}</td>
                                <td className="num">{result.blockingDropMsPerMin}</td>
                            </tr>
                            <tr className="esharq-diag-row">
                                <td>FPS</td>
                                <td className="num">{result.on.fpsAvg ?? "—"}</td>
                                <td className="num">{result.off.fpsAvg ?? "—"}</td>
                                <td className="num">{result.fpsGain != null ? (result.fpsGain >= 0 ? `+${result.fpsGain}` : result.fpsGain) : "—"}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="esharq-diag-impact-note">
                        {t("عيّنة واحدة قصيرة قد تتأثر بضجيج اللحظة — كرّر القياس مرّتين للتأكيد.", "A single short sample can be noisy — repeat the test twice to confirm.")}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── توصيات مبنية على القياسات الحقيقية فقط — كل توصية تذكر الرقم الذي أنتجها ──
function buildRecommendations(rows: ScoredPlugin[], runtime: RuntimeReport | null): string[] {
    const out: string[] = [];
    const pendingTotal = rows.reduce((a, r) => a + r.pendingPatches, 0);
    const heavy = rows.filter(r => r.type === "continuous").slice(0, 3).map(r => `${r.name} (${r.risk})`);

    if (runtime) {
        if (runtime.heap.leakSuspected)
            out.push(t(
                `🔴 نموّ ذاكرة مطّرد ${runtime.heap.growthMBPerMin}MB/د — رشّح الأثقل للمقياس السببي: ${heavy.join("، ")}`,
                `🔴 Sustained heap growth ${runtime.heap.growthMBPerMin}MB/min — run the impact test on the heaviest: ${heavy.join(", ")}`
            ));
        if (runtime.eventLoop.p95LagMs > 50)
            out.push(t(
                `🟠 p95 لتأخّر الحلقة ${runtime.eventLoop.p95LagMs}ms (>50) — الخيط الرئيسي مضغوط.`,
                `🟠 Event-loop p95 is ${runtime.eventLoop.p95LagMs}ms (>50) — the main thread is strained.`
            ));
        if (runtime.longtasks.count > 0 && runtime.longtasks.maxMs > 200)
            out.push(t(
                `🟠 ${runtime.longtasks.count} مهمة طويلة (أقصاها ${runtime.longtasks.maxMs}ms) — توقّفات محسوسة في الواجهة.`,
                `🟠 ${runtime.longtasks.count} long tasks (max ${runtime.longtasks.maxMs}ms) — perceptible UI stalls.`
            ));
        const d0 = runtime.topDispatch[0];
        if (d0 && d0.totalMs > 500)
            out.push(t(
                `🟡 أثقل حدث Flux: ${d0.type} — ${d0.totalMs}ms إجمالاً (${d0.count} مرة${d0.subscribers != null ? `، ${d0.subscribers} مشتركاً` : ""}).`,
                `🟡 Heaviest Flux event: ${d0.type} — ${d0.totalMs}ms total (${d0.count}×${d0.subscribers != null ? `, ${d0.subscribers} subscribers` : ""}).`
            ));
        if (runtime.fps.min != null && runtime.fps.min < 30)
            out.push(t(
                `🟠 أدنى FPS مسجَّل ${runtime.fps.min} — هبوط سلاسة ملموس أثناء التسجيل.`,
                `🟠 Minimum recorded FPS is ${runtime.fps.min} — a perceptible smoothness drop while recording.`
            ));
    }
    if (pendingTotal > 0)
        out.push(t(
            `🟡 ${pendingTotal} ترقيع لم يُطبَّق (عمود «معلّقة») — قد تكون وحدات كسولة لم تُحمَّل، أو ترقيعات كسرها تحديث ديسكورد.`,
            `🟡 ${pendingTotal} patches never applied ("Pending" column) — could be lazy modules not loaded yet, or patches broken by a Discord update.`
        ));
    if (out.length === 0)
        out.push(runtime
            ? t("✅ لا ملاحظات — كل المؤشرات المقيسة ضمن الطبيعي.", "✅ Nothing to flag — every measured indicator is within normal range.")
            : t("ℹ️ شغّل «تسجيل الأداء» للحصول على توصيات مبنية على قياسات حيّة.", "ℹ️ Start a profiling recording to get recommendations based on live measurements."));
    return out;
}

export function DiagnosticsModal({ modalProps, initial, heapMB, rescan, interval = 5 }: {
    modalProps: RenderModalProps;
    initial: ScoredPlugin[];
    heapMB: number | null;
    rescan: () => ScoredPlugin[];
    interval?: number;
}) {
    const [rows, setRows] = useState<ScoredPlugin[]>(initial);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("risk");
    const [asc, setAsc] = useState(false);

    // ── Live monitoring ──
    const [live, setLive] = useState(false);
    const [countdown, setCountdown] = useState(interval);
    const [resetNonce, setResetNonce] = useState(0); // bump → restart the timer (manual re-scan)

    // ── Runtime profiling (opt-in) — real CPU/RAM/function timing while recording ──
    const [recording, setRecording] = useState(false);
    const [runtime, setRuntime] = useState<RuntimeReport | null>(null);

    // ── الأساس المرجعي: يُحمَّل مرة عند الفتح؛ الحفظ يستبدل المحفوظ ──
    const [baseline, setBaseline] = useState<Baseline | null>(null);
    useEffect(() => {
        let alive = true;
        dsGet<Baseline>(BASELINE_KEY).then(b => { if (alive && b) setBaseline(b); }).catch(() => { /* لا أساس بعد */ });
        return () => { alive = false; };
    }, []);
    async function saveBaseline() {
        const b = makeBaseline(rows);
        try { await dsSet(BASELINE_KEY, b); setBaseline(b); } catch { /* تخزين غير متاح */ }
    }

    // Start/stop the profiler with the toggle; refresh the report every 1s while on.
    // Cleanup stops the profiler on toggle-off / modal close → no global hook left behind.
    useEffect(() => {
        if (!recording) return;
        runtimeProfiler.start();
        setRuntime(runtimeProfiler.getReport());
        const id = setInterval(() => setRuntime(runtimeProfiler.getReport()), 1000);
        return () => { clearInterval(id); runtimeProfiler.stop(); };
    }, [recording]);

    // Manual re-scan: refresh now AND reset the live countdown (no double allocation,
    // the previous rows are released for GC once setRows replaces them).
    function doRescan() {
        setRows(rescan());
        setResetNonce(n => n + 1);
    }

    function startLive() {
        // auto-sort by load (desc) so the heaviest plugins surface immediately
        setSortKey("risk");
        setAsc(false);
        setLive(true);
    }

    // Single 1s ticking loop while live. `remaining` is a closure local (not state),
    // so updates are predictable. Cleanup clears the timer on stop / deps-change /
    // modal close (unmount) → no leak, zero cost when not monitoring.
    useEffect(() => {
        if (!live) {
            setCountdown(interval);
            return;
        }
        let remaining = interval;
        setCountdown(remaining);
        const id = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                setRows(rescan());
                remaining = interval;
            }
            setCountdown(remaining);
        }, 1000);
        return () => clearInterval(id);
    }, [live, interval, resetNonce, rescan]);

    // built per-render so language (t) is always current
    const columns: { key: SortKey; label: string; tip: string; num: boolean; }[] = [
        { key: "name", label: t("الإضافة", "Plugin"), tip: t("اسم الإضافة", "Plugin name"), num: false },
        { key: "type", label: t("النوع", "Type"), tip: t("مستمرة في الخلفية أم تعمل عند الطلب فقط", "Runs continuously in the background vs. only on demand"), num: false },
        { key: "hooks", label: t("أوامر", "Hooks"), tip: t("عدد الأوامر المسجّلة", "Registered slash commands"), num: true },
        { key: "listeners", label: t("مستمعون", "Listeners"), tip: t("اشتراكات Flux/Dispatcher", "Flux/Dispatcher subscriptions"), num: true },
        { key: "patches", label: t("ترقيعات", "Patches"), tip: t("ترقيعات كود webpack", "Webpack code patches"), num: true },
        { key: "pendingPatches", label: t("معلّقة", "Pending"), tip: t("ترقيعات لم تُطبَّق بعد (وحدتها لم تُطابَق) — قد تكون وحدة كسولة لم تُحمَّل، أو ترقيعاً كسره تحديث ديسكورد", "Patches not applied yet (module never matched) — may be a lazy module not loaded yet, or a patch broken by a Discord update"), num: true },
        { key: "uiInjects", label: t("حقن واجهة", "UI Injects"), tip: t("قوائم سياق + عناصر واجهة", "Context menus + UI render surfaces"), num: true },
        { key: "risk", label: t("الثِقل", "Load"), tip: "(patches×2)+(listeners×3)+(uiInjects×1.5)", num: true },
    ];

    function sortBy(key: SortKey) {
        if (key === sortKey) setAsc(!asc);
        else { setSortKey(key); setAsc(key === "name" || key === "type"); }
    }

    const q = search.trim().toLowerCase();
    const view = rows
        .filter(r => !q || r.name.toLowerCase().includes(q))
        .sort((a, b) => {
            const av = a[sortKey], bv = b[sortKey];
            const cmp = typeof av === "string"
                ? (av as string).localeCompare(bv as string)
                : (av as number) - (bv as number);
            return asc ? cmp : -cmp;
        });

    const summary = summarize(rows);

    return (
        <Modal {...modalProps} size="lg" title={t("تشخيص إِشراق", "Esharq Diagnostics")}>
            <div className="esharq-diag">
                <div className="esharq-diag-sub">
                    {live
                        ? t("المراقبة الحية مُفعّلة — تحديث تلقائي", "Live monitoring active — auto-refreshing")
                        : t("لقطة موارد الإضافات لمرة واحدة", "One-time plugin resource snapshot")}
                </div>

                <div className="esharq-diag-toolbar">
                    <div className="esharq-diag-searchwrap">
                        <TextInput
                            placeholder={t("بحث...", "Search...")}
                            value={search}
                            onChange={setSearch}
                        />
                    </div>
                    <div className="esharq-diag-actions">
                        {heapMB != null && (
                            <span className="esharq-diag-heap" title={t("ذاكرة JS الحالية", "Current JS heap")}>
                                Heap: {heapMB} MB
                            </span>
                        )}
                        {live && (
                            <span
                                className="esharq-diag-heap"
                                style={{ color: "var(--text-positive, #3ba55c)" }}
                                title={t("التحديث التلقائي مُفعّل", "Auto-refresh is on")}
                            >
                                ⟳ {t("تحديث خلال", "Refresh in")} {countdown}{t("ث", "s")}
                            </span>
                        )}
                        <Button size={Button.Sizes.SMALL} onClick={doRescan}>
                            {t("إعادة الفحص", "Re-scan")}
                        </Button>
                        {live ? (
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={() => setLive(false)}>
                                {t("إيقاف المراقبة", "Stop Monitoring")}
                            </Button>
                        ) : (
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.GREEN} onClick={startLive}>
                                {t("بدء المراقبة الحية", "Start Live Monitoring")}
                            </Button>
                        )}
                        {recording ? (
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={() => setRecording(false)}>
                                {t("إيقاف التسجيل", "Stop Recording")}
                            </Button>
                        ) : (
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.GREEN} onClick={() => setRecording(true)}>
                                {t("⏺ تسجيل الأداء", "⏺ Record Profile")}
                            </Button>
                        )}
                        <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => exportJson(view, heapMB, runtime)}>
                            {t("تصدير JSON", "Export JSON")}
                        </Button>
                        <Button
                            size={Button.Sizes.SMALL}
                            color={Button.Colors.PRIMARY}
                            onClick={saveBaseline}
                        >
                            {t("حفظ كأساس", "Save baseline")}
                        </Button>
                    </div>
                </div>

                {recording && runtime && <RuntimePanel report={runtime} />}

                <ImpactPanel />

                <div className="esharq-diag-recs">
                    <div className="esharq-diag-fn-title">{t("الخلاصة والتوصيات (من القياسات الفعلية)", "Findings & recommendations (from real measurements)")}</div>
                    {buildRecommendations(rows, runtime).map((r, i) => (
                        <div key={i} className="esharq-diag-rec">{r}</div>
                    ))}
                </div>

                <div className="esharq-diag-tablewrap">
                    <table className="esharq-diag-table">
                        <thead>
                            <tr>
                                {columns.map(c => (
                                    <th
                                        key={c.key}
                                        title={c.tip}
                                        className={c.num ? "num" : ""}
                                        onClick={() => sortBy(c.key)}
                                    >
                                        {c.label}{sortKey === c.key ? (asc ? " ▲" : " ▼") : ""}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {view.length === 0 ? (
                                <tr><td colSpan={columns.length} className="esharq-diag-empty">{t("لا نتائج", "No results")}</td></tr>
                            ) : view.map(r => (
                                <tr
                                    key={r.name}
                                    className={`esharq-diag-row lvl-${r.level}`}
                                    // live + heavy (risk > 25) → bolder background to spotlight the worst offenders
                                    style={live && r.risk > 25 ? { background: "rgb(237 66 69 / 22%)" } : undefined}
                                >
                                    <td>{r.name}</td>
                                    <td>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                padding: "2px 8px",
                                                borderRadius: 8,
                                                whiteSpace: "nowrap",
                                                background: r.type === "continuous" ? "rgb(250 168 26 / 18%)" : "rgb(148 155 164 / 15%)",
                                                color: r.type === "continuous" ? "#faa81a" : "var(--text-muted)",
                                            }}
                                        >
                                            {r.type === "continuous" ? t("مستمرة", "Continuous") : t("عند الطلب", "On-demand")}
                                        </span>
                                    </td>
                                    <td className="num">{r.hooks}</td>
                                    <td className="num">{r.listeners}</td>
                                    <td className="num">{r.patches}</td>
                                    <td className="num">
                                        {r.pendingPatches > 0
                                            ? <span className="esharq-diag-pending">{r.pendingPatches}</span>
                                            : 0}
                                    </td>
                                    <td className="num">{r.uiInjects}</td>
                                    <td className="num">
                                        <span className={`esharq-diag-badge ${r.level}`}>{r.risk}</span>
                                        {baseline?.risks[r.name] != null && Math.abs(r.risk - baseline.risks[r.name]) >= 1 && (
                                            <span
                                                className="esharq-diag-delta"
                                                title={t(`مقارنة بالأساس المحفوظ (${new Date(baseline.takenAt).toLocaleDateString()})`, `vs saved baseline (${new Date(baseline.takenAt).toLocaleDateString()})`)}
                                            >
                                                {r.risk > baseline.risks[r.name] ? `+${Math.round((r.risk - baseline.risks[r.name]) * 10) / 10}` : Math.round((r.risk - baseline.risks[r.name]) * 10) / 10}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="esharq-diag-foot">
                    {view.length} / {rows.length} {t("إضافة", "plugins")}
                    {"  ·  "}{t("مستمرة", "Continuous")}: {summary.continuous}/{summary.total}
                    {"  ·  "}{t("إجمالي الثِقل", "Total load")}: {summary.totalRisk}
                    {baseline && (() => {
                        const baseTotal = Object.values(baseline.risks).reduce((a, b) => a + b, 0);
                        const dt = Math.round((summary.totalRisk - baseTotal) * 10) / 10;
                        const added = rows.filter(r => baseline.risks[r.name] == null).length;
                        return (
                            <>
                                {"  ·  "}
                                {t(
                                    `مقارنة بالأساس (${new Date(baseline.takenAt).toLocaleDateString()}): الثِقل ${dt >= 0 ? "+" : ""}${dt}${added ? `، +${added} إضافة جديدة` : ""}`,
                                    `vs baseline (${new Date(baseline.takenAt).toLocaleDateString()}): load ${dt >= 0 ? "+" : ""}${dt}${added ? `, +${added} new plugins` : ""}`
                                )}
                            </>
                        );
                    })()}
                </div>
            </div>
        </Modal>
    );
}
