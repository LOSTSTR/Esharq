/*
 * Esharq — EsharqDiagnostics runtime profiler (Layer 4: live runtime metrics)
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * قياس زمن التشغيل الحقيقي — يعمل فقط أثناء «التسجيل» (opt-in)، صفر تكلفة خارجه.
 * كل البيانات بعدّادات O(1) (لا مصفوفة لكل نداء)، نوافذ متدحرجة محدودة، وكل شيء
 * داخل try/catch. عند التسجيل يكشف نفسه كخطّاف عام (globalThis.__esharqProf) تدفع
 * إليه الإضافات المُجهَّزة (DiscordArabicizer…) — بلا اعتماد مباشر بينها (لا اقتران).
 */

import { PluginNative } from "@utils/types";
import { FluxDispatcher } from "@webpack/common";

const Native = IS_DISCORD_DESKTOP
    ? (VencordNative.pluginHelpers.EsharqDiagnostics as PluginNative<typeof import("./native")>)
    : null;

interface FnStat { calls: number; samples: number; totalMs: number; maxMs: number; }
interface ProcMetric { type: string; pid: number; cpu: number; memMB: number; }
interface DispatchStat { count: number; totalMs: number; maxMs: number; }

const HEAP_CAP = 300; // ~5 دقائق عند عيّنة/ثانية
const LAG_CAP = 600;  // ~60 ثانية عند عيّنة/100ms

class RuntimeProfiler {
    recording = false;
    private startedAt = 0;

    private fnStats = new Map<string, FnStat>();
    private heap: number[] = [];          // عيّنات usedJSHeapSize بالميغابايت
    private heapMin = Infinity;           // أدنى قيمة (خطّ أساس ما بعد GC) — لكشف التسريب الصادق
    private lagSamples: number[] = [];     // تأخّر حلقة الأحداث (ms)
    private longtaskCount = 0;
    private longtaskTotalMs = 0;
    private longtaskMaxMs = 0;
    private metrics: ProcMetric[] = [];    // أحدث لقطة getAppMetrics
    private peakCpu = 0;

    private heapTimer: ReturnType<typeof setInterval> | null = null;
    private lagTimer: ReturnType<typeof setInterval> | null = null;
    private lagExpect = 0;
    private obs: PerformanceObserver | null = null;

    // FPS عبر rAF — أثناء التسجيل فقط، ويتجاهل فترات إخفاء النافذة (rAF يتوقّف فيها)
    private rafId: number | null = null;
    private frameCount = 0;
    private fpsWindowStart = 0;
    private fpsNow = 0;
    private fpsMin = Infinity;

    // مُحلّل توزيع Flux: زمن التنفيذ المتزامن لكل نوع حدث (غلاف بعلَم dead آمن للسلاسل)
    private dispatchStats = new Map<string, DispatchStat>();
    private dispatchUnwrap: (() => void) | null = null;

