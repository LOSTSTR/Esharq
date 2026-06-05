/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "تتساقط الثلوج على Discord",
        "en": "Makes it snow on Discord."
    },
    "options": {
        "typeOfSnow": {
            "ar": "يغيّر نوع الثلج المعروض (يؤثر على الأداء).",
            "en": "Type of snowflakes.",
            "choices": {
                "solid": { "ar": "صلب (أعلى أداء)", "en": "Solid (Highest Performance)" },
                "text": { "ar": "نص (أداء متوسط)", "en": "Text (Medium Performance)" },
                "image": { "ar": "صورة (أقل أداء)", "en": "Image (Lowest Performance)" }
            }
        },
        "maxSize": {
            "ar": "الحد الأقصى لحجم رقاقة الثلج",
            "en": "Maximum snowflake size."
        },
        "speed": {
            "ar": "السرعة للثلج المتساقط (أعلى = سقوط أسرع)",
            "en": "Snowfall speed."
        },
        "flakesPerSecond": {
            "ar": "رقاقات الثلج في الثانية (أعلى = تساقط أكثف)",
            "en": "Number of snowflakes per second."
        }
    }
});
