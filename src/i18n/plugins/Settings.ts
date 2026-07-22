/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يضيف واجهة الإعدادات ومعلومات التشخيص",
        "en": "Adds a settings UI and diagnostic information."
    },
    "options": {
        "arabicMode": {
            "ar": "Arabic Mode / وضع اللغة العربية — Show plugin names and descriptions in Arabic. Disable to switch to English.",
            "en": "Arabic Mode — Show plugin names and descriptions in Arabic. Disable to switch to English."
        },
        "arabicFont": {
            "ar": "Arabic Font (Tajawal) / خطّ التعريب (Tajawal) — يوحّد خطّ كلّ النصوص العربية (واجهة Discord، ولوحة اشراق، والإضافات). مُفعّل افتراضيّاً؛ عطّله لإبقاء خطّ Discord الافتراضيّ. تتأثّر الحروف العربية فقط، ويبقى النصّ اللاتينيّ والشيفرة دون تغيير.",
            "en": "Arabic Font (Tajawal) — Unify the font of all Arabic text (Discord UI, the Esharq panel, and plugins). On by default; disable to keep Discord's default font. Only Arabic glyphs are affected; Latin text and code blocks stay untouched."
        },
        "settingsLocation": {
            "ar": "مكان عرض قسم إعدادات Equicord في الإعدادات",
            "en": "Where to display the Equicord settings section."
        },
        "includeVencordInfoWhenCopying": {
            "ar": "نسخ معلومات Vencord (Vencord، Electron، Chromium) أيضاً عند النقر على معلومات الإصدار في صفحة الإعدادات",
            "en": "Also copy Vencord info (Vencord, Electron, Chromium) when clicking the version info in the bottom-left corner of the settings page."
        }
    }
});
