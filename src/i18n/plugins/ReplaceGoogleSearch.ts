/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يستبدل محرك بحث جوجل بمحرك من اختيارك",
        "en": "Replaces Google with another search engine in the search context menu."
    },
    "options": {
        "customEngineName": {
            "ar": "اسم محرك البحث المخصص",
            "en": "Custom search engine name."
        },
        "customEngineURL": {
            "ar": "رابط محرك البحث الخاص بك",
            "en": "Custom search engine URL."
        },
        "replacementEngine": {
            "ar": "الاستبدال بمحرك بحث محدد بدلاً من إضافة قائمة",
            "en": "Search engine to replace Google with.",
            "choices": {
                "off": { "ar": "معطّل", "en": "Off" },
                "custom": { "ar": "محرّك مخصّص", "en": "Custom Engine" }
            }
        }
    }
});
