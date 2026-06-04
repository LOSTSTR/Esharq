/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يضيف شريط تمرير لدقة مشاركة الشاشة ومعدّل الإطارات (FPS).",
        "en": "Adds a slider for screenshare resolution and fps."
    },
    "options": {
        "maxFPS": {
            "ar": "أقصى معدّل إطارات (FPS) لشريط التمرير",
            "en": "Max FPS for the range slider"
        },
        "maxResolution": {
            "ar": "أقصى دقة لشريط التمرير",
            "en": "Max Resolution for the range slider"
        }
    }
});
