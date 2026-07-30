/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, React, RestAPI } from "@webpack/common";

// Resolved lazily: we only ever read the gateway session id from it, never the token.
const AuthStore = findByPropsLazy("getToken", "getSessionId");

const logger = new Logger("AutoClaim");

// ── Warning shown at the top of the plugin settings ────────────────────────────

function AboutWarning() {
    return (
        <div style={{
            border: "1px solid #f0b232", borderRadius: 8, padding: "12px 14px", marginBottom: 12,
            background: "rgba(240, 178, 50, 0.1)", color: "var(--text-normal, #dbdee1)", fontSize: 13, lineHeight: 1.5
        }}>
            ⚠️ {t(
                "تحذير: هذه الإضافة تنقر أزرار البوتات تلقائياً نيابةً عنك — وهذا سلوك أتمتة (شبيه بالـselfbot) يخالف شروط ديسكورد وقد يعرّض حسابك للحظر. استخدمها على مسؤوليتك، ويُفضّل تفعيل «الوضع الآمن» في السيرفرات المشتركة.",
                "Warning: this plugin auto-clicks bot buttons on your behalf — that is automation (selfbot-like) which breaks Discord's Terms and can get your account banned. Use at your own risk, and prefer Safe Mode on shared servers."
            )}
        </div>
    );
}

// ── Settings ────────────────────────────────────────────────────────────────

const settings = definePluginSettings({
    enableClaimTicket: {
        type: OptionType.BOOLEAN,
        description: t("النقر تلقائياً على زرّ في رسائل البوت داخل فئة التذاكر.", "Automatically click a button on bot messages inside a ticket category."),
        default: false,
        restartNeeded: false,
    },
    claimCategoryId: {
        type: OptionType.STRING,
        description: t("معرّف الفئة التي تحتوي التذاكر (parent_id للقنوات).", "Category ID where tickets are located (parent_id of the channels)."),
        default: "",
    },
    claimBotId: {
        type: OptionType.STRING,
        description: t("معرّف مستخدم البوت الذي يرسل الرسائل في التذاكر.", "User ID of the bot that sends messages in tickets."),
        default: "",
    },
    claimButtonIndex: {
        type: OptionType.SELECT,
        description: t("أيّ زرّ يُنقر تلقائياً.", "Which button to automatically click."),
        options: [
            { label: t("الزرّ الأول", "1st button"), value: 0, default: true },
            { label: t("الزرّ الثاني", "2nd button"), value: 1 },
            { label: t("الزرّ الثالث", "3rd button"), value: 2 },
            { label: t("الزرّ الرابع", "4th button"), value: 3 },
            { label: t("الزرّ الخامس", "5th button"), value: 4 },
        ],
    },
    safeMode: {
        type: OptionType.BOOLEAN,
        description: t("الوضع الآمن: انتظر 3–4 ثوانٍ قبل النقر (أقلّ إثارة للشبهة، يُنصح به في السيرفرات المشتركة).", "Safe Mode: wait 3–4 seconds before claiming (less suspicious, recommended for shared servers)."),
        default: false,
        restartNeeded: false,
    },
    claimCooldown: {
        type: OptionType.NUMBER,
        description: t("مهلة بين عمليات النقر بالثواني (0 = بلا مهلة).", "Cooldown between claims in seconds (0 = no cooldown)."),
        default: 0,
    },
});

// ── State ─────────────────────────────────────────────────────────────────────

let lastClaimTimestamp = 0;

/**
 * Channels known to be inside the ticket category.
 * Pre-populated from CHANNEL_CREATE to avoid the race where
 * the bot posts before ChannelStore has hydrated the new channel.
 */
const knownTicketChannels = new Set<string>();

/**
 * Message IDs we already processed so we never double-click
 * when both MESSAGE_CREATE and MESSAGE_UPDATE fire for the same message.
 */
const processedMessages = new Set<string>();

// ── Helpers ───────────────────────────────────────────────────────────────────

function isTicketChannel(channelId: string): boolean {
    if (knownTicketChannels.has(channelId)) return true;
    const channel = ChannelStore.getChannel(channelId);
    if (!channel) return false;
    const categoryId = settings.store.claimCategoryId?.trim();
    if (!categoryId) return false;
    if (channel.parent_id === categoryId) {
        knownTicketChannels.add(channelId);
        return true;
    }
    return false;
}

function getFlatButtons(message: any): any[] {
    const flat: any[] = [];
    for (const row of (message.components ?? [])) {
        for (const comp of (row.components ?? [])) {
            if (comp.type === 2) flat.push(comp); // type 2 = BUTTON
        }
    }
    return flat;
}

