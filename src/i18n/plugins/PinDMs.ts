/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يُتيح تثبيت المحادثات الخاصة في أعلى القائمة",
        "en": "Allows pinning DM conversations to the top of the list."
    },
    "options": {
        "userBasedCategoryList": {
            "ar": "قائمة الفئات حسب المستخدم"
        },
        "pinOrder": {
            "ar": "ترتيب عرض المحادثات الخاصة المثبتة",
            "en": "How pinned DMs are sorted."
        },
        "canCollapseDmSection": {
            "ar": "السماح بطي قسم الرسائل المباشرة غير المصنفة",
            "en": "Allow collapsing the pinned DMs section."
        },
        "dmSectionCollapsed": {
            "ar": "طي قسم الرسائل المباشرة",
            "en": "Collapse the pinned DMs section by default."
        }
    }
});
