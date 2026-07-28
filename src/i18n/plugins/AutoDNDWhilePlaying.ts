/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يضبط حالتك تلقائياً على لا تزعج أثناء تشغيل لعبة",
        "en": "Automatically sets your status to Do Not Disturb while playing a game."
    },
    "options": {
        "statusToSet": {
            "ar": "الحالة التي تُضبط أثناء تشغيل لعبة",
            "en": "The status to set while playing a game."
        }
    }
});
