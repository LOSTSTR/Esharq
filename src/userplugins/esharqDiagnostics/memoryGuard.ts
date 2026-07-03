/*
 * Esharq — EsharqDiagnostics memory guard (optional background leak watch)
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * حارس ذاكرة اختياري — مُطفأ افتراضياً ولا يعمل إلا إذا فعّله المستخدم بنفسه.
 * عيّنة heap واحدة كل 60 ثانية (قراءة خاصية — ميكروثوانٍ)، ونقارن «خطّ الأساس بعد GC»
 * (أدنى قيمة في كل نصف نافذة) لا القيم اللحظية — فتذبذب الاستهلاك الطبيعي لا يُطلق
 * إنذاراً كاذباً؛ فقط النموّ المطّرد الذي لا يُحرّره جامع المهملات. إشعار واحد في الجلسة.
 */

const SAMPLE_MS = 60_000; // عيّنة كل دقيقة
const WINDOW = 15;        // نافذة 15 دقيقة
const GROWTH_MB = 150;    // نموّ خطّ الأساس الذي يستحق التنبيه

let timer: ReturnType<typeof setInterval> | null = null;
let samples: number[] = [];
let notified = false;

function heapMB(): number | null {
    try {
        const used = (performance as { memory?: { usedJSHeapSize?: number; }; }).memory?.usedJSHeapSize;
        return typeof used === "number" ? used / 1048576 : null;
    } catch { return null; }
}

function baselineGrowth(): number | null {
    if (samples.length < WINDOW) return null;
    const half = Math.floor(WINDOW / 2);
    const oldBase = Math.min(...samples.slice(0, half));
    const newBase = Math.min(...samples.slice(-half));
    return newBase - oldBase;
}

export function startMemoryGuard(onLeak: (growthMB: number) => void): void {
    if (timer !== null) return; // idempotent
    samples = [];
    notified = false;
    timer = setInterval(() => {
        try {
            const mb = heapMB();
            if (mb === null) return; // performance.memory غير متاح — الحارس خامل بلا ضرر
            samples.push(mb);
            if (samples.length > WINDOW) samples.shift();
            const growth = baselineGrowth();
            if (growth !== null && growth >= GROWTH_MB && !notified) {
                notified = true; // إشعار واحد في الجلسة — لا إزعاج متكرّر
                onLeak(Math.round(growth));
            }
        } catch { /* الحارس لا يجوز أن يؤذي أبداً */ }
    }, SAMPLE_MS);
}

export function stopMemoryGuard(): void {
    if (timer !== null) { clearInterval(timer); timer = null; }
    samples = [];
    notified = false;
}
