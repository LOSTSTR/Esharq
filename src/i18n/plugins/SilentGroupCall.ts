/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "ابدأ مكالمات الرسائل الخاصة والمجموعات دون رنين لدى الآخرين — يظلّ بإمكانهم رؤية المكالمة والانضمام إليها، لكن دون وصول تنبيه المكالمة الواردة.",
        "en": "Start DM and group calls without ringing the other members — they can still see and join the call, they just don't get the incoming-call notification."
    },
    "options": {
        "silenceGroupCalls": {
            "ar": "عدم رنين الأعضاء عند بدء مكالمة مجموعة."
        },
        "silenceDMCalls": {
            "ar": "عدم رنين الطرف الآخر عند بدء مكالمة خاصة فردية."
        },
        "debugLogs": {
            "ar": "تسجيل نشاط الإضافة في وحدة التحكّم (Console)."
        }
    }
});
