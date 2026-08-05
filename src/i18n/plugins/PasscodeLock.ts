/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "احمِ ديسكورد برمز سرّي — يُقفل عند بدء التشغيل أو بعد الغياب. ⚠️ يردع من يمرّ بجهازك، ولا يحمي ممّن يملك وصولاً كاملاً إليه.",
        "en": "Protect Discord with a passcode."
    },
    "options": {
        "codeType": {
            "ar": "نوع الرمز",
            "choices": {
                "4-digit": { "ar": "رمز رقمي من ٤ خانات" },
                "6-digit": { "ar": "رمز رقمي من ٦ خانات" },
                "custom-numeric": { "ar": "رمز رقمي بطول مخصّص" }
            }
        },
        "autolockSeconds": {
            "ar": "القفل تلقائياً بعد غياب",
            "choices": {
                "0": { "ar": "معطّل" },
                "60": { "ar": "دقيقة واحدة" },
                "300": { "ar": "٥ دقائق" },
                "3600": { "ar": "ساعة واحدة" },
                "18000": { "ar": "٥ ساعات" }
            }
        },
        "lockOnStartup": {
            "ar": "القفل دائماً عند بدء التشغيل"
        },
        "highlightButtons": {
            "ar": "إبراز أزرار الأرقام عند كتابة الرمز بلوحة المفاتيح"
        },
        "hideNotifications": {
            "ar": "إخفاء محتوى الإشعارات أثناء القفل"
        },
        "keybind": {
            "ar": "اختصار قفل ديسكورد فوراً (مثال: control+l)"
        }
    }
});
