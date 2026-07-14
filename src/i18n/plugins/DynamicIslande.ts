/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يضيف «جزيرة ديناميكية» عائمة تعرض Spotify والمكالمات ومشاركة الشاشة والإشعارات مع عناصر تحكّم سريعة.",
        "en": "Adds a Dynamic Island for Spotify, calls, screen sharing, and notifications."
    },
    "options": {
        "islandColor": {
            "ar": "اختر لون الجزيرة الديناميكية.",
            "en": "Choose the Dynamic Island color."
        },
        "keepIslandVisible": {
            "ar": "إبقاء الجزيرة الديناميكية ظاهرة حتى عند عدم وجود أي نشاط.",
            "en": "Keep the Dynamic Island visible when no activity is active."
        },
        "showSpotifyIsland": {
            "ar": "عرض نشاط Spotify في الجزيرة الديناميكية.",
            "en": "Show Spotify activity in the Dynamic Island."
        },
        "showVoiceIsland": {
            "ar": "عرض عناصر تحكّم مكالمة ديسكورد في الجزيرة الديناميكية.",
            "en": "Show Discord call controls in the Dynamic Island."
        },
        "showScreenShareIsland": {
            "ar": "عرض حالة مشاركة الشاشة والمؤقّت وعناصر الإيقاف السريع في الجزيرة الديناميكية.",
            "en": "Show screen sharing status, timer, and quick stop controls in the Dynamic Island."
        },
        "morphNotifications": {
            "ar": "تحويل شكل الجزيرة الديناميكية مؤقّتاً للرسائل المباشرة والإشارات.",
            "en": "Temporarily morph the Dynamic Island for direct messages and mentions."
        },
        "showSpotifyPanel": {
            "ar": "عرض مشغّل Spotify في لوحة مستخدم ديسكورد.",
            "en": "Show the Spotify player in the Discord user panel."
        },
        "showCallControls": {
            "ar": "عرض عناصر تحكّم المكالمة الرئيسية (كتم، إصمام، قطع الاتصال) في قسم المكالمة.",
            "en": "Show main call controls (Mute, Deafen, Disconnect) in the call section."
        },
        "showCallParticipants": {
            "ar": "عرض قائمة المشاركين في المكالمة الصوتية.",
            "en": "Show the list of voice call participants."
        },
        "showParticipantButtons": {
            "ar": "عرض أزرار الإجراءات السريعة (كتم، متابعة، صداقة، رسالة) بجانب المشاركين.",
            "en": "Show quick action buttons (Mute, Follow, Friend, DM) next to participants."
        }
    }
});
