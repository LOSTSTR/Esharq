/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يعرض التوقيت المحلي للمستخدمين في الملفات الشخصية ورؤوس الرسائل",
        "en": "Displays users' local time in profiles and message headers."
    },
    "options": {
        "showTimezoneInfo": {
            "ar": "عرض معلومات المنطقة الزمنية بجانب الوقت",
            "en": "Show timezone info in profiles."
        },
        "showMessageHeaderTime": {
            "ar": "عرض الوقت في رؤوس الرسائل",
            "en": "Show local time in message headers."
        },
        "showProfileTime": {
            "ar": "عرض الوقت في الملفات الشخصية",
            "en": "Show local time in profile popouts."
        },
        "useDatabase": {
            "ar": "تفعيل قاعدة البيانات للحصول على مناطق زمنية المستخدمين",
            "en": "Use the timezone database."
        },
        "preferDatabaseOverLocal": {
            "ar": "تفضيل قاعدة البيانات على التخزين المحلي للمناطق الزمنية",
            "en": "Prefer database timezone over local setting."
        },
        "databaseUrl": {
            "ar": "رابط URL لقاعدة بيانات تخزين المناطق الزمنية",
            "en": "URL of the timezone database."
        },
        "setDatabaseTimezone": {
            "ar": "ضبط منطقتك الزمنية في قاعدة البيانات",
            "en": "Set your timezone in the database."
        },
        "resetDatabaseTimezone": {
            "ar": "إعادة تعيين منطقتك الزمنية في قاعدة البيانات",
            "en": "Reset your timezone in the database."
        },
        "askedTimezone": {
            "ar": "ما إذا كان قد تم سؤال المستخدم عن ضبط منطقته الزمنية",
            "en": "Whether you've been asked to set a timezone."
        },
        "showOwnTimezone": {
            "ar": "يعرض منطقتك الزمنية في ملفك الشخصي ورؤوس الرسائل",
            "en": "Shows your timezone in your profile and message headers"
        },
        "twentyFourHourFormat": {
            "ar": "عرض الوقت بتنسيق 24 ساعة",
            "en": "Show time in 24h format"
        },
        "recipientTimezoneInDms": {
            "ar": "في الرسائل المباشرة، عرض المنطقة الزمنية للمُستلِم على رسائلك",
            "en": "In DMs, show the recipient's timezone on your messages"
        },
        "showLocalTimezone": {
            "ar": "عرض المنطقة الزمنية المحلية بدلاً من الوقت المحلي فقط",
            "en": "Show Local Timezone instead of just local"
        }
    },
    "toolboxActions": {
        "Set Database Timezone": { "ar": "تعيين المنطقة الزمنية لقاعدة البيانات", "en": "Set Database Timezone" }
    }
});
