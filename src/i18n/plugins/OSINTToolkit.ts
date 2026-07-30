/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يضيف أوامر OSINT وروابط بحث سريعة لفحص النطاقات وعناوين IP وأسماء المستخدمين العامة. ⚠️ يفتح مواقع خارجية ويُرسل إليها معلومات عامة عند النقر — استخدمه بمسؤولية.",
        "en": "Adds OSINT commands and quick lookup links for public domain, IP and username checks. ⚠️ Opens external sites and sends public info to them on click — use responsibly."
    },
    "options": {
        "enableLogging": {
            "ar": "تسجيل تفاصيل البحث أثناء التنقيح.",
            "en": "Log lookup details while debugging."
        }
    }
});
