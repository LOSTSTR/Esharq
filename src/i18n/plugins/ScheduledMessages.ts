/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "جدولة الرسائل لإرسالها في وقت محدد أو بعد تأخير معين.",
        "en": "Schedule messages to be sent at a specified time or after a delay."
    },
    "options": {
        "maxMessagesPerMinute": {
            "ar": "الحد الأقصى للرسائل المجدولة في القناة الواحدة في نفس الدقيقة.",
            "en": "Maximum messages sent per minute."
        },
        "checkIntervalSeconds": {
            "ar": "مدة الفترة الزمنية للتحقق من الرسائل المراد إرسالها (بالثواني).",
            "en": "How often to check for due messages (in seconds)."
        },
        "showNotifications": {
            "ar": "إظهار إشعارات عند إرسال الرسائل.",
            "en": "Show notifications when a scheduled message is sent."
        },
        "showPhantomMessages": {
            "ar": "إظهار الرسائل المجدولة كرسائل وهمية في الشات.",
            "en": "Show a preview of the scheduled message in the chat."
        }
    },
    "toolboxActions": {
        "View Scheduled Messages": { "ar": "عرض الرسائل المجدولة", "en": "View Scheduled Messages" }
    }
});
