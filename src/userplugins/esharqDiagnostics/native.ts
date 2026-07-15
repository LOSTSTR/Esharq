/*
 * Esharq — EsharqDiagnostics native (main process)
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * مصدر CPU% الحقيقي الوحيد عبر العمليات: Electron app.getAppMetrics().
 * للقراءة فقط — لا fs، لا شبكة، لا أوامر صدفة. كل شيء داخل try/catch.
 */

import { app, IpcMainInvokeEvent } from "electron";

export interface ProcMetric {
    type: string;
    pid: number;
    /**
     * نسبة المعالج (%) حيث 100% = نواة واحدة مشغولة بالكامل — فقد تتجاوز 100 على
     * عدّة أنوية (نفس دلالة Electron). null إذا تعذّرت القراءة (لا نزعم صفراً).
     */
    cpu: number | null;
    memMB: number;      // مجموعة العمل (RSS تقريبي) بالميغابايت
}

/**
 * آخر قراءة تراكمية لكل عملية، للاشتقاق أدناه.
 *
 * المفتاح pid+creationTime وليس pid وحده: توثيق Electron ينصّ صراحةً على أنّ الـpid
 * يُعاد استخدامه بعد موت العملية، فيلزم الاثنان معاً لتمييزها. بدون creationTime قد
 * نطرح عدّاد عملية جديدة من عدّاد عملية ميتة تحمل نفس الرقم.
 */
const lastCpu = new Map<string, { cumSec: number; atMs: number; }>();

/**
 * أطول فجوة نقبل القسمة عليها. أبعد من ذلك يكون الرقم متوسّطاً على فترة توقّف
 * (ما بين تسجيلين مثلاً) لا قراءةَ "الآن" — فنُرجع null بصدق ونكتفي بإعادة البذر.
 */
const MAX_GAP_MS = 10_000;

// لقطة لكل عمليات ديسكورد (الرئيسية + العرض + GPU + المساعدات).
export async function getAppMetrics(_e: IpcMainInvokeEvent): Promise<ProcMetric[]> {
    try {
        const nowMs = Date.now();
        const seen = new Set<string>();

        const out = app.getAppMetrics().map(m => {
            const key = `${m.pid}:${m.creationTime}`;
            seen.add(key);

            // لا نقرأ percentCPUUsage: توثيق Electron نفسه يقول إنه "منذ آخر نداء
            // لـgetCPUUsage — والنداء الأول يُرجع صفراً". وهو نداء لكلّ عملية على
            // حدة لا نستدعيه للعمليات الأخرى إطلاقاً، فالفارق لا يُبنى قط والحقل
            // يُرجع 0.0 أبداً (أثبته تصدير حقيقي: صفر في العمليات الخمس طوال 35
            // دقيقة). وبما أنه غير اختياري فهو 0 لا null — أي يمرّ من حارس
            // "غير متاح" ويُعلن ثقةً برقم خاطئ.
            //
            // cumulativeCPUUsage عدّاد تراكمي (ثوانٍ منذ إقلاع العملية) لا يعتمد على
            // أيّ نداء سابق. نشتقّ النسبة من فارق عيّنتين، فتصحّ مهما كان المُستدعي.
            const cumSec = m.cpu?.cumulativeCPUUsage;
            let cpu: number | null = null;

            if (typeof cumSec === "number" && Number.isFinite(cumSec)) {
                const prev = lastCpu.get(key);
                lastCpu.set(key, { cumSec, atMs: nowMs });

                if (prev != null) {
                    const wallMs = nowMs - prev.atMs;
                    const usedSec = cumSec - prev.cumSec;
                    // usedSec سالباً = عدّاد صُفِّر: نتجاهل ونكتفي بالبذرة الجديدة.
                    if (wallMs > 0 && wallMs <= MAX_GAP_MS && usedSec >= 0) {
                        const pct = (usedSec / (wallMs / 1000)) * 100;
                        cpu = Math.round(pct * 10) / 10;
                    }
                }
                // العيّنة الأولى تبقى null بصدق: لا سابقة نطرح منها.
            }

            return {
                type: m.type,
                pid: m.pid,
                cpu,
                // workingSetSize تأتي بالكيلوبايت من Electron → نحوّلها إلى ميغابايت.
                memMB: Math.round((m.memory?.workingSetSize ?? 0) / 1024),
            };
        });

        // العمليات الميتة تُزال، وإلا نمت الخريطة طوال الجلسة.
        for (const key of lastCpu.keys()) if (!seen.has(key)) lastCpu.delete(key);

        return out;
    } catch {
        return [];
    }
}
