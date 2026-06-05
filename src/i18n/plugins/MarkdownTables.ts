/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يعرض جداول Markdown بأسلوب GitHub داخل رسائل ديسكورد",
        "en": "Render GitHub-style markdown tables in Discord messages."
    },
    "options": {
        "hideToggle": {
            "ar": "إخفاء زرّ التبديل بين الجدول والنصّ الخام وعرض الجداول المُنسّقة دائماً.",
            "en": "Hide the Table/Raw toggle and always show rendered tables."
        }
    }
});
