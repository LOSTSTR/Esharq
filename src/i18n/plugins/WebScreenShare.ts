/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يضيف قائمة خيارات لمشاركة الشاشة: الدقّة ومعدّل الإطارات وتلميح المحتوى وصوت النظام.",
        "en": "Adds a screenshare options menu. Allows for changing resolution, framerate, encoding hints, and system audio settings."
    },
    "options": {
        "resolution": { "ar": "الدقّة", "en": "Resolution" },
        "frameRate": { "ar": "معدّل الإطارات", "en": "Frame Rate" },
        "contentHint": { "ar": "تلميح المحتوى", "en": "Content Hint" },
        "systemAudio": { "ar": "كتم صوت النظام", "en": "Mute system audio" }
    }
});
