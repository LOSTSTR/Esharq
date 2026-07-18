/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يُجبر مستخدماً على متابعتك بين القنوات الصوتية عندما تملك صلاحية «نقل الأعضاء». انقر بزر يمين على مستخدم ← اجعله يتبعني.",
        "en": "Forces a user to follow you between voice channels when you have the Move Members permission. Right-click a user → Follow Me."
    },
    "options": {
        "showNotifications": {
            "ar": "إظهار تنبيه عند نقل المستخدم، وعند فشل النقل (مثلاً إن لم تملك صلاحية «نقل الأعضاء» في تلك القناة)",
            "en": "Show a notification when the user is moved, and when a move fails (e.g. you lack the Move Members permission there)"
        }
    }
});
