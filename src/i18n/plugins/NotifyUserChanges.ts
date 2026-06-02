/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يضيف خياراً في قائمة سياق المستخدم لتُشعَر عند تغيّر قنوات الصوت أو حالة الاتصال لمستخدمٍ مُختار.",
        "en": "Adds a notify option in the user context menu to get notified when a user changes voice channels or online status"
    },
    "options": {
        "notifyStatus": {
            "ar": "إشعار عند تغيّر الحالة",
            "en": "Notify on status changes"
        },
        "notifyVoice": {
            "ar": "إشعار عند تغيّر قناة الصوت",
            "en": "Notify on voice channel changes"
        },
        "persistNotifications": {
            "ar": "إبقاء الإشعارات",
            "en": "Persist notifications"
        },
        "userIds": {
            "ar": "معرّفات المستخدمين (مفصولة بفواصل)",
            "en": "User IDs (comma separated)"
        }
    }
});
