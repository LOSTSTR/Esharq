/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * **قياس إقلاع إشراق** — كم تكلّف كل إضافة، عند كل مستخدم.
 *
 * ## لماذا كُتب هذا أصلاً
 *
 * قياس ڤينكورد لا يعمل عند المستخدم: `traceFunction` تصير `noopTracer` خارج
 * `IS_DEV`/`IS_REPORTER` (`Tracer.ts`)، و`patchTimings` لا تُملأ إلّا في
 * `IS_REPORTER` (`patchWebpack.ts`). فمن يُشغّل إشراق من المُثبِّت **لا يملك
 * رقماً واحداً** عن إضافاته. وسؤال «أي إضافة تُبطئ إقلاعي؟» لا جواب له بغير
 * قياسٍ يعمل عنده هو.
 *
 * ## التكلفة — محسوبة لا مُقدَّرة
 *
 * نداءان لـ`performance.now()` لكل إضافة تبدأ (بضع مئات على الأكثر)، ومثلهما
 * لكل ترقيعة تُنفَّذ. النداء الواحد عشرات النانوثواني، فالمجموع **أقلّ من
 * ميلي ثانية واحدة** على إقلاعٍ يستغرق آلافها. ولا شيء يُكتب على القرص، ولا
 * مؤقّت يبقى بعد الإقلاع.
 *
 * 🔴 **ولا حارس بناء هنا قصداً.** لو حُرس بـ`IS_DEV` لعاد المستخدم بلا
 * بيانات — وهو الشخص الوحيد الذي تلزمه.
 */

export interface PluginStartRecord {
    name: string;
    /** زمن `start()` بالميلي ثانية. */
    startMs: number;
    /** مجموع زمن ترقيعات هذه الإضافة. */
    patchMs: number;
    /** كم ترقيعة نُفّذت لها فعلاً. */
    patchCount: number;
    /** فشل بدؤها. */
    failed: boolean;
    /** المرحلة التي بدأت فيها (`StartAt` قيمته نصّية أصلاً). */
    startAt?: string;
}

export interface PhaseMark {
    name: string;
    /** منذ بدء تحميل الصفحة، بالميلي ثانية. */
    at: number;
}

const records = new Map<string, PluginStartRecord>();
const phases: PhaseMark[] = [];

function recordFor(name: string): PluginStartRecord {
    let record = records.get(name);
    if (record === undefined) {
        record = { name, startMs: 0, patchMs: 0, patchCount: 0, failed: false };
        records.set(name, record);
    }
    return record;
}

/** يُسجَّل زمن `start()` لإضافة. يُنادى مرّةً لكل إضافة تبدأ. */
export function recordPluginStart(name: string, ms: number, failed: boolean, startAt?: string) {
    const record = recordFor(name);
    // إعادة التفعيل اليدويّ تُنادي `start` ثانيةً: نُبقي قياس الإقلاع الأوّل
    // لأن الصفحة تصف الإقلاع لا آخر نقرة.
    if (record.startMs === 0) {
        record.startMs = ms;
        record.failed = failed;
        record.startAt = startAt;
    }
}

/** يُسجَّل زمن ترقيعة نُفّذت. يُنادى من مسار الترقيع الساخن، فبقي خفيفاً. */
export function recordPatch(plugin: string, ms: number) {
    const record = recordFor(plugin);
    record.patchMs += ms;
    record.patchCount++;
}

/** علامة مرحلة في إقلاع إشراق نفسه. */
export function markPhase(name: string) {
    phases.push({ name, at: performance.now() });
}

export function getPluginStartups(): PluginStartRecord[] {
    return [...records.values()];
}

export function getPhases(): readonly PhaseMark[] {
    return phases;
}
