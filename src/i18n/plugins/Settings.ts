/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يضيف واجهة الإعدادات ومعلومات التشخيص",
        "en": "Adds a settings UI and diagnostic information."
    },
    "options": {
        "includeVencordInfoWhenCopying": {
            "ar": "نسخ معلومات إشراق (إشراق، Electron، Chromium) أيضاً عند النقر على معلومات الإصدار في صفحة الإعدادات",
            "en": "Also copy Esharq info (Esharq, Electron, Chromium) when clicking the version info in the bottom-left corner of the settings page."
        }
    }
});
