/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { playAudio } from "@api/AudioPlayer";
import { type NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Notifications } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { getCurrentChannel } from "@utils/discord";
import { t } from "@utils/esharqI18n";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { ChannelActionCreators, ChannelStore, Menu, MessageStore, NavigationRouter, PresenceStore, UserStore, WindowStore } from "@webpack/common";
import { JSX } from "react";

interface IMessageCreate {
    channelId: string;
    guildId: string;
    message: Message;
}

const SILENT_PING_FLAG = 1 << 12;

function Icon(enabled?: boolean): JSX.Element {
    return <svg
        width="18"
        height="18"
    >
        <circle cx="9" cy="9" r="8" fill={!enabled ? "var(--status-danger)" : "currentColor"} />
        <circle cx="9" cy="9" r="3.75" fill={!enabled ? "white" : "black"} />
    </svg>;
}

function processIds(value: string): string {
    return value.replace(/\s/g, "").split(",").filter(id => id.trim() !== "").join(", ");
}

let cachedGuilds = ""; let guildsSet = new Set<string>();
let cachedChannels = ""; let channelsSet = new Set<string>();
let cachedUsers = ""; let usersSet = new Set<string>();

function parseIdSet(raw: string, cached: string, set: Set<string>): Set<string> {
    if (raw === cached) return set;
    return new Set(raw.split(", ").filter(Boolean));
}

function getBypassSets() {
    const { guilds, channels, users } = settings.plain;
    if (guilds !== cachedGuilds) { cachedGuilds = guilds; guildsSet = parseIdSet(guilds, "", guildsSet); }
    if (channels !== cachedChannels) { cachedChannels = channels; channelsSet = parseIdSet(channels, "", channelsSet); }
    if (users !== cachedUsers) { cachedUsers = users; usersSet = parseIdSet(users, "", usersSet); }
    return { guildsSet, channelsSet, usersSet };
}

