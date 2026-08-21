/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * **سجلّ ما حُجب** — عدّادات التتبّع الذي أوقفه إشراق في هذه الجلسة.
 *
 * ## لماذا يُعدّ ما يُحجَب أصلاً
 *
 * `NoTrack` يُوقف تتبّع ديسكورد منذ سنوات، **بصمت**. فمن يقرأ «إشراق يمنع
 * التتبّع» ليس أمامه إلّا أن يُصدّق. والرقم الحيّ يُحوّل الوعد إلى ملاحظة:
 * «مُنع 201 حدثاً منذ إقلاعك، آخرها قبل أربع ثوانٍ».
 *
 * ## 🔴 وما لا يُسجَّل هنا
 *
 * **لا محتوى.** يُحفَظ **نوع الحدث** وحده (`TRACK` · `METRIC` · اسم الحدث
 * التحليليّ) ووقتُه. لا رسالة، ولا معرّف، ولا حمولة. وصفحةٌ تعرض ما مُنع
 * إرساله لتُطمئنك أنه لم يُرسَل صفحةٌ تناقض نفسها.
 *
 * ## والتكلفة
 *
 * زيادةُ عدّادٍ ودفعُ سطرٍ في حلقةٍ سعتها خمسون — على أحداثٍ **كانت تُرمى
 * أصلاً**. ولا مؤقّت، ولا كتابة على قرص، ولا شيء يُرسَل.
 *
 * 🔴 **ولا حارس بناء.** الرقم يلزم المستخدم لا المطوّر، فلو حُرس بـ`IS_DEV`
 * لعاد صاحب الجهاز بلا جواب — وهو صاحب السؤال.
 */

/** الأسطح التي نعدّها، كلٌّ بمفتاحٍ ثابت تُترجمه الواجهة. */
export type BlockKind = "analytics" | "metric" | "sentry" | "science";

export interface BlockEntry {
    kind: BlockKind;
    /** اسم الحدث كما جاء من ديسكورد — نوعٌ لا حمولة. */
    label: string;
    /** `Date.now()` عند الحجب. */
    at: number;
}

/** آخر خمسين — تكفي للطمأنة ولا تُراكم ذاكرة. */
const CAPACITY = 50;

const counts: Record<BlockKind, number> = { analytics: 0, metric: 0, sentry: 0, science: 0 };
const recent: BlockEntry[] = [];

/**
 * يُسجّل حجباً.
 *
 * ⚠️ `label` يجب أن يكون **نوعاً** لا محتوى. والمُستدعي مسؤولٌ عن ذلك، ولذلك
 * يُقصَر هنا على ثمانين حرفاً: اسمُ حدثٍ لا يتجاوزها، وما تجاوزها فليس اسماً.
 */
export function recordBlock(kind: BlockKind, label: string): void {
    counts[kind]++;
    recent.push({ kind, label: String(label).slice(0, 80), at: Date.now() });
    if (recent.length > CAPACITY) recent.shift();
}

export interface BlockSnapshot {
    counts: Record<BlockKind, number>;
    total: number;
    recent: BlockEntry[];
    /** منذ متى نعدّ — لتُقرأ الأرقام بالنسبة إلى مدّة الجلسة. */
    since: number;
}

const since = Date.now();

/** لقطةٌ للعرض. تُنسَخ فلا تُعدّل الصفحةُ السجلَّ بالخطأ. */
export function getBlockSnapshot(): BlockSnapshot {
    return {
        counts: { ...counts },
        total: counts.analytics + counts.metric + counts.sentry + counts.science,
        recent: recent.slice().reverse(),
        since
    };
}
