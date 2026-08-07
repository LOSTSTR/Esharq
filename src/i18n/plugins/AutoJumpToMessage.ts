/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يفتح قناة الرسائل الجديدة تلقائياً",
        "en": "Automatically opens the channel from new messages."
    },
    "options": {
        "onlyWhenUnfocused": {
            "ar": "الانتقال التلقائي فقط عندما تكون نافذة ديسكورد غير مُركَّزة",
            "en": "Only automatically jump to messages when Discord's window is unfocused."
        }
    }
});
