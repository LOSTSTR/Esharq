/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": { "ar": "لخّص محادثات قنوات ديسكورد بالذكاء الاصطناعي (Groq، بمفتاحك المجاني الخاص).", "en": "Summarize Discord channel conversations using AI (Groq, with your own free API key)." },
    "options": {
        "apiKey": { "ar": "مفتاح Groq المجاني الخاص بك (console.groq.com/keys). يُحفَظ على جهازك فقط." },
        "model": { "ar": "نموذج Groq المستخدم." },
        "temperature": { "ar": "درجة الإبداع — 0 = دقيق، 1 = إبداعي." },
        "maxTokens": { "ar": "أقصى عدد للرموز في رد الذكاء الاصطناعي." },
        "systemPrompt": { "ar": "التوجيه النظامي للذكاء الاصطناعي." }
    }
});
