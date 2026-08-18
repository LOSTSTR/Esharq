/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يعرض الحسابات المرتبطة في الملف الشخصي الصغير",
        "en": "Shows linked accounts in the mini profile."
    },
    "options": {
        "iconSize": {
            "ar": "حجم الأيقونة (بكسل)",
            "en": "Size of connection icons."
        },
        "iconSpacing": {
            "ar": "هامش الأيقونة",
            "en": "Spacing between connection icons."
        },
        "showGithubOrgs": {
            "ar": "عرض منظّمات GitHub التي ينتمي إليها المستخدم.",
            "en": "Show GitHub organizations the user is a member of"
        },
        "showOnModal": {
            "ar": "عرض الحسابات المرتبطة في نافذة الملفّ الشخصي الكاملة.",
            "en": "Show connected accounts in the full-size profile modal"
        }
    }
});
