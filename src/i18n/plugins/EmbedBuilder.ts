/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "توليد JSON لِـEmbed بسرعة لاستخدامه مع الويبهوك أو البوتات.",
        "en": "Generate embed JSON quickly for use with webhooks or bots."
    },
    "options": {
        "defaultColor": {
            "ar": "اللون الافتراضي للـEmbed (صيغة hex، مثل ‎#5865F2‎)."
        },
        "autoCopy": {
            "ar": "نسخ الـJSON المُولّد إلى الحافظة تلقائياً."
        }
    }
});
