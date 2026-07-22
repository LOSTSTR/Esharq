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
        },
        "resendOnFail": {
            "ar": "محاولة إعادة إرسال الرسالة المُوجَّهة إذا فشل التوجيه. قد يسبب إشعارات غير مقصودة أو تكرار النص، ويتجاوز قيود المحتوى الحسّاس (NSFW).",
            "en": "This will attempt to resend a forwarded message if the forward fails. Could cause unintentional pings or text spam. Bypasses NSFW restrictions."
        },
        "forwardPreface": {
            "ar": "النصّ الذي تُستهَلّ به الرسالة المُوجَّهة",
            "en": "What should the forwarded message be prefaced with"
        },
        "selfForward": {
            "ar": "إظهار القناة الحالية في نافذة قائمة التوجيه.",
            "en": "Show the current channel in the forward list popup."
        }
    }
});
