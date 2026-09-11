/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يعرض قائمة من تفاعل على كل رد فعل عند التحويم",
        "en": "Shows a list of who reacted to each reaction on hover."
    },
    "options": {
        "clickableAvatars": {
            "ar": "حين يكون مُفعَّلاً، النقر على صورة من تفاعل يفتح ملفّه الشخصيّ بدل أن يُضيف التفاعل.",
            "en": "While this is enabled, clicking a reacting user's avatar will open their profile instead of adding the reaction"
        }
    }
});
