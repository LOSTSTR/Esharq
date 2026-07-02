/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Menu, RestAPI, SelectedChannelStore, Toasts, UserStore, VoiceStateStore } from "@webpack/common";

const ChannelActions = findByPropsLazy("selectVoiceChannel", "disconnect");

// A single voice-state entry as it arrives on the VOICE_STATE_UPDATES flux event.
interface VoiceState {
    userId: string;
    channelId?: string | null;
    guildId?: string;
    deaf: boolean;
    mute: boolean;
}

let pinnedChannelId: string | null = null;
let lastChannelId: string | null = null;
let busy = false;
let lastActionAt = 0;
const DEBOUNCE = 1500;

const settings = definePluginSettings({
    autoReconnect: {
        type: OptionType.BOOLEAN,
        description: "Automatically rejoin the pinned channel if you get disconnected.",
        default: true
    },
    autoUndeafen: {
        type: OptionType.BOOLEAN,
        description: "Automatically undo a server deafen.",
        default: true
    },
    autoUnmute: {
        type: OptionType.BOOLEAN,
        description: "Automatically undo a server mute.",
        default: true
    },
    stayInChannel: {
        type: OptionType.BOOLEAN,
        description: "Jump back to the pinned channel if you get moved.",
        default: true
    },
    cooldown: {
        type: OptionType.SLIDER,
        description: "Cooldown between actions (seconds), to avoid fighting the server in a loop.",
        default: 1,
        markers: [0.5, 1, 1.5, 2, 3]
    }
});

function toast(message: string, ok = true) {
    Toasts.show({ id: Toasts.genId(), message, type: ok ? Toasts.Type.SUCCESS : Toasts.Type.FAILURE });
}

function startCooldown() {
    busy = true;
    setTimeout(() => { busy = false; }, settings.store.cooldown * 1000);
}

function undoServerState(guildId: string, myId: string, key: "deaf" | "mute") {
    RestAPI.patch({ url: `/guilds/${guildId}/members/${myId}`, body: { [key]: false } });
}

function handleVoiceStateUpdate(voiceStates: VoiceState[]) {
    if (busy) return;

    const myId = UserStore.getCurrentUser()?.id;
    if (!myId) return;
    const mine = voiceStates.find(s => s.userId === myId);
    const now = Date.now();

    // Disconnected → rejoin the pinned channel.
    if (!mine) {
        if (settings.store.autoReconnect && lastChannelId && pinnedChannelId === lastChannelId && now - lastActionAt > DEBOUNCE) {
            const inChannel = VoiceStateStore.getVoiceStatesForChannel(lastChannelId);
            if (!inChannel || !(myId in inChannel)) {
                lastActionAt = now;
                ChannelActions.selectVoiceChannel(lastChannelId);
                toast(t("أُعيد الاتصال بالقناة المثبّتة.", "Reconnected to the pinned channel."));
                startCooldown();
            }
        }
        return;
    }

    // Moved away from the pinned channel → jump back.
    if (settings.store.stayInChannel && pinnedChannelId && mine.channelId !== pinnedChannelId) {
        ChannelActions.selectVoiceChannel(pinnedChannelId);
        toast(t("أنت مثبّت في هذه القناة.", "You're pinned to this channel."), false);
        startCooldown();
        return;
    }

    if (settings.store.autoUndeafen && mine.deaf && mine.guildId) {
        undoServerState(mine.guildId, myId, "deaf");
        toast(t("أُلغِي كتم السماع تلقائياً.", "Automatically undeafened."));
        startCooldown();
    }

    if (settings.store.autoUnmute && mine.mute && mine.guildId) {
        undoServerState(mine.guildId, myId, "mute");
        toast(t("أُلغِي الكتم تلقائياً.", "Automatically unmuted."));
        startCooldown();
    }

    lastChannelId = mine.channelId ?? null;
    lastActionAt = now;
}

function pinChannelContextMenu(children: any, { channel }: { channel: { id: string; name: string; type: number; }; }) {
    if (!channel || channel.type !== 2) return; // 2 = guild voice channel

    const pinned = pinnedChannelId === channel.id;
    children.push(
        <Menu.MenuItem
            id="voiceguard-pin"
            label={pinned ? t("إلغاء تثبيت القناة", "Unpin channel") : t("تثبيت القناة", "Pin channel")}
            action={() => {
                pinnedChannelId = pinned ? null : channel.id;
                toast(pinnedChannelId ? t(`تم تثبيت: ${channel.name}`, `Pinned: ${channel.name}`) : t("أُلغي التثبيت", "Channel unpinned"));
            }}
        />
    );
}

export default definePlugin({
    name: "VoiceGuard",
    description: "Resist server voice moderation: auto-rejoin, auto-unmute/undeafen, and stay in a pinned channel if moved. ⚠️ May violate Discord ToS. Use at your own risk — Esharq disclaims all liability.",
    authors: [EquicordDevs.LOSTSTR],
    settings,

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            handleVoiceStateUpdate(voiceStates);
        }
    },

    contextMenus: {
        "channel-context": pinChannelContextMenu
    },

    start() {
        lastChannelId = SelectedChannelStore.getVoiceChannelId() ?? null;
    },

    stop() {
        pinnedChannelId = null;
        lastChannelId = null;
        busy = false;
        lastActionAt = 0;
    }
});