    start() {
        if (this.recording) return;
        this.reset();
        this.recording = true;
        this.startedAt = Date.now();

        // الخطّاف العام — الإضافات المُجهَّزة تدفع إليه أثناء التسجيل فقط.
        (globalThis as any).__esharqProf = this;

        // heap + CPU كل ثانية
        this.heapTimer = setInterval(() => { this.sampleHeap(); void this.sampleCpu(); }, 1000);
        this.sampleHeap(); void this.sampleCpu();

        // تأخّر حلقة الأحداث كل 100ms (الانحراف = الفعلي − المتوقَّع)
        this.lagExpect = performance.now() + 100;
        this.lagTimer = setInterval(() => {
            const now = performance.now();
            const lag = now - this.lagExpect;
            this.lagExpect = now + 100;
            this.pushLag(Math.max(0, lag));
        }, 100);

        // حجب الخيط الرئيسي (مهامّ طويلة ≥ 50ms)
        try {
            this.obs = new PerformanceObserver(list => {
                for (const e of list.getEntries()) {
                    this.longtaskCount++;
                    this.longtaskTotalMs += e.duration;
                    if (e.duration > this.longtaskMaxMs) this.longtaskMaxMs = e.duration;
                }
            });
            this.obs.observe({ entryTypes: ["longtask"] });
        } catch { this.obs = null; }

        // FPS: عدّاد إطارات لكل نافذة ثانية. نتجاهل النوافذ > 2ث (النافذة كانت مخفية —
        // rAF يتوقّف والقياس هناك ليس أداءً حقيقياً).
        this.fpsWindowStart = performance.now();
        this.frameCount = 0;
        const frame = () => {
            if (!this.recording) { this.rafId = null; return; }
            this.frameCount++;
            const now = performance.now();
            const span = now - this.fpsWindowStart;
            if (span >= 1000) {
                if (span < 2000 && document.visibilityState === "visible") {
                    this.fpsNow = Math.round((this.frameCount * 1000) / span);
                    if (this.fpsNow < this.fpsMin) this.fpsMin = this.fpsNow;
                }
                this.frameCount = 0;
                this.fpsWindowStart = now;
            }
            this.rafId = requestAnimationFrame(frame);
        };
        this.rafId = requestAnimationFrame(frame);

        // مُحلّل التوزيع: نقيس الزمن المتزامن لنداء dispatch (عمل المشتركين الفوري).
        try {
            const fd = FluxDispatcher as any;
            const orig = fd.dispatch as (...a: any[]) => any;
            const stats = this.dispatchStats;
            const state = { dead: false };
            const wrapper = function (this: any, ...args: any[]) {
                if (state.dead) return orig.apply(this, args);
                const type = typeof args[0]?.type === "string" ? args[0].type as string : "?";
                const t0 = performance.now();
                try {
                    return orig.apply(this, args);
                } finally {
                    const dt = performance.now() - t0;
                    let s = stats.get(type);
                    if (s == null) { s = { count: 0, totalMs: 0, maxMs: 0 }; stats.set(type, s); }
                    s.count++;
                    s.totalMs += dt;
                    if (dt > s.maxMs) s.maxMs = dt;
                }
            };
            fd.dispatch = wrapper;
            this.dispatchUnwrap = () => {
                try {
                    if (fd.dispatch === wrapper) fd.dispatch = orig; // استعادة نظيفة
                    else state.dead = true; // غلّف طرف آخر فوقنا — نخمل ولا نكسر سلسلته
                } catch { /* تجاهل */ }
            };
        } catch { this.dispatchUnwrap = null; }
    }

