/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يُصدّر رسائل القناة (نصوص وصور وفيديو وصوت وروابط وتضمينات وملصقات وتفاعلات) بصيغ TXT/JSON/CSV/MD/HTML، ويُصدّر قائمة أعضائها بصيغة JSON أو CSV.",
        "en": "Export a channel's messages (TXT/JSON/CSV/MD/HTML) and its member list (JSON/CSV)."
    },
    "options": {
        "exportFormat": {
            "ar": "الصيغة المستخدمة عند تصدير قائمة الأعضاء",
            "en": "File format used when exporting the member list."
        }
    }
});
