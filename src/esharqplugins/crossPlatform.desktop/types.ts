/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** المنصّات التي لها وحدةُ استطلاعٍ فعلية. */
export const PLATFORM_IDS = ["steam", "hypixel", "twitch"] as const;
export type PlatformId = (typeof PLATFORM_IDS)[number];

/**
 * ما تُرجعه وحدةُ منصّة عن حسابٍ واحد.
 *
 * `game === null` تعني «متصل ولا يلعب»، وغيابُ المدخل كلّياً يعني «غير متصل»
 * — وهما حالتان مختلفتان: الأولى تُخفي النشاط، والثانية لا تُنشئه أصلاً.
 */
export interface PlatformPresence {
    /** المعرّف على المنصّة نفسها (SteamID64، UUID، معرّف تويتش…). */
    accountId: string;
    /** ما يُعرض في ديسكورد سطراً أوّل. `null` = لا شيء يُعرض. */
    game: string | null;
    /** سطرٌ ثانٍ اختياريّ (الطور، الخريطة، عنوان البثّ…). */
    detail?: string;
    /** بداية الجلسة بالمللي ثانية، إن عرفتها المنصّة. */
    startedAt?: number;
    /** بثّ مباشر لا لعب — يغيّر نوع النشاط ويضيف الرابط. */
    streamUrl?: string;
}

/** نتيجة طلبٍ من الجسر الأصليّ. `status === -1` تعني فشلاً قبل الشبكة. */
export interface HttpResult {
    status: number;
    body: string;
}

/** نتيجة «اختبر الاتصال» — ما يراه المستخدم حرفياً. */
export interface ProbeResult {
    ok: boolean;
    /** رسالة عربية جاهزة للعرض. */
    message: string;
    /** عدد الحسابات التي رآها الاختبار، إن نجح. */
    count?: number;
}
