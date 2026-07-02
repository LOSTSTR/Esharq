/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": { "ar": "يعيد صياغة رسائلك الصادرة بأسلوب tsundere لطيف بالذكاء الاصطناعي (Groq، بمفتاحك المجاني الخاص).", "en": "Rewrites your outgoing messages into a cute tsundere style using AI (Groq, with your own free API key)." },
    "options": {
        "intensity": { "ar": "مدى حدّة أسلوب tsundere في الصياغة." },
        "appendTilde": { "ar": "إضافة علامة ~ عندما تناسب الرسالة." },
        "apiKey": { "ar": "مفتاح Groq المجاني الخاص بك (console.groq.com/keys). يُحفَظ على جهازك فقط." },
        "model": { "ar": "نموذج Groq المستخدم." }
    }
});
