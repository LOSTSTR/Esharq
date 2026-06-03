/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

// الأوصاف هنا بالإنجليزية؛ العربية تأتي من overlay (src/i18n/plugins/PerformanceBoost.ts).
// definePluginSettings يحفظ الإعدادات تلقائياً (لا localStorage).
export const settings = definePluginSettings({
    // ملاحظة: لا تُسمِّ هذا "enabled" — Settings.plugins[name].enabled محجوز لعلَم تفعيل الإضافة نفسها في Vencord
    gameMode: {
        type: OptionType.BOOLEAN, default: false,
        description: "Enable performance / game mode"
    },
    // افتراضياً مُطفأ: حرية كاملة للمستخدم — لا تفعيل تلقائي إلا إن طلبه صراحةً.
    autoDetectGames: {
        type: OptionType.BOOLEAN, default: false,
        description: "Automatically enable when a game is detected"
    },
    reduceHardwareAcceleration: {
        type: OptionType.BOOLEAN, default: true,
        description: "Disable hardware acceleration (requires a Discord restart)"
    },
    // جديد: عند تفعيل خفض تسريع العتاد، اعرض تنبيهاً بزرّ إعادة تشغيل (ليُطبَّق التغيير اليدوي)
    autoRestartOnHardwareChange: {
        type: OptionType.BOOLEAN, default: true,
        description: "Offer to restart Discord so a hardware-acceleration change takes effect"
    },
    disableAnimations: {
        type: OptionType.BOOLEAN, default: true,
        description: "Disable animations and transitions"
    },
    disableGifAutoplay: {
        type: OptionType.BOOLEAN, default: true,
        description: "Stop GIFs from autoplaying"
    },
    compactMode: {
        type: OptionType.BOOLEAN, default: true,
        description: "Use compact message mode"
    },
    hideActivities: {
        type: OptionType.BOOLEAN, default: true,
        description: "Hide friends' activities (Active Now)"
    },
    changeProcessPriority: {
        type: OptionType.BOOLEAN, default: true,
        description: "Lower all Discord processes' priority to Below Normal (Windows)"
    },
    cleanCacheOnStart: {
        type: OptionType.BOOLEAN, default: false,
        description: "Clean Discord's cache when game mode starts"
    }
});
