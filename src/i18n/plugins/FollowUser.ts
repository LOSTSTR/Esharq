/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "تابِع مستخدماً عبر القنوات الصوتية. انقر بزر يمين على مستخدم ← متابعة المستخدم (تنضمّ إلى قناته). اختر أن تتوقّف تلقائياً بعد 30 دقيقة من الخمول أو أن تستمرّ حتى توقفها بنفسك.",
        "en": "Follow a user across voice channels. Right-click a user → Follow User (you join their channel). Choose whether it stops itself after 30 minutes of inactivity or keeps following until you stop it."
    },
    "options": {
        "autoStopMinutes": {
            "ar": "إيقاف المتابعة تلقائياً بعد هذه المدّة دون أن يُغيّر المستخدم قناته",
            "en": "Stop following automatically after this long without the user moving channels",
            "choices": {
                "30": { "ar": "بعد 30 دقيقة", "en": "After 30 minutes" },
                "0": { "ar": "أبداً — تستمرّ المتابعة حتى أوقفها بنفسي", "en": "Never — keep following until I stop it myself" }
            }
        },
        "onlyWhenInVoice": {
            "ar": "الانضمام التلقائي فقط عندما تكون متّصلاً بقناة صوتية بالفعل",
            "en": "Only auto-join when you are already in a voice channel"
        },
        "leaveWhenUserLeaves": {
            "ar": "مغادرة القناة الصوتية عند مغادرة المستخدم المُتابَع",
            "en": "Leave the voice channel when the followed user leaves"
        },
        "pauseWhileStreaming": {
            "ar": "لا تنضمّ تلقائياً أثناء مشاركتك للشاشة أو تشغيل الكاميرا، حتى لا تسحبك المتابعة من بثّك (يمكنك إعادة الانضمام يدوياً بزرّ الشريط العلوي).",
            "en": "Don't auto-join while you're screen-sharing or on camera, so following can't yank you out of your own stream (you can still rejoin manually with the header button)"
        },
        "notifyOnAutoJoin": {
            "ar": "إظهار تنبيه صغير عند نقلك تلقائياً إلى قناة المستخدم المُتابَع",
            "en": "Show a small toast when you're automatically moved into the followed user's channel"
        }
    }
});
