/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يعرض «نشِط منذ كذا» تحت أسماء المستخدمين في قائمة الرسائل الخاصة.",
        "en": "Shows 'Active X ago' under usernames in the DM list."
    },
    "options": {
        "persist": {
            "ar": "الاحتفاظ بأوقات آخر ظهور بعد إعادة التشغيل. مطفأ افتراضياً — الأوقات المحفوظة لا تتحدّث حتى يخرج الشخص مجدّداً، فقد تصبح قديمة."
        }
    }
});
