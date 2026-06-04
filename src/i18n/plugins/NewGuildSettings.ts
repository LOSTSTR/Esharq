/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يُتيح ضبط الإعدادات الافتراضية لكل خادم تنضم إليه",
        "en": "Automatically applies custom default settings to every new server you join."
    },
    "options": {
        "guild": {
            "ar": "يكتم السيرفر تلقائياً",
            "en": "Default server notification setting."
        },
        "messages": {
            "ar": "إعدادات إشعارات السيرفر",
            "en": "Default message notification setting.",
            "choices": {
                "0": { "ar": "كل الرسائل", "en": "All messages" },
                "1": { "ar": "الإشارات فقط @", "en": "Only @mentions" },
                "2": { "ar": "لا شيء", "en": "Nothing" },
                "3": { "ar": "افتراضي السيرفر", "en": "Server default" }
            }
        },
        "everyone": {
            "ar": "كتم @everyone و @here",
            "en": "Default @everyone notification setting."
        },
        "role": {
            "ar": "كتم جميع إشارات @الرتب",
            "en": "Default role mention notification setting."
        },
        "highlights": {
            "ar": "كتم التمييزات تلقائياً",
            "en": "Default message highlights setting."
        },
        "events": {
            "ar": "كتم الفعاليات الجديدة تلقائياً",
            "en": "Default server events notification setting."
        },
        "showAllChannels": {
            "ar": "إظهار جميع القنوات تلقائياً",
            "en": "Show all channels by default."
        },
        "mobilePush": {
            "ar": "كتم إشعارات الدفع للجوال تلقائياً",
            "en": "Enable mobile push notifications by default."
        },
        "voiceChannels": {
            "ar": "إخفاء الأسماء في قنوات الصوت تلقائياً",
            "en": "Suppress voice channel join messages by default."
        }
    }
});
