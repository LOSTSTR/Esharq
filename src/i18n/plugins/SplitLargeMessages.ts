/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يقسّم الرسائل الطويلة إلى أجزاء بحجم ديسكورد قبل إرسالها.",
        "en": "Splits oversized messages into Discord-sized chunks before sending."
    },
    "options": {
        "sendDelay": {
            "ar": "أقل تأخير بين كل جزء بالثواني.",
            "en": "Minimum delay between each chunk in seconds."
        },
        "splitMode": {
            "ar": "الحدّ المُفضّل للتقسيم عنده عند تقسيم الرسالة.",
            "en": "Prefer this boundary when splitting a message."
        },
        "splitInSlowmode": {
            "ar": "السماح بالتقسيم في الوضع البطيء عندما يكون تأخيره ضمن الحدّ الأقصى المُعيّن.",
            "en": "Allow splitting in slowmode when its delay is within the configured maximum."
        },
        "slowmodeMax": {
            "ar": "الحدّ الأقصى لمدة الوضع البطيء المسموح بها عند تقسيم الرسائل.",
            "en": "Maximum slowmode duration allowed when splitting messages."
        }
    }
});
