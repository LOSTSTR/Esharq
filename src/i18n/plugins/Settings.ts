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
        "settingsLocation": {
            "ar": "مكان عرض قسم إعدادات Equicord في الإعدادات",
            "en": "Where to display the Equicord settings section."
        },
        "includeVencordInfoWhenCopying": {
            "ar": "نسخ معلومات Vencord (Vencord، Electron، Chromium) أيضاً عند النقر على معلومات الإصدار في صفحة الإعدادات",
            "en": "Also copy Vencord info (Vencord, Electron, Chromium) when clicking the version info in the bottom-left corner of the settings page."
        }
    }
});
