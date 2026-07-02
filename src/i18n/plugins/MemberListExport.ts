/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يضيف زرّ تنزيل لتصدير قائمة الأعضاء الحالية بصيغة JSON أو CSV.",
        "en": "Adds a download button to export the current member list as JSON or CSV."
    },
    "options": {
        "exportFormat": { "ar": "الصيغة المستخدمة عند تصدير قائمة الأعضاء", "en": "File format used when exporting the member list." }
    }
});
