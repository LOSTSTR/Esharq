/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يحوّل مصادر webpack الخاصة بـ Discord إلى ملف tarball.",
        "en": "Converts Discord's webpack sources into a tarball."
    },
    "options": {
        "patched": {
            "ar": "تضمين الوحدات المُعدَّلة في الأرشيف",
            "en": "Include patched modules in the archive."
        }
    },
    "toolboxActions": {
        "Webpack Tarball": { "ar": "أرشيف Webpack", "en": "Webpack Tarball" }
    }
});
