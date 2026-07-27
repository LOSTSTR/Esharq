/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يعرض «نشِط منذ كذا» تحت أسماء المستخدمين في قائمة الرسائل الخاصة، لمن رصدت الإضافة خروجهم فعلاً. ديسكورد لا يكشف لأحد منذ متى غاب الشخص، لذا مَن كان غائباً قبل تشغيلك لا يظهر له وقت إطلاقاً بدل وقت مُختلَق.",
        "en": "Shows 'Active X ago' under usernames in the DM list, for the people it watched go offline. Discord never reveals how long someone has already been away, so anyone who was offline before you started shows no time at all rather than a made-up one."
    },
    "options": {
        "persist": {
            "ar": "الاحتفاظ بأوقات آخر ظهور بعد إعادة التشغيل. يُستحسن إبقاؤه مفعّلاً: ديسكورد لا يُخبر أحداً منذ متى غاب الشخص، فالأوقات الوحيدة الموجودة هي حالات الخروج التي رصدتها الإضافة بنفسها."
        }
    }
});
