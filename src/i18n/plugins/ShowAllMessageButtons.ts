/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يعرض جميع أزرار الرسالة دائماً بدون تحويم",
        "en": "Always shows all message buttons without hovering."
    },
    "options": {
        "noShiftDelete": {
            "ar": "إزالة اشتراط الضغط على Shift لحذف رسالة.",
            "en": "Remove the shift requirement for the delete button."
        },
        "noShiftPin": {
            "ar": "إزالة اشتراط الضغط على Shift لتثبيت رسالة.",
            "en": "Remove the shift requirement for the pin button."
        },
        "noQuickReacts": {
            "ar": "إخفاء التفاعلات السريعة. افتراضياً، إظهار القائمة الكاملة يُخفي أزرار التفاعل السريع.",
            "en": "Hide quick reacts. By default, showing the full menu hides quick react buttons."
        }
    }
});
