/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يُظهر القنوات المخفية مع الإشارة إلى عدم إمكانية الوصول",
        "en": "Shows hidden channels with an indicator that they cannot be accessed."
    },
    "options": {
        "channelStyle": {
            "ar": "أسلوب عرض القنوات المخفية.",
            "en": "Visual style for hidden channels.",
            "choices": {
                "0": { "ar": "كلاسيكي", "en": "Classic" },
                "1": { "ar": "مكتوم", "en": "Muted" },
                "2": { "ar": "إظهار غير المقروء", "en": "Show Unreads" },
                "3": { "ar": "مكتوم وإظهار غير المقروء", "en": "Muted and Show Unreads" }
            }
        },
        "showMode": {
            "ar": "الوضع المستخدم لعرض القنوات المخفية.",
            "en": "What to show for hidden channels.",
            "choices": {
                "0": { "ar": "أيقونة قفل بدل أيقونة القناة", "en": "Lock Icon replacing channel icon" },
                "2": { "ar": "أيقونة عين على اليمين", "en": "Eye icon on the right" },
                "1": { "ar": "أيقونة قفل على اليمين", "en": "Lock icon on the right" }
            }
        },
        "defaultAllowedUsersAndRolesDropdownState": {
            "ar": "ما إذا كانت القائمة المنسدلة للمستخدمين والأدوار المسموح لهم في القنوات المخفية مفتوحة افتراضياً",
            "en": "Default state of the allowed users/roles dropdown."
        }
    }
});