async function showNotification(message: Message, guildId: string | undefined): Promise<void> {
    try {
        const channel = ChannelStore.getChannel(message.channel_id);
        const channelRegex = /<#(\d{19})>/g;
        const userRegex = /<@(\d{18})>/g;

        message.content = message.content.replace(channelRegex, (match: string, channelId: string) => {
            return `#${ChannelStore.getChannel(channelId)?.name}`;
        });

        message.content = message.content.replace(userRegex, (match: string, userId: string) => {
            const user = UserStore.getUser(userId);
            return `@${user?.globalName ?? user?.username ?? userId}`;
        });

        const authorName = message.author.globalName ?? message.author.username;
        await Notifications.showNotification({
            title: `${authorName} ${guildId ? `(#${channel?.name}, ${ChannelStore.getChannel(channel?.parent_id)?.name})` : ""}`,
            body: message.content,
            icon: UserStore.getUser(message.author.id).getAvatarURL(undefined, undefined, false),
            onClick: function (): void {
                NavigationRouter.transitionTo(`/channels/${guildId ?? "@me"}/${message.channel_id}/${message.id}`);
            }
        });

        if (settings.store.notificationSound) {
            playAudio("message1");
        }
    } catch (error) {
        new Logger("BypassStatus").error("Failed to notify user: ", error);
    }
}

function ContextCallback(name: "guild" | "user" | "channel"): NavContextMenuPatchCallback {
    return (children, props) => {
        const type = props[name];
        if (!type) return;
        const enabled = settings.store[`${name}s`].split(", ").includes(type.id);
        if (name === "user" && type.id === UserStore.getCurrentUser().id) return;
        children.splice(-1, 0, (
            <Menu.MenuGroup>
                <Menu.MenuItem
                    id={`status-${name}-bypass`}
                    label={`${enabled ? "Remove" : "Add"} Status Bypass`}
                    icon={() => Icon(enabled)}
                    action={() => {
                        let bypasses: string[] = settings.store[`${name}s`].split(", ");
                        if (enabled) bypasses = bypasses.filter(id => id !== type.id);
                        else bypasses.push(type.id);
                        settings.store[`${name}s`] = bypasses.filter(id => id.trim() !== "").join(", ");
                    }}
                />
            </Menu.MenuGroup>
        ));
    };
}

const settings = definePluginSettings({
    guilds: {
        type: OptionType.STRING,
        description: "Servers allowed to bypass (notified when mentioned anywhere in the server)",
        default: "",
        placeholder: t("افصل بفواصل", "Separate with commas"),
        onChange: value => settings.store.guilds = processIds(value)
    },
    channels: {
        type: OptionType.STRING,
        description: "Channels allowed to bypass (notified when mentioned in that channel)",
        default: "",
        placeholder: t("افصل بفواصل", "Separate with commas"),
        onChange: value => settings.store.channels = processIds(value)
    },
    users: {
        type: OptionType.STRING,
        description: "Users allowed to bypass (notified of all their direct messages)",
        default: "",
        placeholder: t("افصل بفواصل", "Separate with commas"),
        onChange: value => settings.store.users = processIds(value)
    },
    allowOutsideOfDms: {
        type: OptionType.BOOLEAN,
        description: "Allow selected users to bypass outside of DMs too (acts as a channel/server bypass for all messages from selected users)"
    },
    notificationSound: {
        type: OptionType.BOOLEAN,
        description: "Whether the notification sound will play",
        default: true,
    },
    respectSilentPings: {
        type: OptionType.BOOLEAN,
        description: "Respect silent pings (@silent / suppressed notifications)",
        default: true
    },
    statusToUse: {
        type: OptionType.SELECT,
        description: "The status used to activate the whitelist",
        options: [
            {
                label: t("متصل", "Online"),
                value: "online",
            },
            {
                label: t("بعيد", "Idle"),
                value: "idle",
            },
            {
                label: t("لا تزعجني", "Do Not Disturb"),
                value: "dnd",
                default: true
            },
            {
                label: t("غير مرئي", "Invisible"),
                value: "invisible",
            }
        ]
    }
});

export default definePlugin({
    name: "BypassStatus",
    description: "Continue receiving notifications from specific sources even in Do Not Disturb. Right-click users/channels/servers to configure them to bypass DND.",
    tags: ["Activity", "Customisation", "Notifications", "Servers"],
    authors: [Devs.Inbestigator],
    dependencies: ["AudioPlayerAPI"],
    flux: {
        async MESSAGE_CREATE({ message, guildId, channelId }: IMessageCreate): Promise<void> {
            try {
                const currentUser = UserStore.getCurrentUser();
                const userStatus = await PresenceStore.getStatus(currentUser.id);
                const currentChannelId = getCurrentChannel()?.id ?? "0";
                if (message.state === "SENDING" || message.content === "" || message.author.id === currentUser.id || (channelId === currentChannelId && WindowStore.isFocused()) || userStatus !== settings.store.statusToUse) {
                    return;
                }
                if (settings.store.respectSilentPings && (message.flags & SILENT_PING_FLAG)) { return; }
                const mentioned = MessageStore.getMessage(channelId, message.id)?.mentioned;
                const { guildsSet: gs, channelsSet: cs, usersSet: us } = getBypassSets();
                if ((gs.has(guildId) || cs.has(channelId)) && mentioned) {
                    await showNotification(message, guildId);
                } else if (us.has(message.author.id)) {
                    const userChannelId = await ChannelActionCreators.getOrEnsurePrivateChannel(message.author.id);
                    if (channelId === userChannelId || (mentioned && settings.store.allowOutsideOfDms === true)) {
                        await showNotification(message, guildId);
                    }
                }
            } catch (error) {
                new Logger("BypassStatus").error("Failed to handle message: ", error);
            }
        }
    },
    settings,
    contextMenus: {
        "guild-context": ContextCallback("guild"),
        "channel-context": ContextCallback("channel"),
        "user-context": ContextCallback("user"),
    }
});
