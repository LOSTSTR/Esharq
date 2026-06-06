/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    apiKey: {
        type: OptionType.STRING,
        description: t("مفتاح API.", "API key."),
        default: "",
        placeholder: t("أدخل مفتاح API هنا لنقطة وصول الذكاء الاصطناعي.", "Enter API Key here for your AI endpoint."),
        componentProps: {
            type: "password"
        }
    },
    model: {
        type: OptionType.STRING,
        description: t("نموذج الذكاء الاصطناعي المستخدم.", "The AI model to use."),
        default: "google/gemini-3-flash-preview",
        placeholder: "e.g. google/gemini-3-flash-preview, inception/mercury, openai/gpt-5.2-chat, etc."
    },
    systemPrompt: {
        type: OptionType.STRING,
        description: t("موجّه النظام للذكاء الاصطناعي. العناصر النائبة: {current_user}, {current_time}", "System prompt for the AI. Placeholders: {current_user}, {current_time}"),
        default: "You are a helpful assistant who answers questions for the user in a concise and short way while using the least amount of words and punctuation.\nCurrent user: {current_user}\nCurrent time: {current_time}",
        placeholder: t("أدخل موجّه النظام.", "Enter system prompt."),
        multiline: true
    },
    maxTokens: {
        type: OptionType.NUMBER,
        description: t("الحد الأقصى لعدد الرموز في الاستجابة.", "Maximum number of tokens in the response."),
        default: 500
    },
    endpoint: {
        type: OptionType.STRING,
        description: t("نقطة نهاية ذكاء اصطناعي متوافقة مع OpenAI.", "OpenAI-compatible AI endpoint."),
        default: "https://openrouter.ai/api/v1/chat/completions",
        placeholder: t("أدخل نقطة وصول الذكاء الاصطناعي المتوافقة مع OpenAI هنا.", "Enter your OpenAI compatible AI endpoint here.")
    },
    context: {
        type: OptionType.NUMBER,
        description: t("عدد الرسائل السابقة التي تُضمَّن كسياق.", "Number of previous messages included as context."),
        default: 0
    },
    passMessageAuthorName: {
        type: OptionType.BOOLEAN,
        description: t("إضافة اسم المؤلف قبل محتوى الرسالة عند إرسالها للذكاء الاصطناعي. يساعد على تمييز المستخدمين المختلفين في المحادثة.", "Prepend author name to message content when sending to AI. Helps distinguish different users in the conversation."),
        default: true
    },
    treatSelfAsAssistant: {
        type: OptionType.BOOLEAN,
        description: t("عند التفعيل، تُعامَل رسائلك كرسائل مساعد في السياق. قد يجعل بعض النماذج تبدأ بكتابة قصص خيالية.", "When enabled, your messages are treated as assistant messages in context. May cause some models to start writing fiction."),
        default: false
    },
    mode: {
        type: OptionType.SELECT,
        description: t("كيف يجب معالجة الإجابات؟", "How should answers be handled?"),
        options: [
            { label: t("ردّ تلقائي", "Auto Reply"), value: "autoreply" },
            { label: t("استبدال نصّ شريط الدردشة", "Replace Chatbar Text"), value: "chatbar", default: true },
            { label: "Clyde", value: "bot" }
        ]
    },
    supportImages: {
        type: OptionType.BOOLEAN,
        description: t("تمرير الصور للذكاء الاصطناعي كسياق (إن وجدت). لا يدعم هذا كل النماذج.", "Pass images to the AI as context (if any). Not all models support this."),
        default: true
    }
});
