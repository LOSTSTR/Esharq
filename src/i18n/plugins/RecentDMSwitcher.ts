/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "التنقل بين الرسائل المباشرة الأكثر استخداماً باستخدام Ctrl+Tab (Ctrl+Shift+Tab للعكس)",
        "en": "Navigate between most-used DMs with Ctrl+Tab (Ctrl+Shift+Tab to go back)."
    },
    "options": {
        "visualStyle": {
            "ar": "نمط المؤشر البصري أثناء التنقل",
            "en": "Visual indicator style while cycling.",
            "choices": {
                "overlay": { "ar": "تراكب (نمط Alt+Tab)", "en": "Overlay (Alt+Tab style)" },
                "toast": { "ar": "إشعار منبثق (رسالة حالة)", "en": "Toast (status message)" },
                "off": { "ar": "معطّل", "en": "Off" }
            }
        },
        "overlayMode": {
            "ar": "محتوى التراكب",
            "en": "Overlay content to display.",
            "choices": {
                "row": { "ar": "صف من الأخيرة", "en": "Row of recent" },
                "current": { "ar": "الحالي فقط", "en": "Current only" }
            }
        },
        "amountOfUsers": {
            "ar": "عدد المستخدمين المعروضين في التراكب",
            "en": "Number of users shown in the overlay."
        },
        "overlayRowLength": {
            "ar": "عدد الرسائل المباشرة الأخيرة المعروضة في الصف",
            "en": "Number of recent DMs shown in the overlay row."
        },
        "overlayShowAvatars": {
            "ar": "إظهار الصور الشخصية في التراكب",
            "en": "Show avatars in the overlay."
        },
        "toastDurationMs": {
            "ar": "مدة إخفاء الإشعار المنبثق (بالميلي ثانية)",
            "en": "Duration before the toast notification hides (in milliseconds)."
        },
        "clearRdms": {
            "ar": "أداة اختبار: مسح قائمة RDMS",
            "en": "Clear the RDMS history."
        }
    }
});
