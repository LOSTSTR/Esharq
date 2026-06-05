/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "إضافة جسر لربط Orbolay بديسكورد",
        "en": "Bridge plugin for connecting Orbolay to Discord."
    },
    "options": {
        "messageOffsetX": {
            "ar": "الإزاحة الأفقية للرسائل، بالبكسل",
            "en": "Horizontal offset for messages, in pixels"
        },
        "messageOffsetY": {
            "ar": "الإزاحة الرأسية للرسائل، بالبكسل",
            "en": "Vertical offset for messages, in pixels"
        },
        "userOffsetX": {
            "ar": "الإزاحة الأفقية للمستخدمين، بالبكسل",
            "en": "Horizontal offset for users, in pixels"
        },
        "userOffsetY": {
            "ar": "الإزاحة الرأسية للمستخدمين، بالبكسل",
            "en": "Vertical offset for users, in pixels"
        },
        "port": {
            "ar": "المنفذ للاتصال به",
            "en": "The port to connect to."
        },
        "isKeybindEnabled": {
            "ar": "تفعيل/تعطيل اختصار لوحة المفاتيح العام (Ctrl + `)",
            "en": "Enable/disable the global keybind (Ctrl + `)."
        },
        "messageAlignment": {
            "ar": "محاذاة الرسائل في التراكب",
            "en": "Alignment of messages in the overlay.",
            "choices": {
                "topleft": { "ar": "أعلى اليسار", "en": "Top left" },
                "topright": { "ar": "أعلى اليمين", "en": "Top right" },
                "bottomleft": { "ar": "أسفل اليسار", "en": "Bottom left" },
                "bottomright": { "ar": "أسفل اليمين", "en": "Bottom right" },
                "topcenter": { "ar": "أعلى الوسط", "en": "Top center" },
                "bottomcenter": { "ar": "أسفل الوسط", "en": "Bottom center" }
            }
        },
        "userAlignment": {
            "ar": "محاذاة المستخدمين في التراكب",
            "en": "Alignment of users in the overlay."
        },
        "voiceSemitransparent": {
            "ar": "جعل أعضاء القناة الصوتية شفافين",
            "en": "Make voice channel members semi-transparent."
        },
        "messagesSemitransparent": {
            "ar": "جعل إشعارات الرسائل شفافة",
            "en": "Make message notifications semi-transparent."
        }
    }
});
