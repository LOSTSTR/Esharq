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
interface ProcMetric { type: string; pid: number; cpu: number | null; memMB: number; }
interface DispatchStat { count: number; totalMs: number; maxMs: number; }
// A dispatch that ran in a known window — used to blame long tasks on what caused them.
interface DispatchSpan { type: string; start: number; end: number; }

const HEAP_CAP = 300; // ~5 دقائق عند عيّنة/ثانية
const LAG_CAP = 600;  // ~60 ثانية عند عيّنة/100ms
const SPAN_TTL_MS = 5000; // long tasks surface within the same tick — a short trail suffices

class RuntimeProfiler {
    recording = false;
    private startedAt = 0;
    /**
     * وقت الإيقاف — 0 أثناء التسجيل. بدونه كانت المدّة تُحسب (الآن − البداية) فتستمرّ
     * بالعدّ بعد ضغط "إيقاف": توقُّف عند الدقيقة 10 وتصدير عند الدقيقة 35 كان يقسم
     * بيانات 10 دقائق على 35، فتظهر كلّ المعدّلات (callsPerSec والنِسَب) أقلّ من
     * حقيقتها. أمّا growthMBPerMin فيقيس على مدى العيّنات لا على الساعة، فلم يتأثّر.
     */
    private stoppedAt = 0;

    /** المدّة المُقاسة فعلاً: تتجمّد عند الإيقاف، وتساوي صفراً قبل أوّل تسجيل. */
    private elapsedMs() {
        if (this.startedAt === 0) return 0;
        return (this.stoppedAt || Date.now()) - this.startedAt;
    }

    /**
     * Is there a recording's worth of data in this session — running OR finished?
     * `stop()` tears down the timers but clears nothing; `reset()` runs from
     * `start()` alone, so a finished run's report stays readable and exportable.
     * The modal reseeds from this, so closing it cannot lose a completed recording.
     */
    get hasData() {
        return this.startedAt !== 0;
    }

    // A recording outlives the modal, so the header-bar icon has to learn when it
    // starts/stops without polling. Subscribers are notified on state change only.
    private stateListeners = new Set<() => void>();
    subscribeState(fn: () => void) {
        this.stateListeners.add(fn);
        return () => { this.stateListeners.delete(fn); };
    }
    private notifyState() {
        for (const fn of this.stateListeners) { try { fn(); } catch { /* a bad subscriber must not break the profiler */ } }
    }

    private fnStats = new Map<string, FnStat>();
    private heap: number[] = [];          // عيّنات usedJSHeapSize بالميغابايت
    private heapMin = Infinity;           // أدنى قيمة (خطّ أساس ما بعد GC) — لكشف التسريب الصادق
    private heapMax = -Infinity;          // أعلى قيمة على مدى الجلسة — نفس نافذة heapMin
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

    // Long-task attribution: knowing 2.9s of blocking happened is useless without
    // knowing WHO blocked. We keep a 5s trail of dispatch spans and blame each long
    // task on the dispatch it overlaps most. Anything else stays "(unattributed)" —
    // React renders, GC and layout are not Flux, and pretending otherwise would lie.
    private dispatchSpans: DispatchSpan[] = [];
    private longtaskBlame = new Map<string, { count: number; totalMs: number; }>();

