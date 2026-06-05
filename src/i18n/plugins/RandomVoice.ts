/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يضيف زراً بجانب زر الكتم للانضمام إلى قناة صوتية عشوائية.",
        "en": "Adds a button next to the mute button to join a random voice channel."
    },
    "options": {
        "keybindEnabled": {
            "ar": "إظهار عناصر التحكّم باختصار الصوت العشوائي",
            "en": "Show the random voice keybind controls"
        },
        "UserAmountOperation": {
            "ar": "اختر عملية لعدد المستخدمين",
            "en": "Choose a comparison operator for the user count filter."
        },
        "UserAmount": {
            "ar": "اختر عدد المستخدمين",
            "en": "Choose the target number of users for the filter."
        },
        "spacesLeftOperation": {
            "ar": "اختر عملية للحد الأقصى من عدد المستخدمين",
            "en": "Choose a comparison operator for the spaces-left filter."
        },
        "spacesLeft": {
            "ar": "اختر الحد الأقصى لعدد المستخدمين",
            "en": "Choose the target number of spaces left for the filter."
        },
        "vcLimitOperation": {
            "ar": "اختر عملية للقناة الصوتية.",
            "en": "Choose a comparison operator for the voice channel user limit."
        },
        "vcLimit": {
            "ar": "اختر حد للقناة الصوتية",
            "en": "Choose the target voice channel user limit."
        },
        "Servers": {
            "ar": "السيرفرات المضمّنة",
            "en": "Included servers (leave empty to include all)."
        },
        "autoNavigate": {
            "ar": "الانتقال تلقائياً إلى القناة الصوتية.",
            "en": "Automatically navigate to the joined voice channel."
        },
        "autoCamera": {
            "ar": "تشغيل الكاميرا تلقائياً",
            "en": "Automatically enable camera on join."
        },
        "autoStream": {
            "ar": "تشغيل البث تلقائياً",
            "en": "Automatically start streaming on join."
        },
        "selfMute": {
            "ar": "كتم الميكروفون تلقائياً عند الانضمام للقناة الصوتية.",
            "en": "Automatically mute yourself when joining a voice channel."
        },
        "selfDeafen": {
            "ar": "تعطيم الصوت تلقائياً عند الانضمام للقناة الصوتية.",
            "en": "Automatically deafen yourself when joining a voice channel."
        },
        "leaveEmpty": {
            "ar": "البحث عن مكالمة عشوائية عندما تكون القناة الصوتية فارغة.",
            "en": "Search for another random call when the voice channel becomes empty."
        },
        "prioritizeFriends": {
            "ar": "تفضيل القنوات التي يتواجد فيها أصدقاؤك عند الإمكان.",
            "en": "Prefer channels that contain your friends when possible."
        },
        "avoidStages": {
            "ar": "تجنب الانضمام إلى قنوات المسرح الصوتي.",
            "en": "Avoid joining stage voice channels."
        },
        "avoidAfk": {
            "ar": "تجنب الانضمام إلى قنوات AFK الصوتية.",
            "en": "Avoid joining AFK voice channels."
        },
        "video": {
            "ar": "البحث عن مستخدمين لديهم الكاميرا مفتوحة",
            "en": "Filter for users who have their camera on."
        },
        "stream": {
            "ar": "البحث عن مستخدمين يقومون بالبث",
            "en": "Filter for users who are streaming."
        },
        "mute": {
            "ar": "البحث عن مستخدمين مكتوم صوتهم",
            "en": "Filter for users who are muted."
        },
        "deafen": {
            "ar": "البحث عن مستخدمين معطّم صوتهم",
            "en": "Filter for users who are deafened."
        },
        "includeStates": {
            "ar": "خيار تضمين الحالات",
            "en": "Only join channels where at least one user matches the state filters."
        },
        "avoidStates": {
            "ar": "خيار تجنب الحالات",
            "en": "Avoid joining channels where any user matches the state filters."
        }
    }
});
