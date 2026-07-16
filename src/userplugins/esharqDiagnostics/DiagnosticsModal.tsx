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
import { Button, Modal, React, TextInput, Tooltip, useEffect, useState } from "@webpack/common";

import type { ImpactPhase, ImpactResult } from "./impactTest";
import { isImpactTestRunning, listImpactCandidates, runImpactTest } from "./impactTest";
import type { RuntimeReport } from "./runtimeProfiler";
import { runtimeProfiler } from "./runtimeProfiler";
import { sampleHeapMB } from "./scanner";
import type { ScoredPlugin, SnapshotSummary } from "./scoring";
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

// The file is meant to be read later, away from this UI, so it carries its own
// context: what the numbers mean and whether a profile was actually recorded.
// A bare list of scores is not reviewable six weeks from now.
function exportJson(rows: ScoredPlugin[], runtime: RuntimeReport | null, summary: SnapshotSummary) {
    // Sampled HERE, not taken from the modal's open-time prop: the readme promises
    // "at export time", and a stale prop made that a lie — one export read 413 MB
    // beside runtime.heap.currentMB of 322 with no way to tell why (the heap sawtooths
    // ±100 MB within a second, so both were true, minutes apart).
    const heapMB = sampleHeapMB();
    const payload = {
        _esharq: "diagnostics",
        version: 4,
        takenAt: new Date().toISOString(),
        readme: {
            risk: "Static load score per plugin (higher = heavier). Derived from hooks/listeners/patches/uiInjects — it is NOT measured CPU.",
            runtime: runtime
                ? "Live measurements from a profiling recording: heap samples, event-loop lag (avg/max/p95) and the heaviest Flux dispatch types."
                : "null — no profiling recording was running when this was exported. Press 'Record Profile', use Discord normally for a minute, then export again for live CPU/RAM numbers.",
            heapMB: "Renderer JS heap sampled at export time, in MB. Expect it to differ from runtime.heap.currentMB (the last sample of the recording) — GC makes the heap sawtooth by ~100 MB within a second, so both are true at different instants.",
            cpu: "Percent per process, derived from deltas of Electron's cumulativeCPUUsage counter. 100% = one core fully busy, so a process may exceed 100% across cores. null = unreadable (never a fabricated 0); the first sample of a recording is always null as there is no previous one to subtract.",
            durationSec: "Measured span of the recording. Freezes when you press Stop, so exporting later does not inflate it.",
        },
        summary,
        heapMB,
        runtime,
        plugins: rows,
    };
    const date = new Date().toISOString().slice(0, 10);
    saveFile(new File([JSON.stringify(payload, null, 2)], `esharq-diagnostics-${date}.json`, { type: "application/json" }));
}

