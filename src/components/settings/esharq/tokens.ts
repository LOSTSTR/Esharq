/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * رموز تصميم إشراق — الألوان والمقاسات والترتيب.
 *
 * مصدر الحقيقة الوحيد لهوية إشراق البصرية: كل مكوّن يقرأ من هنا، فالتغيير
 * في مكان واحد. القيم مختارة لتوحيد الإحساس عبر الأقسام الخمسة.
 */

/** لون التمييز — ذهب إشراق، يميّزه عن أزرق ديسكورد. */
export const ACCENT = "#c9a227";
export const ACCENT_SOFT = "#c9a22722";
export const ACCENT_STRONG = "#a8851d";

/** وحدة المباعدة الأساسية. كل الهوامش مضاعفاتها. */
export const UNIT = 7;

/** نصف قطر الحوافّ في البطاقات والأزرار. */
export const RADIUS = 11;

/**
 * ترتيب الأقسام الخمسة. الرقم يحدّد الموضع في الشريط، والفجوات مقصودة
 * لإتاحة الإدراج بين الأقسام لاحقاً بلا إعادة ترقيم.
 */
export const SECTION_ORDER: Record<string, number> = {
    "essentials": 20,
    "safety-health": 42,
    "updates-community": 64,
    "tools": 86,
    "data-support": 108
};

/** مدّة الانتقالات — موحّدة عبر الواجهة. */
export const TRANSITION_MS = 140;

/** درجات الرمادي للأسطح، من الأعمق إلى الأفتح. */
export const SURFACE = ["#0e0e11", "#17171b", "#1f1f25", "#2a2a31"] as const;
