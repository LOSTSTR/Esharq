/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": { "ar": "بحث متقدّم في الرسائل بمرشّحات للروابط والمؤلّفين والقنوات والتواريخ وغيرها.", "en": "Advanced message search with filters for links, authors, channels, dates, and more" },
    "options": {
        "maxResults": { "ar": "أقصى عدد لنتائج البحث." },
        "searchTimeout": { "ar": "مهلة البحث بالثواني." },
        "includeNSFW": { "ar": "تضمين قنوات NSFW في البحث." }
    }
});
