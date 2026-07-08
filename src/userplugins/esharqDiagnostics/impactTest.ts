/*
 * Esharq — EsharqDiagnostics impact test (قياس الأثر السببي)
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * قياس سببي حقيقي لا تخمين: نقيس أداء الخيط الرئيسي (تأخّر الحلقة، المهامّ الطويلة،
 * FPS) لمدة مرحلة والإضافة تعمل، ثم نوقفها مؤقتاً بنفس مسار بطاقة الإعدادات
 * (stopPlugin/startPlugin — لا يلمس الإعدادات المحفوظة)، ونعيد القياس، ثم نعيد
 * تشغيلها حتماً (finally). الفرق بين المرحلتين = أثر الإضافة الفعلي على جهازك الآن.
 *
 * حدود صادقة (تُعرَض للمستخدم):
 * - مؤهَّلة فقط الإضافات التي لا تتطلب إعادة تشغيل (بلا ترقيعات webpack) — الترقيعات
 *   لا تُزال إلا بإعادة التشغيل فقياسها هكذا وهمٌ، ونرفضه.
 * - مرحلتان قصيرتان = عيّنة واحدة قد تتأثر بضجيج اللحظة؛ كرّر القياس للتأكيد.
 */

import { isPluginEnabled, pluginRequiresRestart, startPlugin, stopPlugin } from "@api/PluginManager";

import Plugins from "~plugins";

export interface PhaseMetrics {
    lagAvgMs: number;
    lagP95Ms: number;
    longtasksPerMin: number;
    blockingMsPerMin: number;
    fpsAvg: number | null;
}

export interface ImpactResult {
    plugin: string;
    phaseSec: number;
    on: PhaseMetrics;   // الإضافة تعمل
    off: PhaseMetrics;  // الإضافة متوقفة
    /** موجب = الإيقاف حسّن الأداء (الإضافة لها كلفة) */
    lagImprovementMs: number;
    fpsGain: number | null;
    blockingDropMsPerMin: number;
    verdict: "high" | "moderate" | "negligible";
    /** فشل الاستعادة — يجب إعلام المستخدم فوراً ليعيد تفعيلها يدوياً */
    restoreFailed?: boolean;
}

export type ImpactPhase = "measuring-on" | "stopping" | "measuring-off" | "restoring";

let running = false;
export const isImpactTestRunning = () => running;

/** الإضافات المؤهَّلة للقياس الحيّ الآن (مع سبب استبعاد البقية — شفافية كاملة). */
export function listImpactCandidates(): { eligible: string[]; excluded: { name: string; reason: "patches" | "dependants" | "notStarted"; }[]; } {
    const eligible: string[] = [];
    const excluded: { name: string; reason: "patches" | "dependants" | "notStarted"; }[] = [];

    const enabledNames = Object.keys(Plugins).filter(isPluginEnabled);
    for (const name of enabledNames) {
        const p = Plugins[name];
        if (!p || name === "EsharqDiagnostics") continue;

        if (pluginRequiresRestart(p)) { excluded.push({ name, reason: "patches" }); continue; }
        if (!p.started) { excluded.push({ name, reason: "notStarted" }); continue; }
        // لا نوقف إضافةً تعتمد عليها إضافات مُفعّلة أخرى — سنكسرها
        const hasDependants = enabledNames.some(other =>
            other !== name && Plugins[other]?.dependencies?.includes(name));
        if (hasDependants) { excluded.push({ name, reason: "dependants" }); continue; }

        eligible.push(name);
    }
    eligible.sort((a, b) => a.localeCompare(b));
    return { eligible, excluded };
}

