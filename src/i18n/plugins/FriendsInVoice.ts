/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يضيف زرّاً في الشريط العلوي يسرد الروم الصوتي الذي يجلس فيه أصدقاؤك، مع الانضمام إليه بنقرة واحدة. كليك يمين على أي شخص لمراقبته، فيُتتبَّع حتى في خوادم لم تفتحها. يعمل حتى لو ظهر «غير متصل»، لأنّ حالة الصوت غير مرتبطة بحالة الظهور.",
        "en": "Adds a top bar button listing which voice channel your friends are in, with one click to join them. Right-click anyone to watch them, so they are tracked even in servers you have not opened. Works while they appear offline, because voice state is not tied to status."
    },
    "options": {
        "includeCalls": {
            "ar": "إدراج الأصدقاء الموجودين في مكالمة خاصة أو مكالمة مجموعة أيضاً، لا رومات الخوادم فقط."
        },
        "showAllFriends": {
            "ar": "إلى جانب مَن تراقبهم، أدرِج أيضاً أي صديق آخر يعرف العميل روم الصوت الذي يجلس فيه."
        }
    }
});
