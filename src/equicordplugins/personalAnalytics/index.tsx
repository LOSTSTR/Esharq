/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import * as DataStore from "@api/DataStore";
import { EquicordDevs } from "@utils/constants";
import { openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { VoiceState } from "@vencord/discord-types";
import { MessageStore, UserStore } from "@webpack/common";
import type { ComponentType } from "react";

import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { DayStats, DB_KEY, emptyDay, StatsDB, todayKey } from "./types";

interface MessageCreatePayload {
    message: {
        author: { id: string; };
        channel_id: string;
    };
}

interface ReactionAddPayload {
    userId: string;
    messageId: string;
    channelId: string;
}

let todayStats: DayStats = emptyDay();
let statsDate: string = todayKey();
let voiceJoinTime: number | undefined;
let saveTimer: ReturnType<typeof setInterval> | undefined;

function ensureToday(): DayStats {
    const today = todayKey();
    if (statsDate !== today) {
        const old = todayStats;
        const oldDate = statsDate;
        void DataStore.update<StatsDB>(DB_KEY, prev => ({ ...(prev ?? {}), [oldDate]: old }));
        todayStats = emptyDay();
        statsDate = today;
    }
    return todayStats;
}

async function persist(): Promise<void> {
    const stats = todayStats;
    const date = statsDate;
    await DataStore.update<StatsDB>(DB_KEY, prev => ({ ...(prev ?? {}), [date]: stats }));
}

function openDashboard(): void {
    openModal(props => <AnalyticsDashboard modalProps={props} />);
}

export default definePlugin({
    name: "PersonalAnalytics",
    description: "Tracks your personal Discord activity and shows a beautiful stats dashboard.",
    authors: [EquicordDevs.LOSTSTR],
    tags: ["Utility", "Activity"],

    toolboxActions: {
        "Open Analytics": openDashboard,
    },

    settingsAboutComponent: (() => (
        <div style={{ marginBottom: 8 }}>
            <button
                className="vc-personalanalytics-open-btn"
                onClick={openDashboard}
            >
                📊 Open Analytics Dashboard
            </button>
        </div>
    )) as ComponentType,

    flux: {
        MESSAGE_CREATE({ message }: MessageCreatePayload) {
            const me = UserStore.getCurrentUser();
            if (!me || message.author.id !== me.id) return;
            const day = ensureToday();
            day.messages++;
            day.channels[message.channel_id] = (day.channels[message.channel_id] ?? 0) + 1;
            day.hours[new Date().getHours()]++;
        },

        MESSAGE_REACTION_ADD({ userId, messageId, channelId }: ReactionAddPayload) {
            const me = UserStore.getCurrentUser();
            if (!me) return;
            const day = ensureToday();
            if (userId === me.id) day.reactionsGiven++;
            const msg = MessageStore.getMessages(channelId)?.get(messageId);
            if (msg?.author?.id === me.id && userId !== me.id) day.reactionsReceived++;
        },

        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const me = UserStore.getCurrentUser();
            if (!me) return;
            for (const state of voiceStates) {
                if (state.userId !== me.id) continue;
                const { channelId, oldChannelId } = state;
                if (!oldChannelId && channelId) {
                    voiceJoinTime = Date.now();
                } else if (oldChannelId && !channelId && voiceJoinTime !== undefined) {
                    ensureToday().voiceMs += Date.now() - voiceJoinTime;
                    voiceJoinTime = undefined;
                }
            }
        },
    },

    async start() {
        const db = await DataStore.get<StatsDB>(DB_KEY) ?? {};
        statsDate = todayKey();
        todayStats = db[statsDate] ?? emptyDay();
        saveTimer = setInterval(() => { void persist(); }, 60_000);
    },

    stop() {
        void persist();
        if (saveTimer !== undefined) {
            clearInterval(saveTimer);
            saveTimer = undefined;
        }
        if (voiceJoinTime !== undefined) {
            ensureToday().voiceMs += Date.now() - voiceJoinTime;
            voiceJoinTime = undefined;
        }
        todayStats = emptyDay();
    },
});
