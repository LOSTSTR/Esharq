/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { DataStore } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { t } from "@utils/esharqI18n";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import type { Message, User } from "@vencord/discord-types";
import { ChannelStore, GuildStore, Menu } from "@webpack/common";

import * as activity from "./activity";
import * as status from "./status";
import * as voice from "./voice";

export const logger = new Logger("Stalker");

// Logs live in DataStore (IndexedDB), one entry per stalked user per day — the same
// daily rollover the old native file layout used, without a native module or disk files.
const LOG_PREFIX = "stalker-log-";
const logKey = (userId: string) => `${LOG_PREFIX}${userId}-${getTodayDate()}`;

async function exportAllLogs() {
    try {
        const keys = (await DataStore.keys()).filter((k): k is string => typeof k === "string" && k.startsWith(LOG_PREFIX));
        const dump: Record<string, unknown> = {};
        for (const k of keys) dump[k] = await DataStore.get(k);
        const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `stalker-logs-${getTodayDate()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        logger.error("Failed to export stalker logs:", error);
    }
}

function OpenStalkingFolderButton() {
    return (
        <Button onClick={exportAllLogs}>
            {t("تصدير كل سجلّات المراقبة (JSON)", "Export all stalking logs (JSON)")}
        </Button>
    );
}

export interface StalkerLogEntry {
    timestamp: string;
    userId: string;
    username: string;
    action: "activity_start" | "activity_stop" | "activity_update" | "client_status_change" | "custom_status_change" | "message_send" | "status_change" | "voice_join" | "voice_leave" | "voice_update";
    details: string;
    channelName?: string;
    guildName?: string;
    metadata?: Record<string, string | number | boolean | null>;
}

// Cache separata per ogni utente: userId -> { logs, date }
// La "date" serve a invalidare la cache quando cambia il giorno
interface UserLogCache {
    logs: StalkerLogEntry[];
    date: string; // formato YYYY-MM-DD
}

const cachedLogsPerUser = new Map<string, UserLogCache>();

// Coda di scrittura per evitare race conditions: userId -> Promise
const writeLocks = new Map<string, Promise<void>>();

function getTodayDate(): string {
    return new Date().toISOString().slice(0, 10);
}

async function getLogsFromFile(userId: string, _username: string): Promise<StalkerLogEntry[]> {
    try {
        const logs = await DataStore.get<StalkerLogEntry[]>(logKey(userId));
        return Array.isArray(logs) ? logs : [];
    } catch (error) {
        logger.error(`Failed to read stalker log for user ${userId}, starting fresh:`, error);
        return [];
    }
}

function getCacheForUser(userId: string): UserLogCache | undefined {
    const cache = cachedLogsPerUser.get(userId);
    // Invalida la cache se il giorno è cambiato
    if (cache && cache.date !== getTodayDate()) {
        cachedLogsPerUser.delete(userId);
        return undefined;
    }
    return cache;
}

export async function logStalkerEvent(entry: StalkerLogEntry) {
    if (!settings.store.enableLogging) return;

    // Serialize writes per user to avoid races
    const previousLock = writeLocks.get(entry.userId) ?? Promise.resolve();

    const newLock = previousLock.then(async () => {
        try {
            let cache = getCacheForUser(entry.userId);

            if (!cache) {
                const logs = await getLogsFromFile(entry.userId, entry.username);
                cache = { logs, date: getTodayDate() };
                cachedLogsPerUser.set(entry.userId, cache);
            }

            cache.logs.push(entry);

            await DataStore.set(logKey(entry.userId), cache.logs);
        } catch (error) {
            logger.error("Failed to write stalker log:", error);
        }
    });

    writeLocks.set(entry.userId, newLock);
    await newLock;
}

export let targets: string[] = [];

const parseTargets = (parse: string): string[] => {
    const regex = /\s*(,?)\s*([0-9]+)/g;
    const matches = [...parse.matchAll(regex)].map(match => match.at(match.length - 1) as string);
    targets = matches;
    return matches;
};

export const settings = definePluginSettings({
    stalkContext: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Adds an option on the user context menu that enables stalking for users."
    },

    notifyCallJoin: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Send a notification when a user joins a voice channel.",
    },

    notifyCallLeave: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Send a notification when a user leaves a voice channel.",
    },

    notifyOffline: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Send a notification when a user goes offline."
    },

    notifyOnline: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Send a notification when a user goes online.",
    },

    notifyDnd: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Send a notification when a user goes on Do Not Disturb.",
    },

    notifyIdle: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Send a notification when a user goes idle.",
    },

    notifyGoOnline: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Send a notification when a user logs onto Discord or leaves invisible, regardless of the 4 above options."
    },

    enableLogging: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Enable logging of stalker events to local storage."
    },

    openStalkingFolder: {
        type: OptionType.COMPONENT,
        description: "Export all stalking logs as a JSON file.",
        component: OpenStalkingFolderButton,
    },

    logMessages: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Log when a user sends a message in any channel."
    },

    logMessagePreview: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Include message previews in local message logs."
    },

    logActivities: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Log when a user starts, stops, or changes an activity."
    },

    notifyActivities: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Send a notification when a user starts an activity."
    },

    logCustomStatus: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Log custom status changes."
    },

    logClientStatus: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Log whether a user is online from desktop, mobile, or web."
    },

    logVoiceStateChanges: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Log voice state changes like mute, deaf, video, and streaming."
    },

    targets: {
        type: OptionType.STRING,
        placeholder: "1234,5678",
        description: "List of user IDs to stalk, separate with a comma.",
        default: "",
        onChange: parseTargets,
    },
});

interface UserContextProps {
    user?: User;
}

const patchUserContext: NavContextMenuPatchCallback = (children, { user }: UserContextProps) => {
    if (!settings.store.stalkContext || !user) return;

    const stalked = targets.includes(user.id);
    const group = findGroupChildrenByChildId("apps", children) ?? children;
    let id = group.findLastIndex(child => child?.props?.id && child.props.id === "ignore");
    if (id < 0) id = group.length - 1;

    group.splice(id, 0,
        <Menu.MenuItem
            id="vc-st-stalk"
            label={stalked ? t("إلغاء المراقبة", "Unstalk") : t("مراقبة", "Stalk")}
            action={() => {
                const currentTargets = new Set(parseTargets(settings.store.targets));

                if (stalked) {
                    currentTargets.delete(user.id);
                    cachedLogsPerUser.delete(user.id);
                    writeLocks.delete(user.id);
                } else {
                    currentTargets.add(user.id);
                }

                settings.store.targets = [...currentTargets].join(",");
                parseTargets(settings.store.targets);
            }}
        />
    );
};

function AboutWarning() {
    return (
        <div style={{
            border: "1px solid #ed4245", borderRadius: 8, padding: "12px 14px", marginBottom: 12,
            background: "rgba(237, 66, 69, 0.1)", color: "var(--text-normal, #dbdee1)", fontSize: 13, lineHeight: 1.6
        }}>
            ⚠️ {t(
                "تحذير خصوصية: هذه الإضافة تراقب شخصاً محدَّداً وتسجّل حالته ونشاطه وحركته الصوتية ورسائله في تخزين جهازك المحلي. راقبة شخص دون علمه قد تنتهك خصوصيته وشروط ديسكورد وقوانين بلدك. البيانات تبقى على جهازك ولا تُرسَل لأحد، لكن استخدم هذه الأداة على مسؤوليتك الأخلاقية والقانونية الكاملة.",
                "Privacy warning: this plugin monitors a specific person and logs their status, activity, voice movements and messages to your device's local storage. Watching someone without their knowledge may violate their privacy, Discord's Terms and your local laws. The data stays on your device and is sent to no one, but use this tool entirely at your own ethical and legal responsibility."
            )}
        </div>
    );
}

export default definePlugin({
    name: "Stalker",
    description: "Notifies you whenever a person does something.",
    tags: ["Friends", "Utility"],
    settingsAboutComponent: AboutWarning,
    authors: [
        { name: "Reycko", id: 1123725368004726794n },
        { name: "irritably", id: 928787166916640838n }
    ],

    contextMenus: {
        "user-context": patchUserContext,
    },

    start() {
        parseTargets(settings.store.targets);
        status.init();
        voice.init();
        activity.init();
    },

    stop() {
        activity.deinit();
        status.deinit();
        voice.deinit();
        cachedLogsPerUser.clear();
        writeLocks.clear();
    },

    flux: {
        MESSAGE_CREATE({ message }: { message: Message; }) {
            if (!settings.store.logMessages) return;
            if (!targets.includes(message.author.id)) return;

            const channel = ChannelStore.getChannel(message.channel_id);
            const guild = channel?.guild_id ? GuildStore.getGuild(channel.guild_id) : null;
            const preview = settings.store.logMessagePreview
                ? message.content.length > 100
                    ? `${message.content.substring(0, 100)}...`
                    : message.content
                : null;

            logStalkerEvent({
                timestamp: new Date().toISOString(),
                userId: message.author.id,
                username: message.author.username,
                action: "message_send",
                details: preview ? `Sent message: ${preview}` : "Sent a message.",
                channelName: channel?.name,
                guildName: guild?.name,
                metadata: {
                    channelId: message.channel_id,
                    guildId: channel?.guild_id ?? null,
                    messageId: message.id,
                    hasContent: message.content.length > 0
                }
            });
        },
    },

    settings,
});
