/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يعيد الانضمام إلى مكالمات الرسائل المباشرة والسيرفرات تلقائياً عند إعادة تشغيل Discord.",
        "en": "Automatically rejoins DM calls and server voice channels after Discord restarts."
    },
    "options": {
        "rejoinDelay": {
            "ar": "ضبط التأخير قبل إعادة الانضمام للقناة الصوتية",
            "en": "Delay before rejoining the voice channel (in seconds)."
        },
        "rejoinTimeout": {
            "ar": "لا تحاول إعادة الانضمام بعد مرور هذا العدد من الثواني منذ انقطاع الاتصال.",
            "en": "Don't attempt to rejoin after this many seconds since disconnecting."
        },
        "preventReconnectIfCallEnded": {
            "ar": "لا تعيد الاتصال إذا انتهت المكالمة أو كانت القناة الصوتية فارغة أو غير موجودة.",
            "en": "Don't reconnect if the call ended or the voice channel is empty or gone.",
            "choices": {
                "none": { "ar": "لا شيء", "en": "None" },
                "dms": { "ar": "الرسائل الخاصة فقط", "en": "DMs only" },
                "servers": { "ar": "السيرفرات فقط", "en": "Servers only" },
                "both": { "ar": "الرسائل الخاصة والسيرفرات", "en": "DMs and Servers" }
            }
        },
        "applyOnlyToDms": {
            "ar": "التطبيق على الرسائل المباشرة فقط.",
            "en": "Only apply to DM calls."
        }
    }
});
