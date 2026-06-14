/*
 * ConsoleWatcher — أداة مطوّر لمراقبة أحداث الكونسول وجمعها للصيانة
 * Copyright (c) 2026 LOSTSTR
 *
 * مبنية على Equicord المرخّصة GPL-3.0-or-later وتخضع لنفس الرخصة.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type ConsoleEventType =
    | "log" | "warn" | "error" | "info" | "debug" | "trace"
    | "table" | "group" | "groupCollapsed" | "groupEnd"
    | "time" | "timeEnd" | "clear"
    | "window.onerror" | "unhandledrejection";

/**
 * مصدر الحدث المُكتشَف من وسمه:
 * - `arabicizer`: سجلّات DiscordArabicizer (وسم [DiscordArabicizer]).
 * - `plugin`: إضافة Vencord/Equicord عبر Logger (بادئة "Equicord <اسم>").
 * - `discord`: وحدة ديسكورد أساسية (سجلّ معنون بـ [Module]).
 * - `unknown`: بلا وسم يُميّزه (مثل أخطاء window.onerror الخام).
 */
export type ConsoleSource = "arabicizer" | "plugin" | "discord" | "unknown";

export interface ConsoleEvent {
    /** وقت الحدث (Date.now()) */
    timestamp: number;
    /** نوع الحدث */
    type: ConsoleEventType;
    /** الوسائط مُسلسَلة فوراً إلى نصّ — لا مراجع حيّة أبداً (يمنع تسريب الذاكرة) */
    args: string[];
    /** سياق إضافي اختياري (مثل stack للأخطاء) */
    detail?: string;
    /** مصدر الحدث المُكتشَف (للترشيح حسب الإضافة/ديسكورد/المشروع) */
    source: ConsoleSource;
    /** اسم الإضافة إن أمكن استخراجه من الوسم */
    pluginName?: string;
}
