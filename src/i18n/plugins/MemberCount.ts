/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يعرض عدد الأعضاء المتصلين وإجمالي الأعضاء ومن هم في القنوات الصوتية بالخادم — في قائمة الأعضاء والتلميح",
        "en": "Shows the number of online members, total members, and users in voice channels on the server - in the member list and tooltip."
    },
    "options": {
        "toolTip": {
            "ar": "عرض عدد الأعضاء في تلميح السيرفر",
            "en": "Show member count in the channel tooltip."
        },
        "memberList": {
            "ar": "إظهار عدد الأعضاء في قائمة الأعضاء",
            "en": "Show member count in the member list."
        },
        "voiceActivity": {
            "ar": "إظهار نشاط الصوت مع عدد الأعضاء في قائمة الأعضاء",
            "en": "Show voice activity counts."
        }
    }
});
