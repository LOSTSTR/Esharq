/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "تابِع مستخدماً عبر القنوات الصوتية. انقر بزر يمين على مستخدم ← متابعة المستخدم (تنضمّ إلى قناته). يتوقّف تلقائياً بعد 30 دقيقة من الخمول.",
        "en": "Follow a user across voice channels. Right-click a user → Follow User (you join their channel). Auto-unfollows after 30 minutes of inactivity."
    },
    "options": {
        "onlyWhenInVoice": {
            "ar": "الانضمام التلقائي فقط عندما تكون متّصلاً بقناة صوتية بالفعل",
            "en": "Only auto-join when you are already in a voice channel"
        },
        "leaveWhenUserLeaves": {
            "ar": "مغادرة القناة الصوتية عند مغادرة المستخدم المُتابَع",
            "en": "Leave the voice channel when the followed user leaves"
        },
        "friendsOnly": {
            "ar": "السماح بمتابعة الأصدقاء فقط",
            "en": "Only allow following friends"
        }
    }
});
