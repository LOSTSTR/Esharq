/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "استخدم Ctrl+Tab لمعاينة القنوات والرسائل الخاصة المفتوحة مؤخّراً والتنقّل بينها.",
        "en": "Use Ctrl+Tab to preview and switch between recently opened channels and DMs."
    },
    "options": {
        "maxRecentChannels": { "ar": "أقصى عدد للقنوات الأخيرة في المبدّل", "en": "Maximum recent channels to keep in the switcher" },
        "starredFirst": { "ar": "إظهار القنوات المميّزة بنجمة فوق الأخيرة", "en": "Show starred channels above recent channels" },
        "persistRecents": { "ar": "تذكّر القنوات الأخيرة بعد إعادة تشغيل ديسكورد", "en": "Remember recent channels after restarting Discord" },
        "animations": { "ar": "تفعيل حركات ظهور وإغلاق المبدّل", "en": "Enable switcher hover and close animations" },
        "showUnreadBadges": { "ar": "إظهار عدّادات الإشارات غير المقروءة في المبدّل", "en": "Show unread mention counts in the switcher" },
        "addMentionedChannels": { "ar": "إضافة القنوات إلى المبدّل عند الإشارة إليك فيها", "en": "Add channels to the switcher when you are mentioned there" }
    }
});