/** Discord-style snowflake nonce: (timestamp − discord_epoch) << 22 */
function generateNonce(): string {
    const DISCORD_EPOCH = 1420070400000n;
    return String((BigInt(Date.now()) - DISCORD_EPOCH) << 22n);
}

function delay(ms: number) {
    return new Promise<void>(r => setTimeout(r, ms));
}

// ── Core logic ────────────────────────────────────────────────────────────────

async function handleMessage(message: any) {
    if (!message || message.optimistic) return;

    const s = settings.store;
    if (!s.enableClaimTicket) return;

    const categoryId = s.claimCategoryId?.trim();
    const botId = s.claimBotId?.trim();
    if (!categoryId || !botId) return;

    // Only react to the configured bot
    if (message.author?.id !== botId) return;

    // Must have buttons already present
    const flatButtons = getFlatButtons(message);
    if (!flatButtons.length) return;

    // Deduplicate: lock immediately before any await so concurrent events don't slip through
    const msgKey = `${message.channel_id}:${message.id}`;
    if (processedMessages.has(msgKey)) return;
    processedMessages.add(msgKey);
    if (processedMessages.size > 200) {
        const [first] = processedMessages;
        processedMessages.delete(first);
    }

    // Safe mode: random delay 3–4 s. Otherwise: minimal 50 ms for ChannelStore hydration.
    const waitMs = s.safeMode
        ? 3000 + Math.floor(Math.random() * 1000)
        : 50;
    await delay(waitMs);

    if (!isTicketChannel(message.channel_id)) {
        logger.info(`Channel ${message.channel_id} not in category ${categoryId} — skipping.`);
        processedMessages.delete(msgKey);
        return;
    }

    // Cooldown
    const now = Date.now();
    const cooldownMs = (s.claimCooldown ?? 0) * 1000;
    if (cooldownMs > 0 && now - lastClaimTimestamp < cooldownMs) {
        logger.info("Cooldown active — skipping.");
        return;
    }

    const buttonIndex = s.claimButtonIndex ?? 0;
    const button = flatButtons[buttonIndex];
    if (!button) {
        logger.warn(`No button at index ${buttonIndex}. Available: ${flatButtons.map((b: any) => b.label).join(", ")}`);
        return;
    }

    const channel = ChannelStore.getChannel(message.channel_id);
    const guildId = channel?.guild_id ?? message.guild_id ?? null;
    const sessionId = AuthStore?.getSessionId?.() ?? "";

    logger.info(`Clicking "${button.label ?? button.custom_id}" in #${message.channel_id} ${s.safeMode ? `(safe mode, waited ${waitMs}ms)` : "(instant)"}`);

    try {
        const body: Record<string, any> = {
            type: 3,                    // MESSAGE_COMPONENT
            channel_id: message.channel_id,
            message_id: message.id,
            application_id: message.application_id ?? message.author?.id,
            session_id: sessionId,
            message_flags: message.flags ?? 0,
            data: {
                component_type: 2,      // BUTTON
                custom_id: button.custom_id,
            },
            nonce: generateNonce(),
        };

        // guild_id is required for guild channels; omit only for DMs
        if (guildId) body.guild_id = guildId;

        await RestAPI.post({ url: "/interactions", body });

        lastClaimTimestamp = Date.now();
        logger.info("✅ Claimed successfully.");
    } catch (e: any) {
        logger.error("❌ Failed:", e?.body ?? e?.message ?? e);
        processedMessages.delete(msgKey); // allow retry on next update
    }
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "AutoClaim",
    description: "Automatically claim tickets by clicking a button on the bot's first message in a ticket channel. ⚠️ Automating clicks is selfbot-like behaviour against Discord's Terms and can get your account banned — use at your own risk.",
    authors: [{ name: "Nightcord", id: 0n }],
    settings,
    settingsAboutComponent: AboutWarning,

    flux: {
        /** Pre-register the channel so we don't miss the first bot message. */
        CHANNEL_CREATE({ channel }: { channel: any; }) {
            const s = settings.store;
            if (!s.enableClaimTicket) return;
            const categoryId = s.claimCategoryId?.trim();
            if (!categoryId) return;
            if (channel?.parent_id === categoryId) {
                logger.info(`🎫 New ticket channel: #${channel.name} (${channel.id})`);
                knownTicketChannels.add(channel.id);
            }
        },

        /** Primary: bot sends embed with buttons on creation. */
        async MESSAGE_CREATE({ message }: { message: any; }) {
            await handleMessage(message);
        },

        /** Fallback: some bots edit their message to add buttons after creation. */
        async MESSAGE_UPDATE({ message }: { message: any; }) {
            await handleMessage(message);
        },
    },
});
