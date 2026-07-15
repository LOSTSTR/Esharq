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
    cpu: number | null; // نسبة المعالج (%) — null إذا تعذّرت القراءة (لا نزعم صفراً)
    memMB: number;      // مجموعة العمل (RSS تقريبي) بالميغابايت
}

// لقطة لكل عمليات ديسكورد (الرئيسية + العرض + GPU + المساعدات).
export async function getAppMetrics(_e: IpcMainInvokeEvent): Promise<ProcMetric[]> {
    try {
        return app.getAppMetrics().map(m => {
            // Electron's field is `percentCPUUsage` (ProcessMetric.cpu: CPUUsage).
            // This previously read `percentCPU` — a field that does not exist — through
            // an `as { percentCPU?: number }` cast, which silenced the very type error
            // that would have caught it, so CPU read 0.0 for every process, always.
            // Read it off the real type: if the shape ever changes, tsc fails loudly.
            const pct = m.cpu?.percentCPUUsage;
            return {
                type: m.type,
                pid: m.pid,
                // null (not 0) when unreadable — 0 would be indistinguishable from "idle".
                cpu: typeof pct === "number" && Number.isFinite(pct) ? Math.round(pct * 10) / 10 : null,
                // workingSetSize تأتي بالكيلوبايت من Electron → نحوّلها إلى ميغابايت.
                memMB: Math.round((m.memory?.workingSetSize ?? 0) / 1024),
            };
        });
    } catch {
        return [];
    }
}