    start() {
        if (this.recording) return;
        this.reset();
        this.recording = true;
        this.startedAt = Date.now();
        this.stoppedAt = 0;
        this.notifyState();

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
                    // The dispatch's finally-block runs inside the task, so its span is
                    // already recorded by the time this observer callback fires.
                    this.blameLongtask(e.startTime, e.startTime + e.duration, e.duration);
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
            const spans = this.dispatchSpans;
            const state = { dead: false };
            const wrapper = function (this: any, ...args: any[]) {
                if (state.dead) return orig.apply(this, args);
                const type = typeof args[0]?.type === "string" ? args[0].type as string : "?";
                const t0 = performance.now();
                try {
                    return orig.apply(this, args);
                } finally {
                    const t1 = performance.now();
                    const dt = t1 - t0;
                    let s = stats.get(type);
                    if (s == null) { s = { count: 0, totalMs: 0, maxMs: 0 }; stats.set(type, s); }
                    s.count++;
                    s.totalMs += dt;
                    if (dt > s.maxMs) s.maxMs = dt;
                    // Trail for long-task blame, pruned by age so it stays bounded
                    // regardless of dispatch rate.
                    spans.push({ type, start: t0, end: t1 });
                    const cutoff = t1 - SPAN_TTL_MS;
                    let drop = 0;
                    while (drop < spans.length && spans[drop].end < cutoff) drop++;
                    if (drop > 0) spans.splice(0, drop);
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
        // الوقت يُجمَّد عند الإيقاف الأول فقط؛ أمّا التفكيك أدناه فيبقى غير مشروط
        // ليظلّ stop() صالحاً كشبكة أمان تُستدعى مرّتين (زر الإيقاف + تعطيل الإضافة).
        if (this.recording) this.stoppedAt = Date.now();
        this.recording = false;
        if ((globalThis as any).__esharqProf === this) (globalThis as any).__esharqProf = null;
        if (this.heapTimer) { clearInterval(this.heapTimer); this.heapTimer = null; }
        if (this.lagTimer) { clearInterval(this.lagTimer); this.lagTimer = null; }
        if (this.obs) { try { this.obs.disconnect(); } catch { /* تجاهل */ } this.obs = null; }
        if (this.rafId != null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
        if (this.dispatchUnwrap) { this.dispatchUnwrap(); this.dispatchUnwrap = null; }
        this.notifyState();
    }

    private reset() {
        this.fnStats.clear();
        this.heap = [];
        this.heapMin = Infinity;
        this.heapMax = -Infinity;
        this.lagSamples = [];
        this.longtaskCount = 0; this.longtaskTotalMs = 0; this.longtaskMaxMs = 0;
        this.metrics = []; this.peakCpu = 0;
        this.fpsNow = 0; this.fpsMin = Infinity; this.frameCount = 0;
        this.dispatchStats.clear();
        // Without these two, a second recording would inherit the first run's blame.
        // Cleared in place, not reassigned: the dispatch wrapper closes over this
        // exact array, so swapping it would leave the wrapper writing to an orphan.
        this.dispatchSpans.length = 0;
        this.longtaskBlame.clear();
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
            // القاع والذروة يُتابَعان هنا لا في getReport: المصفوفة مقصوصة عند HEAP_CAP،
            // فـ Math.max عليها كان يقرأ آخر 5 دقائق فقط بينما heapMin يمتدّ للجلسة كلها
            // — فيُقارَن قاعُ 35 دقيقة بذروةِ 5، وتضيع الذروة الحقيقية بلا أثر.
            if (mb < this.heapMin) this.heapMin = mb;
            if (mb > this.heapMax) this.heapMax = mb;
        } catch { /* تجاهل */ }
    }

    private async sampleCpu() {
        if (!Native) return;
        try {
            const m = await Native.getAppMetrics();
            if (!Array.isArray(m)) return;
            this.metrics = m;
            // Unreadable CPU contributes nothing rather than poisoning the peak with 0.
            let total = 0;
            let readable = false;
            for (const p of m) if (p.cpu != null) { total += p.cpu; readable = true; }
            if (readable && total > this.peakCpu) this.peakCpu = total;
        } catch { /* تجاهل */ }
    }

    private pushLag(ms: number) {
        this.lagSamples.push(ms);
        if (this.lagSamples.length > LAG_CAP) this.lagSamples.shift();
    }

    // Blame a long task on the dispatch it overlaps most. A long task is one
    // contiguous block of main-thread work, so the biggest overlap is the best
    // honest single culprit; no overlap at all means it was not Flux.
    private blameLongtask(start: number, end: number, duration: number) {
        let bestType: string | null = null;
        let bestOverlap = 0;
        for (const s of this.dispatchSpans) {
            const overlap = Math.min(end, s.end) - Math.max(start, s.start);
            if (overlap > bestOverlap) { bestOverlap = overlap; bestType = s.type; }
        }
        const key = bestType ?? "(unattributed)";
        let b = this.longtaskBlame.get(key);
        if (b == null) { b = { count: 0, totalMs: 0 }; this.longtaskBlame.set(key, b); }
        b.count++;
        b.totalMs += duration;
    }

    getReport() {
        const elapsedMin = Math.max(this.elapsedMs() / 60000, 1 / 60);
        const heapCur = this.heap.length ? this.heap[this.heap.length - 1] : null;
        const heapMax = this.heapMax === -Infinity ? null : this.heapMax;
        const heapMin = this.heapMin === Infinity ? null : this.heapMin;

        // A leak raises the FLOOR: GC returns a healthy heap to the same baseline,
        // while a leak lifts it. So compare the floor of each half of the recording.
        //
        // This previously computed (current − lowest-ever) / elapsed, which can never
        // be negative — any dip-and-recover reported "growth" on a perfectly flat heap
        // (a real export read 5.3 MB/min while both halves' floors sat at 229 MB).
        // Samples are one per second, so the array length IS the span: using elapsedMin
        // would also drift once HEAP_CAP starts dropping the oldest samples.
        let growthMBPerMin = 0;
        if (this.heap.length >= 20) {
            const mid = this.heap.length >> 1;
            let minFirst = Infinity, minSecond = Infinity;
            for (let i = 0; i < mid; i++) if (this.heap[i] < minFirst) minFirst = this.heap[i];
            for (let i = mid; i < this.heap.length; i++) if (this.heap[i] < minSecond) minSecond = this.heap[i];
            const gapMin = (this.heap.length / 2) / 60; // centre-to-centre distance of the halves
            growthMBPerMin = (minSecond - minFirst) / gapMin;
        }

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
            durationSec: Math.round(this.elapsedMs() / 1000),
            cpu: {
                perProcess: this.metrics,
                totalNow: Math.round(this.metrics.reduce((a, b) => a + (b.cpu ?? 0), 0) * 10) / 10,
                peakTotal: Math.round(this.peakCpu * 10) / 10,
                // Honest: the native module merely EXISTING told us nothing — it reported
                // available:true while every reading was a hardcoded 0 from a misread
                // field. Available means we actually got a number back.
                available: Native != null && this.metrics.some(m => m.cpu != null),
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
                // Who actually blocked the thread. "(unattributed)" is a real answer:
                // the block was not a Flux dispatch (React render, GC, layout).
                blame: [...this.longtaskBlame.entries()]
                    .map(([type, b]) => ({ type, count: b.count, totalMs: Math.round(b.totalMs) }))
                    .sort((a, b) => b.totalMs - a.totalMs)
                    .slice(0, 6),
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
