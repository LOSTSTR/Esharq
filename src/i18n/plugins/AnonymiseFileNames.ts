/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يُعيّن أسماء عشوائية للملفات قبل رفعها",
        "en": "Assigns random names to files before uploading."
    },
    "options": {
        "anonymiseByDefault": {
            "ar": "إخفاء هوية أسماء الملفات تلقائياً افتراضياً",
            "en": "Anonymise file names by default."
        },
        "spoilerMessages": {
            "ar": "إضافة بادئة السبويلر للرسائل",
            "en": "Add a spoiler prefix to messages."
        },
        "method": {
            "ar": "طريقة إخفاء الهوية",
            "en": "Anonymisation method."
        },
        "randomisedLength": {
            "ar": "طول الأحرف العشوائية",
            "en": "Random characters length."
        },
        "consistent": {
            "ar": "اسم الملف الثابت",
            "en": "Fixed file name."
        },
        "dateFormat": {
            "ar": "صيغة التاريخ (تُدعَم YYYY وMM وDD وHH وmm وss وSSS)",
            "en": "Date format (YYYY, MM, DD, HH, mm, ss, SSS are supported)"
        }
    }
});
