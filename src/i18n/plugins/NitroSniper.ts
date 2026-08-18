/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يستبدل تلقائياً روابط هدايا نيترو المُرسلة في الدردشة.\n\n⚠️ تحذير: تقوم هذه الإضافة تلقائياً باسترداد أكواد هدايا نيترو من الدردشة، مما قد ينتهك شروط خدمة Discord ويُعرّض حسابك للتعليق. استخدمها على مسؤوليتك الخاصة.",
        "en": "Automatically redeems Nitro gift links sent in chat.\n\n⚠️ WARNING: This plugin automatically redeems Nitro gift codes found in chat. This may violate Discord's Terms of Service and could result in account suspension. Use at your own risk."
    },
    "options": {
        "notifyOnRedeem": {
            "ar": "عرض إشعار عند استبدال كود نيترو بنجاح.",
            "en": "Show a notification when a Nitro code is successfully redeemed."
        },
        "notifyOnFail": {
            "ar": "عرض إشعار عند فشل استبدال كود نيترو.",
            "en": "Show a notification when a Nitro code fails to redeem."
        },
        "ignoreOwnGiftLinks": {
            "ar": "لا تستبدل روابط هدايا نيترو الواردة في رسائل أرسلتها أنت.",
            "en": "Do not redeem Nitro gift links from messages you sent yourself."
        }
    }
});
