/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "أنشئ صور GIF وأضف عليها تعليقات من أي وسائط في الدردشة أو منتقي GIF.",
        "en": "Create and caption GIFs from any media in chat or the GIF picker."
    },
    "options": {
        "maxWidth": {
            "ar": "أقصى عرض للملاءمة التلقائية.",
            "en": "Maximum auto-fit width."
        },
        "maxHeight": {
            "ar": "أقصى ارتفاع للملاءمة التلقائية.",
            "en": "Maximum auto-fit height."
        }
    }
});
