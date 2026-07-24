/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "إخفاء محتوى كل الرسائل والمرفقات أثناء البثّ أو مشاركة الشاشة.",
        "en": "Hide all message contents and attachments when you're streaming or sharing your screen."
    },
    "options": {
        "hoverToView": {
            "ar": "إظهار المحتوى عند تمرير المؤشر فوق الرسالة."
        },
        "keybind": {
            "ar": "اختصار لوحة المفاتيح لإظهار محتوى الرسالة."
        },
        "enableForStream": {
            "ar": "تشويش كل الرسائل في وضع البثّ."
        }
    }
});
