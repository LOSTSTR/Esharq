/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "افتح أي قناة أو رسالة خاصة في شريط جانبي أو نافذة منبثقة.",
        "en": "Open a channel or DM as a sidebar or a popout."
    },
    "options": {
        "persistSidebar": {
            "ar": "إبقاء الدردشة الجانبية مفتوحة بعد إعادة تشغيل ديسكورد",
            "en": "Keep the sidebar chat open across Discord restarts"
        },
        "persistPopoutWindows": {
            "ar": "استعادة الدردشات المنبثقة المفتوحة بعد إعادة تشغيل ديسكورد.",
            "en": "Restore open popout chats after Discord restarts."
        },
        "popoutAlwaysOnTop": {
            "ar": "إبقاء نوافذ الدردشة المنبثقة فوق جميع النوافذ الأخرى.",
            "en": "Keep popout chat windows above all others."
        }
    }
});
