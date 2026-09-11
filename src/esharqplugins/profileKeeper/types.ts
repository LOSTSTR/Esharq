/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * لقطةُ شكلك — ما كان معروضاً على ملفّك ساعةَ كان الاشتراك قائماً.
 *
 * 🔴 **الحقول أسماؤها أسماء ديسكورد نفسها**، مقروءةً من
 * `packages/discord-types` لا مُخترَعة: `banner` و`accentColor` و`themeColors`
 * و`profileEffect` و`collectibles` على **الملفّ**، و`avatarDecorationData`
 * و`collectibles.nameplate` على **المستخدم**. وخلطُ الاثنين كان سيجعل نصف
 * اللقطة فارغاً بلا رسالة.
 */
export interface LookSnapshot {
    /** حين التُقطت (ملّي ثانية). يُعرض للمستخدم كي يعرف قِدَمها. */
    at: number;
    /** درجة النيترو الحقيقية ساعتها — تُقال في الواجهة لا تُستعمل شرطاً. */
    tier: number;

    // ── من الملفّ الشخصيّ ────────────────────────────────────────────────
    banner: string | null;
    accentColor: number | null;
    themeColors: [number, number] | null;
    /** كائن المؤثّر كما يُرجعه ديسكورد — فيه مسارات الرسوم، فلا يُختصر. */
    profileEffect: unknown | null;
    profileEffectId: string | null;
    collectibles: unknown[] | null;

    // ── من سجلّ المستخدم ─────────────────────────────────────────────────
    avatar: string | null;
    avatarDecoration: { asset: string; skuId: string; } | null;
    nameplate: {
        asset: string;
        skuId: string;
        label?: string;
        palette?: string;
        type?: number;
    } | null;
}

/** ما يُعرَض في اللوحة: بندٌ واحد من الشكل وحالته. */
export interface LookItem {
    key: keyof LookSnapshot;
    /** اسمٌ يقرأه المستخدم. */
    label: string;
    /**
     * من يراه بعد الاستعادة.
     *
     * `self` أنت وحدك · `modded` مَن يُشغّل إضافةً تُظهره · `nobody` لا أحد
     * إلّا باشتراكٍ حقيقيّ.
     */
    seenBy: "self" | "modded" | "nobody";
    /** إضافةٌ أخرى تُغطّي هذا البند لغيرك — فلا نُكرّرها. */
    coveredBy?: string;
}
