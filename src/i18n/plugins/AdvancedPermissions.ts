/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يعرض بطاقة الأذونات المتقدّمة افتراضيًّا.",
        "en": "Show advanced permissions card by default."
    },
    "options": {
        "simplifiedCard": {
            "ar": "ما الذي تريد فعله ببطاقة الأذونات المبسّطة في ديسكورد",
            "en": "What to do with Discord's simplified permissions card"
        },
        "collapsedByDefault": {
            "ar": "ابدأ ببطاقة الأذونات المبسّطة مطويّة.",
            "en": "Start the simplified permissions collapsed."
        }
    }
});