// A control whose label cannot carry its own meaning ("Save baseline" tells you
// nothing about what it buys you) gets a native tooltip saying what it does and why.
function HintButton({ hint, children, ...props }: React.ComponentProps<typeof Button> & { hint: string; }) {
    return (
        <Tooltip text={hint}>
            {tooltipProps => <Button {...tooltipProps} {...props}>{children}</Button>}
        </Tooltip>
    );
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
            {/* Blocking is what a user actually feels. Knowing it happened is useless
                without knowing who did it, so name the culprits. */}
            {report.longtasks.blame.length > 0 && (
                <>
                    <div className="esharq-diag-fn-title">
                        {t("مَن حجب الخيط الرئيسي (منسوبة للحدث المتزامن معها)", "What blocked the main thread (blamed on the dispatch it overlapped)")}
                    </div>
                    <table className="esharq-diag-table">
                        <thead>
                            <tr>
                                <th>{t("الحدث", "Event")}</th>
                                <th className="num">{t("مرّات", "Tasks")}</th>
                                <th className="num">{t("حجب (مللي)", "Blocked (ms)")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.longtasks.blame.map(b => (
                                <tr key={b.type} className="esharq-diag-row">
                                    <td>{b.type === "(unattributed)"
                                        ? t("(غير منسوبة — ليست حدث Flux: رسم React أو جامع مهملات)", "(unattributed — not a Flux dispatch: React render or GC)")
                                        : b.type}</td>
                                    <td className="num">{b.count}</td>
                                    <td className="num">{b.totalMs}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
            {report.cpu.perProcess.length > 0 && (
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
                            {/* RAM is readable even when CPU is not, so sort by memory and
                                print "؟" for an unreadable CPU rather than a fake 0. */}
                            {[...report.cpu.perProcess].sort((a, b) => b.memMB - a.memMB).map(p => (
                                <tr key={p.pid} className="esharq-diag-row">
                                    <td>{procLabel(p.type)}</td>
                                    <td className="num">{p.pid}</td>
                                    <td className="num">{p.cpu != null ? p.cpu : t("؟", "?")}</td>
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
                <HintButton
                    size={Button.Sizes.SMALL}
                    disabled={!target || phase != null}
                    onClick={run}
                    hint={t(
                        `يقيس الإضافة وهي تعمل ثم يوقفها مؤقتاً ويقيس مرة أخرى، فيخبرك بالفرق الذي تسبّبه هي وحدها — لا تخميناً. تُعاد الإضافة تلقائياً بعد ${PHASE_SEC * 2 + 1} ثانية. لا تلمس ديسكورد أثناء القياس حتى لا تُلوّث النتيجة.`,
                        `Measures the plugin running, then temporarily stops it and measures again, so you get the difference it alone causes — not a guess. It is switched back on automatically after ${PHASE_SEC * 2 + 1}s. Leave Discord alone while it runs, or you contaminate the result.`
                    )}
                >
                    {phase != null ? phaseLabel(phase) : t(`قياس (${PHASE_SEC * 2 + 1} ثانية)`, `Measure (${PHASE_SEC * 2 + 1}s)`)}
                </HintButton>
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
        if (runtime.longtasks.count > 0 && runtime.longtasks.maxMs > 200) {
            // Point at the culprit now that we can attribute the blocking.
            const top = runtime.longtasks.blame.find(b => b.type !== "(unattributed)");
            const who = top
                ? t(` أكثرها تزامناً مع ${top.type} (${top.totalMs}ms).`, ` Mostly overlapping ${top.type} (${top.totalMs}ms).`)
                : t(" ولا واحدة منها حدث Flux — الأرجح رسم React أو جامع المهملات.", " None of them were Flux dispatches — most likely React rendering or GC.");
            out.push(t(
                `🟠 ${runtime.longtasks.count} مهمة طويلة (أقصاها ${runtime.longtasks.maxMs}ms) — توقّفات محسوسة في الواجهة.${who}`,
                `🟠 ${runtime.longtasks.count} long tasks (max ${runtime.longtasks.maxMs}ms) — perceptible UI stalls.${who}`
            ));
        }
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
    if (pendingTotal > 0) {
        // Naming the plugins makes this actionable: an unapplied patch means that
        // plugin is silently doing part of its job, and a bare total hides who.
        const worst = rows
            .filter(r => r.pendingPatches > 0)
            .sort((a, b) => b.pendingPatches - a.pendingPatches)
            .slice(0, 3)
            .map(r => `${r.name} (${r.pendingPatches})`);
        out.push(t(
            `🟡 ${pendingTotal} ترقيع لم يُطبَّق — أكثرها: ${worst.join("، ")}. الإضافة بترقيع معلّق تعمل جزئياً بصمت. السبب غالباً وحدة كسولة لم تُحمَّل بعد (يزول عند استخدام الميزة)، أو ترقيع كسره تحديث ديسكورد (يحتاج إصلاحاً).`,
            `🟡 ${pendingTotal} patches never applied — worst: ${worst.join(", ")}. A plugin with a pending patch is silently doing only part of its job. Usually a lazy module not loaded yet (clears once you use the feature), or a patch broken by a Discord update (needs fixing).`
        ));
    }
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
    // The prop is only a seed. It was sampled once when the modal opened, yet the
    // badge below calls itself "Current JS heap" — frozen minutes later it was simply
    // wrong. Refreshed on every re-scan and on each second of a recording.
    const [heapNow, setHeapNow] = useState<number | null>(heapMB);
    const [countdown, setCountdown] = useState(interval);
    const [resetNonce, setResetNonce] = useState(0); // bump → restart the timer (manual re-scan)

    // ── Runtime profiling (opt-in) — real CPU/RAM/function timing while recording ──
    // Seeded from the profiler, not from `false`: a recording outlives this modal,
    // so re-opening must show the run that is still going rather than claim idle.
    const [recording, setRecording] = useState(() => runtimeProfiler.recording);
    // Seeded from hasData, not from `recording`: the profiler keeps a finished run's
    // report, but this used to reseed to null unless a recording was live RIGHT NOW.
    // So record → Stop → close the modal → reopen → the numbers were gone and Export
    // wrote `runtime: null`, while getReport() still held the whole run.
    const [runtime, setRuntime] = useState<RuntimeReport | null>(() => runtimeProfiler.hasData ? runtimeProfiler.getReport() : null);

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

    // The recording deliberately OUTLIVES this modal. You have to close the modal to
    // use Discord, and profiling an idle modal measures nothing — so unmount must not
    // stop it. Only the Stop button does (or the plugin being disabled, see index.tsx).
    // Cleanup therefore tears down the 1s UI poll and nothing else.
    useEffect(() => {
        if (!recording) return;
        runtimeProfiler.start(); // no-op if already running
        setRuntime(runtimeProfiler.getReport());
        const id = setInterval(() => {
            setRuntime(runtimeProfiler.getReport());
            setHeapNow(sampleHeapMB());
        }, 1000);
        return () => clearInterval(id);
    }, [recording]);

    function stopRecording() {
        runtimeProfiler.stop();
        setRecording(false);
        setRuntime(runtimeProfiler.getReport()); // keep the finished run on screen to read/export
    }

    // Manual re-scan: refresh now AND reset the live countdown (no double allocation,
    // the previous rows are released for GC once setRows replaces them).
    function doRescan() {
        setRows(rescan());
        setHeapNow(sampleHeapMB());
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
                setHeapNow(sampleHeapMB());
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
        // Says what it is AND what it is not. This score is blind to a plugin that
        // hooks intl instead of patching (DiscordArabicizer scores 0 while being the
        // busiest thing measured), so calling it "cost" would be a lie.
        {
            key: "risk", label: t("الثِقل", "Load"), num: true,
            tip: t(
                "مساحة تماسّ بنيوية، وليست استهلاكاً مقيساً للمعالج: (ترقيعات×2)+(مستمعون×3)+(حقن×1.5). رقم مرتفع = سطح أوسع للتأثير، لا بطء مؤكَّد. للتكلفة الحقيقية استخدم «تسجيل الأداء» أو «قياس أثر إضافة».",
                "Structural surface area, NOT measured CPU: (patches×2)+(listeners×3)+(uiInjects×1.5). A high number means a wider surface to affect things, not confirmed slowness. For real cost use Record Profile or the plugin impact test."
            ),
        },
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
                        {heapNow != null && (
                            <span className="esharq-diag-heap" title={t("ذاكرة JS الحالية", "Current JS heap")}>
                                Heap: {heapNow} MB
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
                        <HintButton
                            size={Button.Sizes.SMALL}
                            onClick={doRescan}
                            hint={t(
                                "يُعيد قياس بصمة كل إضافة الآن. لقطة لحظية واحدة — لا تترك شيئاً يعمل في الخلفية.",
                                "Re-measures every plugin's footprint right now. A single instant snapshot — it leaves nothing running in the background."
                            )}
                        >
                            {t("إعادة الفحص", "Re-scan")}
                        </HintButton>
                        {live ? (
                            <HintButton
                                size={Button.Sizes.SMALL}
                                color={Button.Colors.RED}
                                onClick={() => setLive(false)}
                                hint={t("إيقاف إعادة الفحص التلقائي.", "Stop re-scanning automatically.")}
                            >
                                {t("إيقاف المراقبة", "Stop Monitoring")}
                            </HintButton>
                        ) : (
                            <HintButton
                                size={Button.Sizes.SMALL}
                                color={Button.Colors.GREEN}
                                onClick={startLive}
                                hint={t(
                                    `يُعيد الفحص تلقائياً كل ${interval} ثانية بينما هذه النافذة مفتوحة، لترى الأرقام تتغيّر لحظياً. يتوقّف بإغلاق النافذة.`,
                                    `Re-scans automatically every ${interval}s while this window is open, so you watch the numbers move. Stops when the window closes.`
                                )}
                            >
                                {t("بدء المراقبة الحية", "Start Live Monitoring")}
                            </HintButton>
                        )}
                        {recording ? (
                            <HintButton
                                size={Button.Sizes.SMALL}
                                color={Button.Colors.RED}
                                onClick={stopRecording}
                                hint={t(
                                    "أوقف التسجيل واعرض النتائج. تبقى النتائج على الشاشة لتقرأها أو تُصدّرها.",
                                    "Stop recording and show the results. They stay on screen for you to read or export."
                                )}
                            >
                                {t("إيقاف التسجيل", "Stop Recording")}
                            </HintButton>
                        ) : (
                            <HintButton
                                size={Button.Sizes.SMALL}
                                color={Button.Colors.GREEN}
                                onClick={() => setRecording(true)}
                                hint={t(
                                    "يقيس المعالج والذاكرة وتأخّر الواجهة فعلياً أثناء استخدامك. الطريقة: اضغط، ثم أغلق هذه النافذة وتصفّح ديسكورد دقيقة أو دقيقتين، ثم عُد وأوقفه. التسجيل يستمرّ بعد إغلاق النافذة — الأيقونة في الأعلى تصير حمراء طوال التسجيل.",
                                    "Measures real CPU, memory and UI lag while you use Discord. How: press it, close this window, use Discord normally for a minute or two, then come back and stop it. Recording continues after the window closes — the icon up top stays red the whole time."
                                )}
                            >
                                {t("⏺ تسجيل الأداء", "⏺ Record Profile")}
                            </HintButton>
                        )}
                        {/* `rows`, not `view`: exporting the search-filtered list silently
                            produced a partial report that still looked complete. */}
                        <HintButton
                            size={Button.Sizes.SMALL}
                            color={Button.Colors.PRIMARY}
                            onClick={() => exportJson(rows, runtime, summary)}
                            hint={t(
                                "يحفظ ملفاً فيه كل الإضافات وأرقامها، مع قياسات التسجيل إن كان يعمل — لمراجعته لاحقاً أو مشاركته. سجّل الأداء أولاً لتحصل على أرقام حيّة.",
                                "Saves a file with every plugin and its numbers, plus the recorded measurements if a profile was running — to review later or share. Record a profile first to get live numbers in it."
                            )}
                        >
                            {t("تصدير JSON", "Export JSON")}
                        </HintButton>
                        <HintButton
                            size={Button.Sizes.SMALL}
                            color={Button.Colors.PRIMARY}
                            onClick={saveBaseline}
                            hint={baseline
                                ? t(
                                    `يستبدل الأساس المحفوظ (${new Date(baseline.takenAt).toLocaleDateString()}) بأرقام اليوم، فتصير المقارنات من الآن.`,
                                    `Replaces the saved baseline (${new Date(baseline.takenAt).toLocaleDateString()}) with today's numbers, so comparisons start from now.`
                                )
                                : t(
                                    "يحفظ أرقام اليوم كنقطة مرجعية. بعدها يظهر بجانب كل إضافة كم ثقُلت ▲ أو خفّت ▼ مقارنةً بها — احفظه وأنت راضٍ عن الأداء، لتعرف لاحقاً ما الذي أبطأ ديسكورد بالضبط.",
                                    "Saves today's numbers as a reference point. From then on each plugin shows how much heavier ▲ or lighter ▼ it got against it — save one while performance feels good, so later you know exactly what slowed Discord down."
                                )}
                        >
                            {t("حفظ كأساس", "Save baseline")}
                        </HintButton>
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
                                        {(() => {
                                            const base = baseline?.risks[r.name];
                                            const d = base != null ? Math.round((r.risk - base) * 10) / 10 : null;
                                            const show = d != null && Math.abs(d) >= 1;
                                            return (
                                                // One nowrap row: the badge is a padded pill, so letting the
                                                // delta be a loose sibling made it wrap under the number.
                                                <div className="esharq-diag-weight">
                                                    <span className={`esharq-diag-badge ${r.level}`}>{r.risk}</span>
                                                    {show && (
                                                        <span
                                                            // Lower load is better, so a drop is the good direction.
                                                            className={`esharq-diag-delta ${d < 0 ? "better" : "worse"}`}
                                                            title={t(`مقارنة بالأساس المحفوظ (${new Date(baseline!.takenAt).toLocaleDateString()})`, `vs saved baseline (${new Date(baseline!.takenAt).toLocaleDateString()})`)}
                                                        >
                                                            {d < 0 ? `▼${Math.abs(d)}` : `▲${d}`}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })()}
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
