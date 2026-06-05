/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "فك تشفير محتوى Base64 في أي رسالة ونسخ المحتوى المفكوك",
        "en": "Decode Base64 content in any message and copy the decoded result."
    },
    "options": {
        "clickMethod": {
            "ar": "تغيير زر فك تشفير محتوى Base64 في أي رسالة.",
            "en": "Change the decode Base64 button interaction method.",
            "choices": {
                "Left": { "ar": "النقر الأيسر لفكّ ترميز محتوى base64.", "en": "Left Click to decode the base64 content." },
                "Right": { "ar": "النقر الأيمن لفكّ ترميز محتوى base64.", "en": "Right click to decode the base64 content." }
            }
        }
    }
});
