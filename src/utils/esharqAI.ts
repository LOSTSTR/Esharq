/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Minimal shared AI helper for Esharq plugins. Uses Groq's OpenAI-compatible endpoint with each
// user's OWN free API key (console.groq.com/keys), stored in that plugin's own settings. No key
// is ever placed in the source, and there is no shared/hardcoded key — every user creates their
// own. This keeps requests private, avoids abuse/bans of a shared key, and leaks nothing publicly.

export interface AIChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

// A small, current set of Groq-hosted models. Users can still type a custom one if they prefer.
export const GROQ_MODEL_OPTIONS = [
    { label: "Llama 3.3 70B (versatile)", value: "llama-3.3-70b-versatile", default: true },
    { label: "Llama 3.1 8B (instant)", value: "llama-3.1-8b-instant" },
    { label: "GPT OSS 120B", value: "openai/gpt-oss-120b" },
    { label: "GPT OSS 20B", value: "openai/gpt-oss-20b" }
] as const;

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export interface EsharqChatOptions {
    apiKey: string;
    messages: AIChatMessage[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
}

export async function esharqChat({ apiKey, messages, model, temperature = 0.7, maxTokens = 1000 }: EsharqChatOptions): Promise<string> {
    const key = apiKey?.trim();
    if (!key) throw new Error("No Groq API key set. Create a free key at console.groq.com/keys and paste it in the plugin settings.");

    const res = await fetch(GROQ_ENDPOINT, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: model?.trim() || DEFAULT_GROQ_MODEL,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: false
        })
    });

    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Groq API ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    return (data?.choices?.[0]?.message?.content ?? "").trim();
}
