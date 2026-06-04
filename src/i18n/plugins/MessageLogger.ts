/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يحفظ الرسائل المحذوفة والمعدَّلة",
        "en": "Saves deleted and edited messages."
    },
    "options": {
        "deleteStyle": {
            "ar": "أسلوب عرض الرسائل المحذوفة",
            "en": "How to display deleted messages.",
            "choices": {
                "text": { "ar": "نص أحمر", "en": "Red text" },
                "overlay": { "ar": "تظليل أحمر", "en": "Red overlay" }
            }
        },
        "logDeletes": {
            "ar": "تسجيل الرسائل المحذوفة",
            "en": "Log deleted messages."
        },
        "collapseDeleted": {
            "ar": "طي الرسائل المحذوفة، مشابهاً لطي الرسائل المحجوبة",
            "en": "Collapse deleted messages by default."
        },
        "logEdits": {
            "ar": "تسجيل الرسائل المعدّلة",
            "en": "Log message edits."
        },
        "inlineEdits": {
            "ar": "عرض سجل التعديلات ضمن محتوى الرسالة",
            "en": "Show edits inline instead of below the message."
        },
        "ignoreBots": {
            "ar": "تجاهل رسائل البوتات",
            "en": "Ignore messages from bots."
        },
        "ignoreSelf": {
            "ar": "تجاهل رسائلك الخاصة",
            "en": "Ignore your own messages."
        },
        "ignoreSelfEdits": {
            "ar": "تجاهل تعديلاتك الخاصة",
            "en": "Ignore your own message edits."
        },
        "ignoreUsers": {
            "ar": "قائمة معرّفات المستخدمين المراد تجاهلهم (مفصولة بفواصل)",
            "en": "User IDs to ignore."
        },
        "ignoreChannels": {
            "ar": "قائمة معرّفات القنوات المراد تجاهلها (مفصولة بفواصل)",
            "en": "Channel IDs to ignore."
        },
        "ignoreGuilds": {
            "ar": "قائمة معرّفات السيرفرات المراد تجاهلها (مفصولة بفواصل)",
            "en": "Server IDs to ignore."
        },
        "showEditDiffs": {
            "ar": "إظهار الفروقات البصرية بين نسخ الرسالة المعدّلة",
            "en": "Show a diff between the original and edited message."
        },
        "separatedDiffs": {
            "ar": "فصل الإضافات والحذف في الفروقات لعرض تفاضلي أوضح",
            "en": "Show the diff in a separate section."
        }
    }
});
