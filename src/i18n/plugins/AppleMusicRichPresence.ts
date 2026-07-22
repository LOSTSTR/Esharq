/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يعرض نشاطك الموسيقي في Apple Music",
        "en": "Displays your Apple Music activity as a status."
    },
    "options": {
        "activityType": {
            "ar": "نوع النشاط المعروض",
            "en": "Activity type displayed."
        },
        "statusDisplayType": {
            "ar": "إظهار اسم المقطع/الفنان في قائمة الأعضاء",
            "en": "Show track/artist name in the members list."
        },
        "refreshInterval": {
            "ar": "الفاصل الزمني بين تحديثات النشاط (بالثواني)",
            "en": "Time between activity updates (in seconds)."
        },
        "enableTimestamps": {
            "ar": "تفعيل أو تعطيل الطوابع الزمنية",
            "en": "Toggle timestamps on or off."
        },
        "enableButtons": {
            "ar": "تفعيل أو تعطيل الأزرار",
            "en": "Toggle buttons on or off."
        },
        "nameString": {
            "ar": "نص تنسيق اسم النشاط",
            "en": "Activity name format text."
        },
        "detailsString": {
            "ar": "نص تنسيق تفاصيل النشاط",
            "en": "Activity details format text."
        },
        "stateString": {
            "ar": "نص تنسيق حالة النشاط",
            "en": "Activity state format text."
        },
        "largeImageType": {
            "ar": "نوع الصورة الكبيرة في أصول النشاط",
            "en": "Large image type in activity assets."
        },
        "largeTextString": {
            "ar": "نص تنسيق النص الكبير في أصول النشاط",
            "en": "Large text format in activity assets."
        },
        "smallImageType": {
            "ar": "نوع الصورة الصغيرة في أصول النشاط",
            "en": "Small image type in activity assets."
        },
        "smallTextString": {
            "ar": "نص تنسيق النص الصغير في أصول النشاط",
            "en": "Small text format in activity assets."
        },
        "detailsLink": {
            "ar": "رابط تفاصيل النشاط",
            "en": "Activity details link"
        },
        "stateLink": {
            "ar": "رابط حالة النشاط",
            "en": "Activity state link"
        },
        "largeImageLink": {
            "ar": "رابط الصورة الكبيرة في أصول النشاط",
            "en": "Activity assets large image link"
        },
        "smallImageLink": {
            "ar": "رابط الصورة الصغيرة في أصول النشاط",
            "en": "Activity assets small image link"
        }
    }
});
