/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يعرض أعلى رتبة للعضو بجانب اسمه في رسائل الدردشة. يمكنك إخفاء أو إظهار رتب معيّنة من قائمة النقر بالزر الأيمن.",
        "en": "Shows a user's highest role next to their name in chat messages. Hide/show specific roles in their context menu (right-click)."
    },
    "options": {
        "showBots": {
            "ar": "إظهار أعلى رتبة على البوتات.",
            "en": "Whether to show the highest role on bots."
        },
        "useRoleColor": {
            "ar": "استخدام لون الرتبة للأيقونة.",
            "en": "Use the role's color for the icon."
        }
    }
});
