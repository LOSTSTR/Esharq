/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يُضيف مؤشرات مرئية في قائمة الخوادم",
        "en": "Adds visual indicators in the server list."
    },
    "options": {
        "mode": {
            "ar": "وضع العرض",
            "en": "Which indicator mode to use.",
            "choices": {
                "2": { "ar": "عدد الأصدقاء المتصلين فقط", "en": "Only online friend count" },
                "1": { "ar": "عدد السيرفرات فقط", "en": "Only server count" },
                "3": { "ar": "عدد السيرفرات والأصدقاء المتصلين معاً", "en": "Both server and online friend counts" }
            }
        },
        "useCompact": {
            "ar": "جعل المؤشر يظهر بالنص فقط",
            "en": "Use compact indicators."
        }
    }
});
