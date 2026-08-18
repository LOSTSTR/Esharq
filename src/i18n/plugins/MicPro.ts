/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "محرّك مختبر الصوت: يُطبّق إعدادات ميكروفونك (الكسب، إلغاء الضوضاء، إلغاء الصدى، AGC، الحساسية) على كل مكالمة عبر محرّك ديسكورد الأصلي، ويُضيف النقل الستيريو عالي الجودة. لوحته في إعدادات إشراق ← مختبر الصوت.",
        "en": "Voice Lab engine: applies your microphone settings (gain, noise reduction, echo cancellation, AGC, sensitivity) to every call on Discord's native engine, and adds high-quality stereo transmission. Its panel lives in Esharq Settings under Voice Lab."
    },
    "options": {
        "applyToCalls": {
            "ar": "طبّق إعدادات مختبر الصوت على كل مكالمة. عند الإطفاء تحكم إعدادات ديسكورد نفسها.",
            "en": "Apply your Voice Lab settings to every call. When off, Discord's own audio settings take over."
        },
        "autoDeafenOnTest": {
            "ar": "كتم السماع تلقائياً أثناء اختبار الميكروفون (كي لا تسمع القناة مزدوجة)",
            "en": "Self-deafen while the loopback mic test is active (so you don't hear the channel doubled)"
        }
    }
});
