/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": { "ar": "يُسكِت أصوات الإشعارات خلال فترة تحدّدها (مثل 23:00–08:00). تبقى الإشعارات المرئية ظاهرة.", "en": "Silences notification sounds during a time window you set (e.g. 23:00–08:00). Visual notifications still show." },
    "options": {
        "start": { "ar": "بداية ساعات الهدوء (24 ساعة، 0-23)." },
        "end": { "ar": "نهاية ساعات الهدوء (24 ساعة، 0-23)." }
    }
});
