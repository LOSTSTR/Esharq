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
            "ar": "حجم رسم شاراتك. شارات ديسكورد نفسها بحجم 22 بكسل، فاختر هذا الحجم لتبدو مثلها تماماً، أو حجماً أكبر لتكون أوضح."
        },
        "atStart": {
            "ar": "ضع شاراتك قبل شارات ديسكورد الأصلية بدلاً من بعدها."
        }
    }
});
