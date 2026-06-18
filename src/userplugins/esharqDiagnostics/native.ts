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
    cpu: number;   // نسبة المعالج (%) لهذه العملية
    memMB: number; // مجموعة العمل (RSS تقريبي) بالميغابايت
}

// لقطة لكل عمليات ديسكورد (الرئيسية + العرض + GPU + المساعدات).
export async function getAppMetrics(_e: IpcMainInvokeEvent): Promise<ProcMetric[]> {
    try {
        return app.getAppMetrics().map(m => ({
            type: m.type,
            pid: m.pid,
            // Electron's ProcessMetric.cpu.percentCPU (تتعارض أنواعه مع CPUUsage في Node) — قراءة بكاست دقيق.
            cpu: Math.round(((m.cpu as { percentCPU?: number; })?.percentCPU ?? 0) * 10) / 10,
            // workingSetSize تأتي بالكيلوبايت من Electron → نحوّلها إلى ميغابايت.
            memMB: Math.round((m.memory?.workingSetSize ?? 0) / 1024),
        }));
    } catch {
        return [];
    }
}
