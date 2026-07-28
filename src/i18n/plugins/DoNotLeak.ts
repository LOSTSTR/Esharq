/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "إخفاء محتوى كل الرسائل والمرفقات أثناء مشاركتك للشاشة.",
        "en": "Hide all message contents and attachments while you are sharing your screen."
    },
    "options": {
        "hoverToView": {
            "ar": "إظهار المحتوى عند تمرير المؤشر فوق الرسالة."
        },
        "keybind": {
            "ar": "اختصار لوحة المفاتيح لإظهار محتوى الرسالة."
        },
        "enableForStream": {
            "ar": "التشويش أيضاً حين يكون «وضع البثّ» في ديسكورد مفعّلاً، لا أثناء مشاركتك للشاشة فقط."
        }
    }
});