/** يقيس أداء الخيط الرئيسي لمدة محددة — عدّادات O(1)، تنظيف كامل في finally. */
function measurePhase(ms: number): Promise<PhaseMetrics> {
    return new Promise(resolve => {
        const lags: number[] = [];
        let longtasks = 0;
        let blockingMs = 0;
        let frames = 0;
        const t0 = performance.now();

        let expect = performance.now() + 50;
        const lagTimer = setInterval(() => {
            const now = performance.now();
            lags.push(Math.max(0, now - expect));
            expect = now + 50;
        }, 50);

        let obs: PerformanceObserver | null = null;
        try {
            obs = new PerformanceObserver(list => {
                for (const e of list.getEntries()) { longtasks++; blockingMs += e.duration; }
            });
            obs.observe({ entryTypes: ["longtask"] });
        } catch { obs = null; }

        let rafId: number | null = null;
        const frame = () => { frames++; rafId = requestAnimationFrame(frame); };
        rafId = requestAnimationFrame(frame);

        setTimeout(() => {
            clearInterval(lagTimer);
            if (obs) { try { obs.disconnect(); } catch { /* تجاهل */ } }
            if (rafId != null) cancelAnimationFrame(rafId);

            const elapsedMin = Math.max((performance.now() - t0) / 60000, 1 / 600);
            const avg = lags.length ? lags.reduce((a, b) => a + b, 0) / lags.length : 0;
            const sorted = [...lags].sort((a, b) => a - b);
            const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
            // FPS صالح فقط والنافذة ظاهرة (rAF يتوقّف عند الإخفاء — قياسه حينها وهم)
            const fpsAvg = document.visibilityState === "visible"
                ? Math.round(frames / ((performance.now() - t0) / 1000))
                : null;

            resolve({
                lagAvgMs: Math.round(avg * 100) / 100,
                lagP95Ms: Math.round(p95 * 100) / 100,
                longtasksPerMin: Math.round((longtasks / elapsedMin) * 10) / 10,
                blockingMsPerMin: Math.round(blockingMs / elapsedMin),
                fpsAvg,
            });
        }, ms);
    });
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * يشغّل اختبار الأثر: قياس ON → إيقاف مؤقت → قياس OFF → استعادة (مضمونة في finally).
 * يرمي Error برسالة واضحة إذا تعذّر الإيقاف؛ restoreFailed=true إذا فشلت الاستعادة.
 */
export async function runImpactTest(
    pluginName: string,
    phaseSec: number,
    onPhase?: (phase: ImpactPhase) => void
): Promise<ImpactResult> {
    if (running) throw new Error("impact test already running");
    const p = Plugins[pluginName];
    if (!p || !isPluginEnabled(pluginName) || pluginRequiresRestart(p) || !p.started)
        throw new Error("plugin not eligible");

    running = true;
    let stopped = false;
    let result: ImpactResult | undefined;
    try {
        onPhase?.("measuring-on");
        const on = await measurePhase(phaseSec * 1000);

        onPhase?.("stopping");
        if (!stopPlugin(p)) throw new Error(`stopPlugin(${pluginName}) failed`);
        stopped = true;
        await sleep(800); // مهلة استقرار — نتائج الإيقاف (فكّ مستمعين/DOM) تهدأ

        onPhase?.("measuring-off");
        const off = await measurePhase(phaseSec * 1000);

        const lagImprovementMs = Math.round((on.lagAvgMs - off.lagAvgMs) * 100) / 100;
        const fpsGain = on.fpsAvg != null && off.fpsAvg != null ? off.fpsAvg - on.fpsAvg : null;
        const blockingDropMsPerMin = on.blockingMsPerMin - off.blockingMsPerMin;

        // عتبات الحكم — نسبية ومطلقة معاً كي لا يضخَّم الضجيج الصغير
        const relLag = on.lagAvgMs > 0 ? lagImprovementMs / on.lagAvgMs : 0;
        let verdict: ImpactResult["verdict"] = "negligible";
        if ((relLag > 0.35 && lagImprovementMs > 1.5) || (fpsGain != null && fpsGain >= 10) || blockingDropMsPerMin > 400)
            verdict = "high";
        else if ((relLag > 0.15 && lagImprovementMs > 0.5) || (fpsGain != null && fpsGain >= 4) || blockingDropMsPerMin > 120)
            verdict = "moderate";

        result = { plugin: pluginName, phaseSec, on, off, lagImprovementMs, fpsGain, blockingDropMsPerMin, verdict };
        return result;
    } finally {
        if (stopped) {
            onPhase?.("restoring");
            let restoreFailed = false;
            try {
                if (!startPlugin(p)) restoreFailed = true;
            } catch { restoreFailed = true; }
            if (restoreFailed) {
                // finally يسبق إتمام الإرجاع — الطفرة على المرجع تظهر في النتيجة المُعادة
                if (result) result.restoreFailed = true;
                // لا نبتلعها: نطبعها ليراها المستخدم فوراً ويعيد التفعيل من الإعدادات
                console.error(`[EsharqDiagnostics] FAILED to restart ${pluginName} after impact test — re-enable it from settings!`);
            }
        }
        running = false;
    }
}
