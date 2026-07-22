/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يعرض عناصر مخفية ومقتصرة على المشرفين بغض النظر عن الصلاحيات.",
        "en": "Shows hidden elements and admin-only features regardless of permissions."
    },
    "options": {
        "showTimeouts": {
            "ar": "إظهار أيقونات المهلة (timeout) للأعضاء في الدردشة.",
            "en": "Show member timeout icons in chat."
        },
        "showInvitesPaused": {
            "ar": "إظهار تلميح «الدعوات موقوفة» في قائمة الخوادم.",
            "en": "Show the invites paused tooltip in the server list."
        },
        "showModView": {
            "ar": "إظهار عنصر «عرض إشراف العضو» في قائمة السياق في كل الخوادم.",
            "en": "Show the member mod view context menu item in all servers."
        }
    }
});
