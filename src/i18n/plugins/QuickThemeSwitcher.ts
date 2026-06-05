/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "التبديل السريع بين الثيمات باستخدام اختصارات لوحة المفاتيح.",
        "en": "Quickly switch between themes using keyboard shortcuts."
    },
    "options": {
        "includeLocal": {
            "ar": "تضمين الثيمات المحلية",
            "en": "Include local themes."
        },
        "includeOnline": {
            "ar": "تضمين الثيمات الإلكترونية",
            "en": "Include online themes."
        },
        "sortOrder": {
            "ar": "طريقة الترتيب",
            "en": "Sort order for the theme list.",
            "choices": {
                "recent": { "ar": "الأحدث", "en": "Recent" }
            }
        },
        "autoRefresh": {
            "ar": "تحديث قائمة الثيمات تلقائياً عند اكتشاف تغييرات",
            "en": "Automatically refresh the theme list when changes are detected."
        },
        "showNotifications": {
            "ar": "إظهار الإشعارات عند إضافة أو إزالة الثيمات",
            "en": "Show notifications when themes are added or removed."
        }
    }
});