    stop() {
        this.recording = false;
        if ((globalThis as any).__esharqProf === this) (globalThis as any).__esharqProf = null;
        if (this.heapTimer) { clearInterval(this.heapTimer); this.heapTimer = null; }
        if (this.lagTimer) { clearInterval(this.lagTimer); this.lagTimer = null; }
        if (this.obs) { try { this.obs.disconnect(); } catch { /* تجاهل */ } this.obs = null; }
        if (this.rafId != null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
        if (this.dispatchUnwrap) { this.dispatchUnwrap(); this.dispatchUnwrap = null; }
    }

    private reset() {
        this.fnStats.clear();
        this.heap = [];
        this.heapMin = Infinity;
        this.lagSamples = [];
        this.longtaskCount = 0; this.longtaskTotalMs = 0; this.longtaskMaxMs = 0;
        this.metrics = []; this.peakCpu = 0;
        this.fpsNow = 0; this.fpsMin = Infinity; this.frameCount = 0;
        this.dispatchStats.clear();
    }

    // تحديث عدّاد O(1) — يستدعيه المُجهَّزون عبر globalThis.__esharqProf.hit(...)
    hit(name: string, ms?: number) {
        let s = this.fnStats.get(name);
        if (s == null) { s = { calls: 0, samples: 0, totalMs: 0, maxMs: 0 }; this.fnStats.set(name, s); }
        s.calls++;
        if (typeof ms === "number") {
            s.samples++; s.totalMs += ms;
            if (ms > s.maxMs) s.maxMs = ms;
        }
    }

    private sampleHeap() {
        try {
            const mem = (performance as { memory?: { usedJSHeapSize?: number; }; }).memory;
            const used = mem?.usedJSHeapSize;
            if (typeof used !== "number") return;
            const mb = used / 1048576;
            this.heap.push(mb);
            if (this.heap.length > HEAP_CAP) this.heap.shift();
            if (mb < this.heapMin) this.heapMin = mb;
        } catch { /* تجاهل */ }
    }

    private async sampleCpu() {
        if (!Native) return;
        try {
            const m = await Native.getAppMetrics();
            if (!Array.isArray(m)) return;
            this.metrics = m;
            let total = 0;
            for (const p of m) total += p.cpu;
            if (total > this.peakCpu) this.peakCpu = total;
        } catch { /* تجاهل */ }
    }

    private pushLag(ms: number) {
        this.lagSamples.push(ms);
        if (this.lagSamples.length > LAG_CAP) this.lagSamples.shift();
    }

    getReport() {
        const elapsedMin = Math.max((Date.now() - this.startedAt) / 60000, 1 / 60);
        const heapCur = this.heap.length ? this.heap[this.heap.length - 1] : null;
        const heapMax = this.heap.length ? Math.max(...this.heap) : null;
        const heapMin = this.heapMin === Infinity ? null : this.heapMin;
        // إشارة تسريب صادقة: ارتفاع خطّ الأساس (أدنى heap) لكل دقيقة — لا فروق العيّنات.
        const growthMBPerMin = (heapCur != null && heapMin != null) ? (heapCur - heapMin) / elapsedMin : 0;

        const lagAvg = this.lagSamples.length ? this.lagSamples.reduce((a, b) => a + b, 0) / this.lagSamples.length : 0;
        const lagMax = this.lagSamples.length ? Math.max(...this.lagSamples) : 0;
        // p95 حقيقي من العيّنات (≤600 عنصر — فرزها عند طلب التقرير رخيص)
        let lagP95 = 0;
        if (this.lagSamples.length) {
            const sorted = [...this.lagSamples].sort((a, b) => a - b);
            lagP95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
        }

        // أثقل أنواع أحداث Flux (زمن التنفيذ المتزامن) + عدد مشتركي كل نوع إن توفّر
        const topDispatch = [...this.dispatchStats.entries()]
            .map(([type, s]) => {
                let subscribers: number | null = null;
                try {
                    const subs = (FluxDispatcher as any)._subscriptions?.[type];
                    const size = subs?.size ?? subs?.length;
                    if (typeof size === "number") subscribers = size;
                } catch { /* غير متاح — نعرض ؟ بصدق */ }
                return {
                    type,
                    count: s.count,
                    avgMs: s.count ? Math.round((s.totalMs / s.count) * 1000) / 1000 : 0,
                    maxMs: Math.round(s.maxMs * 100) / 100,
                    totalMs: Math.round(s.totalMs * 10) / 10,
                    subscribers,
                };
            })
            .sort((a, b) => b.totalMs - a.totalMs)
            .slice(0, 8);

        const topFunctions = [...this.fnStats.entries()]
            .map(([name, s]) => ({
                name,
                calls: s.calls,
                callsPerSec: Math.round((s.calls / (elapsedMin * 60)) * 10) / 10,
                avgMs: s.samples ? Math.round((s.totalMs / s.samples) * 1000) / 1000 : 0,
                maxMs: Math.round(s.maxMs * 100) / 100,
                totalMs: Math.round(s.totalMs * 10) / 10,
            }))
            .sort((a, b) => b.totalMs - a.totalMs)
            .slice(0, 10);

        return {
            recording: this.recording,
            durationSec: Math.round((Date.now() - this.startedAt) / 1000),
            cpu: {
                perProcess: this.metrics,
                totalNow: Math.round(this.metrics.reduce((a, b) => a + b.cpu, 0) * 10) / 10,
                peakTotal: Math.round(this.peakCpu * 10) / 10,
                available: Native != null,
            },
            heap: {
                currentMB: heapCur != null ? Math.round(heapCur) : null,
                minMB: heapMin != null ? Math.round(heapMin) : null,
                maxMB: heapMax != null ? Math.round(heapMax) : null,
                growthMBPerMin: Math.round(growthMBPerMin * 10) / 10,
                leakSuspected: growthMBPerMin > 10 && this.heap.length > 30,
                // آخر 60 عيّنة للمخطط الشراري (أرقام حقيقية، مُقرَّبة للعرض)
                series: this.heap.slice(-60).map(x => Math.round(x)),
            },
            eventLoop: {
                avgLagMs: Math.round(lagAvg * 10) / 10,
                p95LagMs: Math.round(lagP95 * 10) / 10,
                maxLagMs: Math.round(lagMax * 10) / 10,
            },
            fps: {
                now: this.fpsNow,
                min: this.fpsMin === Infinity ? null : this.fpsMin,
            },
            longtasks: {
                count: this.longtaskCount,
                totalBlockingMs: Math.round(this.longtaskTotalMs),
                maxMs: Math.round(this.longtaskMaxMs),
            },
            topFunctions,
            topDispatch,
        };
    }

    exportJSON() {
        return JSON.stringify({ _esharq: "runtime", takenAt: new Date().toISOString(), report: this.getReport() }, null, 2);
    }
}

export const runtimeProfiler = new RuntimeProfiler();
export type RuntimeReport = ReturnType<RuntimeProfiler["getReport"]>;
