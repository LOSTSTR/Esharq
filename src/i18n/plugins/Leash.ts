/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يربط مستخدماً بك عبر نقله تلقائياً إلى القناة الصوتية التي تنتقل إليها.\n\n⚠️ تحذير: نقل المستخدمين قسراً إلى القنوات الصوتية دون موافقتهم قد ينتهك شروط خدمة Discord وإرشادات المجتمع. تتطلب هذه الميزة صلاحيات الإشراف في السيرفر. استخدمها بمسؤولية.",
        "en": "Leashes a user to you by automatically moving them to whatever voice channel you join.\n\n⚠️ WARNING: Moving users to voice channels without their consent may violate Discord's Terms of Service and community guidelines. This feature requires server moderation permissions. Use responsibly."
    },
    "options": {
        "enabled": {
            "ar": "تفعيل إضافة Leash",
            "en": "Enable the Leash plugin."
        },
        "onlyWhenInVoice": {
            "ar": "نقل المستخدم فقط عندما تكون في قناة صوتية",
            "en": "Only move the user when you are in a voice channel."
        },
        "showNotifications": {
            "ar": "عرض إشعارات عند عمليات النقل",
            "en": "Show notifications on move operations."
        }
    }
});
