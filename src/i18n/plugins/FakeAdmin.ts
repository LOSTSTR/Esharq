/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "في العميل فقط: يجعل واجهة ديسكورد تظنّ أنّك تملك كل الصلاحيات (واختيارياً أنّك مالك كل السيرفرات)، فتُفتح القنوات المخفية وقوائم الإدارة/المالك. ⚠️ لا سلطة حقيقية — الخادم يفرض صلاحياتك الفعلية وأيّ إجراء يُرفَض.",
        "en": "Client-side only: makes Discord's UI think you have every permission (and optionally that you own every server), unlocking hidden channels and admin/owner menus. ⚠️ No real power — the server still enforces your actual permissions and any action is rejected."
    },
    "options": {
        "fakeOwner": {
            "ar": "تزييف ملكية كل السيرفرات (يفتح خيارات المالك لكنّه الأكثر إثارة للشبهة). مُطفأ افتراضياً.",
            "en": "Also fake ownership of every server (unlocks owner-only options but is the most suspicious part). Off by default."
        }
    }
});
