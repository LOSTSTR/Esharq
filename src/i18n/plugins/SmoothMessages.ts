/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يجعل الرسائل الجديدة تنزلق بسلاسة من اليسار بدل الظهور المفاجئ.",
        "en": "Makes new messages slide in smoothly from the left instead of appearing sharply."
    },
    "options": {
        "includeFade": { "ar": "إظهار الرسائل بتلاشٍ أثناء انزلاقها", "en": "Fade messages in while they slide." }
    }
});
