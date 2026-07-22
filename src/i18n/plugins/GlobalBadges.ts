/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يضيف شارات عالمية من موديفيكيشنز Discord الأخرى",
        "en": "Adds global badges from other Discord modifications."
    },
    "options": {
        "showModStyle": {
            "ar": "نمط المُشرِف",
            "en": "Mod Style"
        },
        "apiUrl": {
            "ar": "واجهة API المُستخدَمة",
            "en": "API to use"
        }
    },
    "toolboxActions": {
        "Refetch Global Badges": { "ar": "إعادة جلب الشارات العامة", "en": "Refetch Global Badges" }
    }
});
