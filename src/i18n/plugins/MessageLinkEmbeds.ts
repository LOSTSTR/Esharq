/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يُضيف معاينة للرسائل التي تحتوي رابطاً لرسالة أخرى (الروابط المحاطة بـ <> لا تُعايَن)",
        "en": "Adds a preview to messages that link another message"
    },
    "options": {
        "messageBackgroundColor": {
            "ar": "لون خلفية الرسائل في الـ Embeds المتقدمة",
            "en": "Use the message background color in embeds."
        },
        "automodEmbeds": {
            "ar": "استخدام تضمينات الـ automod بدلاً من التضمينات الغنية (أصغر حجماً لكن بمعلومات أقل)",
            "en": "Display auto-moderation embeds without requiring a click."
        },
        "listMode": {
            "ar": "استخدام قائمة المعرّفات كقائمة سوداء أو بيضاء",
            "en": "Whether to use the list as a blacklist or whitelist."
        },
        "idList": {
            "ar": "معرّفات السيرفر/القناة/المستخدم لإدراجها في القائمة السوداء أو البيضاء (مفصولة بفواصل)",
            "en": "List of channel or server IDs to blacklist or whitelist."
        }
    }
});
