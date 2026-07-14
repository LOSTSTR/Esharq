/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يُحاكي محلياً أصدقاء ديسكورد وطلبات الصداقة من قائمة النقر بالزر الأيمن (على مستخدم أو خادم). في الذاكرة فقط (يُصفَّر عند إعادة التشغيل)، ولا يُرسَل أي شيء إلى ديسكورد إطلاقاً.",
        "en": "Locally simulate Discord friends and friend requests from the right-click menu (per-user or per-server). In-memory only (resets on restart); nothing is ever sent to Discord."
    }
});
