/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يضيف زر تبديل لإظهار/إخفاء نشاط Spotify.",
        "en": "Adds a toggle to show/hide Spotify activity."
    },
    "options": {
        "location": {
            "ar": "مكان عرض زر تبديل Spotify.",
            "en": "Where to show the Spotify activity toggle button.",
            "choices": {
                "PANEL": { "ar": "بجانب الكتم/الإصمام", "en": "Next to Mute/Deafen" },
                "TOOLBOX": { "ar": "Equicord Toolbox", "en": "Equicord Toolbox" }
            }
        }
    }
});
