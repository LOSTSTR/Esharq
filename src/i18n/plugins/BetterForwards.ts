/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "إذا فشل التوجيه، يُرسله كرسالة عادية، ويسمح أيضاً بتوجيه محتوى NSFW. راجع الإعدادات لمزيد من تحسينات التوجيه.",
        "en": "If a forward fails, send it as a normal message. Also allows nsfw forwards. See settings for various other improvements to forwarding."
    },
    "options": {
        "dontFollowForwards": {
            "ar": "بعد توجيه رسالة واحدة، لا تنتقل إليها. اضغط Shift لتجاهل هذا السلوك",
            "en": "After forwarding a single message, don't jump to it. Hold shift to ignore this behavior"
        }
    }
});
