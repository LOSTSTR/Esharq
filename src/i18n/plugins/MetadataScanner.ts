/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": { "ar": "يفحص المرفقات والصور بحثاً عن بيانات EXIF ومقاطع PNG وبيانات الموقع.", "en": "Scan attachments and images for EXIF, PNG chunks, and location metadata." },
    "options": {
        "autoStripMetadata": { "ar": "إزالة البيانات الوصفية تلقائياً من الصور قبل إرسالها." }
    }
});
