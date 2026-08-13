/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { AIChatMessage, esharqChat, GROQ_MODEL_OPTIONS } from "@utils/esharqAI";
import { t } from "@utils/esharqI18n";
import { sleep } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { ChannelStore, Constants, RestAPI, SnowflakeUtils, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    apiKey: {
        type: OptionType.STRING,
        description: "Your own free Groq API key (console.groq.com/keys). Stored only on your device.",
        default: ""
    },
    model: {
        type: OptionType.SELECT,
        description: "Groq model to use.",
        options: [...GROQ_MODEL_OPTIONS]
    },
    temperature: {
        type: OptionType.SLIDER,
        description: "Temperature — 0 = precise, 1 = creative.",
        markers: [0, 0.2, 0.5, 0.7, 1.0],
        default: 0.3
    },
    maxTokens: {
        type: OptionType.NUMBER,
        description: "Max tokens for the AI response.",
        default: 2000
    },
    systemPrompt: {
        type: OptionType.STRING,
        description: "System prompt for the AI.",
        default: "You are a helpful assistant that summarizes Discord chat conversations. Be concise and factual.",
        multiline: true
    }
});

async function fetchMessages(channelId: string, limit: number, timeframeHours?: number, authorId?: string): Promise<Message[]> {
    const messages: Message[] = [];
    let before: string | undefined = undefined;
    const cutoffSnowflake = timeframeHours
        ? SnowflakeUtils.fromTimestamp(Date.now() - timeframeHours * 3600_000)
        : undefined;

    while (messages.length < limit) {
        const batchSize = Math.min(100, limit - messages.length);
        const res = await RestAPI.get({
            url: Constants.Endpoints.MESSAGES(channelId),
            query: { limit: batchSize, ...(before ? { before } : {}) },
            retries: 2
        }).catch(() => null as any);

        const batch: Message[] = res?.body ?? [];
        if (!batch.length) break;

        for (const msg of batch) {
            if (cutoffSnowflake && msg.id < cutoffSnowflake) return messages;
            if (!authorId || msg.author?.id === authorId) messages.push(msg);
        }

        before = batch[batch.length - 1].id;
        if (batch.length < batchSize) break;
        await sleep(250); // rate-limit courtesy between fetch batches (shared helper)
    }

    return messages;
}

function formatMessages(messages: Message[]): string {
    return messages.map(m => {
        const author = m.author?.globalName || m.author?.username || "Unknown";
        const time = new Date(m.timestamp).toLocaleString();
        const content = m.content || "(no text)";
        return `[${time}] ${author}: ${content}`;
    }).join("\n");
}

function buildSummaryPrompt(formattedMessages: string, style: string, channelName: string, personName?: string): AIChatMessage[] {
    let styleInstruction: string;
    switch (style) {
        case "short":
            styleInstruction = "Provide a brief 2-3 sentence summary highlighting only the most important points.";
            break;
        case "exact":
            styleInstruction = "Provide a detailed, thorough summary covering all topics discussed, key decisions, notable quotes, and outcomes. Be comprehensive.";
            break;
        case "mid":
        default:
            styleInstruction = "Provide a concise but complete summary covering the main topics, decisions, and outcomes.";
            break;
    }

    const filterNote = personName
        ? `Only messages from ${personName} are included.`
        : "All messages from all users are included.";

    return [
        { role: "system", content: settings.store.systemPrompt },
        {
            role: "user",
            content: `Summarize the following Discord chat from #${channelName}.\n\n${filterNote}\nSummary style: ${styleInstruction}\n\nChat log:\n${formattedMessages}\n\nProvide your summary now.`
        }
    ];
}

export default definePlugin({
    name: "SummarizeAI",
    description: "Summarize Discord channel conversations using AI (Groq, with your own free API key).",
    dependencies: ["CommandsAPI"],
    tags: ["Utility"],
    authors: [{ name: "x2b", id: 996137713432530976n }],
    settings,

    commands: [
        {
            name: "summary",
            description: "Summarize a channel's recent messages using AI",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                { name: "channel", description: "Channel to summarize", type: ApplicationCommandOptionType.CHANNEL, required: true },
                {
                    name: "style", description: "Summary detail level", type: ApplicationCommandOptionType.STRING, required: false,
                    choices: [
                        { name: "Short", label: "Short", value: "short" },
                        { name: "Medium", label: "Medium", value: "mid" },
                        { name: "Detailed", label: "Detailed", value: "exact" }
                    ]
                },
                { name: "person", description: "Only summarize messages from this user", type: ApplicationCommandOptionType.USER, required: false },
                { name: "timeframe", description: "Hours back to look (e.g. 1, 2, 6, 12, 24)", type: ApplicationCommandOptionType.INTEGER, required: false },
                { name: "messages", description: "Max messages to fetch (default 100, max 500)", type: ApplicationCommandOptionType.INTEGER, required: false }
            ],
            execute: async (opts, ctx) => {
                const channelId: string = findOption(opts, "channel", ctx.channel?.id);
                const channel = ChannelStore.getChannel(channelId);
                if (!channel) {
                    sendBotMessage(ctx.channel.id, { content: t("قناة غير صالحة.", "Invalid channel specified.") });
                    return;
                }

                const channelName = channel.name || channel.id;
                const style: string = findOption(opts, "style", "mid");
                const personId: string = findOption(opts, "person", "");
                const person = personId ? UserStore.getUser(personId) : null;
                const timeframe: number | undefined = findOption(opts, "timeframe", undefined);
                const msgLimit = Math.min(Math.max(findOption(opts, "messages", 100) || 100, 10), 500);

                sendBotMessage(ctx.channel.id, { content: t(`> جاري جلب الرسائل من #${channelName}...`, `> Fetching messages from #${channelName}...`) });

                try {
                    const messages = await fetchMessages(channelId, msgLimit, timeframe, personId || undefined);

                    if (messages.length === 0) {
                        sendBotMessage(ctx.channel.id, { content: t(`> لا توجد رسائل في #${channelName}.`, `> No messages found in #${channelName}.`) });
                        return;
                    }

                    sendBotMessage(ctx.channel.id, { content: t(`> عُثر على ${messages.length} رسالة. جاري التلخيص...`, `> Found ${messages.length} messages. Summarizing...`) });

                    const formatted = formatMessages(messages);
                    const personName = person?.globalName || person?.username;
                    const prompt = buildSummaryPrompt(formatted, style, channelName, personName);
                    const summary = await esharqChat({
                        apiKey: settings.store.apiKey,
                        model: settings.store.model,
                        messages: prompt,
                        temperature: settings.store.temperature,
                        maxTokens: settings.store.maxTokens
                    });

                    sendBotMessage(ctx.channel.id, { content: t(`**ملخّص #${channelName}** (${messages.length} رسالة):\n\n${summary}`, `**Summary of #${channelName}** (${messages.length} messages):\n\n${summary}`) });
                } catch (err: any) {
                    sendBotMessage(ctx.channel.id, { content: t(`> خطأ: ${err?.message || "تعذّر إنشاء الملخّص"}`, `> Error: ${err?.message || "Failed to generate summary"}`) });
                }
            }
        }
    ]
});
