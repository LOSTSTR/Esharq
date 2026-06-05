/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يُضيف زراً لتفعيل/تعطيل نشاط الألعاب بسرعة",
        "en": "Adds a button to quickly toggle game activity on or off."
    },
    "options": {
        "oldIcon": {
            "ar": "استخدام شكل الأيقونة القديم قبل تحديث تصميم Discord",
            "en": "Use the old game activity toggle icon."
        },
        "location": {
            "ar": "مكان عرض زر تبديل نشاط اللعبة",
            "en": "Where to show the game activity toggle button.",
            "choices": {
                "PANEL": { "ar": "بجانب الكتم/الإصمام", "en": "Next to Mute/Deafen" },
                "TOOLBOX": { "ar": "Equicord Toolbox", "en": "Equicord Toolbox" }
            }
        }
    }
});
