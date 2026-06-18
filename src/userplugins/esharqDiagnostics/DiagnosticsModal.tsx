/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// ─── Layer 3: UI (render ONLY — no scanning, no scoring) ─────────────────────

import "./styles.css";

import type { RenderModalProps } from "@vencord/discord-types";
import { t } from "@utils/esharqI18n";
import { saveFile } from "@utils/web";
import { Button, Modal, React, TextInput, useEffect, useState } from "@webpack/common";

import type { RuntimeReport } from "./runtimeProfiler";
import { runtimeProfiler } from "./runtimeProfiler";
import type { ScoredPlugin } from "./scoring";
import { summarize } from "./scoring";

type SortKey = "name" | "type" | "hooks" | "listeners" | "patches" | "uiInjects" | "risk";

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
                {cell(t("تأخّر متوسط", "Lag avg"), `${report.eventLoop.avgLagMs} ms`)}
                {cell(t("تأخّر أقصى", "Lag max"), `${report.eventLoop.maxLagMs} ms`, report.eventLoop.maxLagMs > 100)}
                {cell(t("حجب الخيط", "Blocking"), `${report.longtasks.count}× / ${report.longtasks.totalBlockingMs}ms`, report.longtasks.totalBlockingMs > 500)}
                {cell(t("المدّة", "Duration"), `${report.durationSec}s`)}
            </div>
            {report.heap.leakSuspected && (
                <div className="esharq-diag-leak">{t("⚠️ اشتباه تسريب: خطّ أساس الذاكرة يرتفع باطّراد", "⚠️ Leak suspected: heap baseline is rising steadily")}</div>
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
                    </div>
                </div>

                {recording && runtime && <RuntimePanel report={runtime} />}

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
                                    <td className="num">{r.uiInjects}</td>
                                    <td className="num"><span className={`esharq-diag-badge ${r.level}`}>{r.risk}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="esharq-diag-foot">
                    {view.length} / {rows.length} {t("إضافة", "plugins")}
                    {"  ·  "}{t("مستمرة", "Continuous")}: {summary.continuous}/{summary.total}
                    {"  ·  "}{t("إجمالي الثِقل", "Total load")}: {summary.totalRisk}
                </div>
            </div>
        </Modal>
    );
}
