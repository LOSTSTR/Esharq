/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { showNotification } from "@api/Notifications";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import {
    Menu,
    React,
    VoiceStateStore,
    RestAPI,
    SelectedGuildStore,
    Constants,
} from "@webpack/common";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { User, VoiceState } from "@vencord/discord-types";


type TLeashedUserInfo = {
    userId: string;
    lastChannelId: string | null;
} | null;

interface UserContextProps {
    channel: any;
    user: User;
    guildId?: string;
}

let leashedUserInfo: TLeashedUserInfo = null;
let myLastChannelId: string | null = null;

const ChannelActions = findByPropsLazy("selectChannel", "selectVoiceChannel");
const UserStore = findStoreLazy("UserStore");
const SelectedChannelStore = findStoreLazy("SelectedChannelStore");

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Enable the Leash plugin",
    },
    onlyWhenInVoice: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Only move the user when you are in a voice channel",
    },
    showNotifications: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show notifications when moves occur",
    },
});

// Function to move a user to a voice channel
async function moveUserToVoiceChannel(
    userId: string,
    channelId: string
): Promise<void> {
    const guildId = SelectedGuildStore.getGuildId();
    if (!guildId) {
        throw new Error("No server selected");
    }

    try {
        // Use Discord API to move the user
        await RestAPI.patch({
            url: Constants.Endpoints.GUILD_MEMBER(guildId, userId),
            body: {
                channel_id: channelId,
            },
        });

        if (settings.store.showNotifications) {
            const user = UserStore.getUser(userId);
            showNotification({
                title: t("Leash - نجاح", "Leash - Success"),
                body: t(`تم نقل ${user?.username || "المستخدم"} إلى قناتك الصوتية`, `${user?.username || "User"} has been moved to your voice channel`),
            });
        }
    } catch (error) {
        console.error("Leash: Discord API error:", error);
        throw error;
    }
}

const UserContextMenuPatch: NavContextMenuPatchCallback = (
    children,
    { channel, user }: UserContextProps
) => {
    if (UserStore.getCurrentUser().id === user.id) return;

    const [checked, setChecked] = React.useState(
        leashedUserInfo?.userId === user.id
    );

    children.push(
        <Menu.MenuSeparator />,
        <Menu.MenuCheckboxItem
            id="laisse-leash-user"
            label={t("Leash - اربط المستخدم", "Leash - Hook the user")}
            checked={checked}
            action={() => {
                if (leashedUserInfo?.userId === user.id) {
                    leashedUserInfo = null;
                    setChecked(false);
                    showNotification({
                        title: "Leash",
                        body: t(`لم يعُد المستخدم ${user.username} مربوطاً`, `User ${user.username} is no longer hooked`),
                    });
                    return;
                }

                leashedUserInfo = {
                    userId: user.id,
                    lastChannelId: null,
                };
                setChecked(true);
                showNotification({
                    title: "Leash",
                    body: t(`المستخدم ${user.username} مربوط بك الآن`, `User ${user.username} is now hooked to you`),
                });
            }}
        />
    );
};

export default definePlugin({
    name: "Leash",
    description: "Leashes a user to you by automatically moving them to whatever voice channel you join.\n\n⚠️ WARNING: Moving users to voice channels without their consent may violate Discord's Terms of Service and community guidelines. This feature requires server moderation permissions. Use responsibly.",
    tags: ["Utility"],
    authors: [{ name: "x2b", id: 0n }],
    settingsAboutComponent: () => (
        <div style={{
            color: "var(--text-danger)",
            border: "1px solid var(--text-danger)",
            borderRadius: 6,
            padding: "10px 12px",
            margin: "8px 0",
            fontWeight: 600
        }}>
            {t("⚠️ تحذير: نقل المستخدمين دون موافقتهم قد يخالف شروط خدمة Discord. تتطلب صلاحيات إشراف في السيرفر. استخدمها بمسؤولية.", "⚠️ WARNING: Moving users without their consent may violate Discord's Terms of Service. Requires server moderation permissions. Use responsibly.")}
        </div>
    ),
    settings,
    contextMenus: {
        "user-context": UserContextMenuPatch,
    },
    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            if (!leashedUserInfo || !settings.store.enabled) return;

            const myId = UserStore.getCurrentUser().id;
            const myCurrentChannelId = SelectedChannelStore.getVoiceChannelId();

            // Check if we should only act when in voice
            if (settings.store.onlyWhenInVoice && !myCurrentChannelId) return;

            for (const voiceState of voiceStates) {
                // Detect when current user changes voice channel
                if (
                    voiceState.userId === myId &&
                    voiceState.channelId !== myLastChannelId
                ) {
                    myLastChannelId = voiceState.channelId ?? null;

                    // If we have a hooked user and we join a voice channel
                    if (voiceState.channelId && leashedUserInfo.userId) {
                        const leashedUserVoiceState = VoiceStateStore.getVoiceStateForUser(
                            leashedUserInfo.userId
                        );

                        // If the hooked user is in a different voice channel
                        if (
                            leashedUserVoiceState &&
                            leashedUserVoiceState.channelId !== voiceState.channelId
                        ) {
                            try {
                                // Try to move the hooked user to our channel
                                // Note: This feature requires moderation permissions
                                const user = UserStore.getUser(leashedUserInfo.userId);

                                if (settings.store.showNotifications) {
                                    showNotification({
                                        title: "Leash",
                                        body: t(`محاولة نقل ${user?.username || "المستخدم"} إلى قناتك الصوتية`, `Attempting to move ${user?.username || "user"} to your voice channel`),
                                    });
                                }

                                // Use Discord API to move the user
                                await moveUserToVoiceChannel(
                                    leashedUserInfo.userId,
                                    voiceState.channelId
                                );
                            } catch (error) {
                                console.error("Leash: Error during move:", error);
                                if (settings.store.showNotifications) {
                                    showNotification({
                                        title: t("Leash - خطأ", "Leash - Error"),
                                        body: t("تعذّر نقل المستخدم (صلاحيات غير كافية)", "Unable to move user (insufficient permissions)"),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        },
    },
    start() {
        myLastChannelId = SelectedChannelStore.getVoiceChannelId();
    },
    stop() {
        leashedUserInfo = null;
        myLastChannelId = null;
    },
});





