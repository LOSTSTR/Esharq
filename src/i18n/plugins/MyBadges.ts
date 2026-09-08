/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "ضع أي شارة تريدها على ملفك الشخصي، من ملف في جهازك أو من رابط مباشر. الشارات تُخزَّن محلياً ويرسمها عميلك أنت وحده، فلا يراها أحد غيرك. والحجم من اختيارك.",
        "en": "Put any badge you like on your own profile, from a file on your device or a direct link. The badges are stored locally and drawn only by your client, so nobody else can see them. You choose the size."
    },
    "options": {
        "badgeSize": {
            "ar": "حجم رسم شاراتك. «مطابق لديسكورد» يجعلها بمقاس شارات ديسكورد نفسها تماماً مهما غيّره، وهو ما تريده غالباً — واختر رقماً أكبر إن أردتها أوضح عمداً.",
            "en": "How big your badges are drawn. Match Discord keeps them exactly the size Discord draws its own, which is what you want unless you deliberately want to stand out."
        },
        "atStart": {
            "ar": "ضع شاراتك قبل شارات ديسكورد الأصلية بدلاً من بعدها."
        }
    }
});
