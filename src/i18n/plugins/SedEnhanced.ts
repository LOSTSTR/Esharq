/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يوسّع دعم `sed` البسيط في ديسكورد لتعديل رسائلك بنمط البحث والاستبدال.",
        "en": "Expands on Discord's rudimentary `sed` support."
    },
    "options": {
        "regexByDefault": {
            "ar": "يعكس راية `r`: استخدامها يفعّل الوضع غير التعبيري، وحذفها يستخدم وضع التعبير النمطي (regex).",
            "en": "Inverts the `r` flag, so using the `r` flag enables non-regex mode, and omitting it uses regex mode."
        }
    }
});
