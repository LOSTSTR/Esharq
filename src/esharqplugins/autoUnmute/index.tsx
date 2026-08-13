/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { BanRiskWarning } from "@utils/esharqBanWarning";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { ChannelStore, Constants, PermissionsBits, PermissionStore, RestAPI, UserStore } from "@webpack/common";
import { Logger } from "@utils/Logger";

const logger = new Logger("AutoUnmute");

const VoiceStateStore = findStoreLazy("VoiceStateStore") as any;
const VoiceActions = findByPropsLazy("toggleSelfMute");

interface VoiceState {
    userId: string;
    channelId?: string;
    guildId?: string;
    deaf: boolean;
    mute: boolean;
    selfDeaf: boolean;
    selfMute: boolean;
}

const settings = definePluginSettings({
    warning: {
        type: OptionType.COMPONENT,
        component: () => <BanRiskWarning
            ar="تحذير: التراجع تلقائياً عن كتم/إصمّ السيرفر لك = مقاومة رقابة السيرفر، وقد يخالف قواعده أو شروط خدمة Discord ويعرّض حسابك للطرد/الحظر. يتطلّب صلاحية «كتم/إصمّ الأعضاء». استخدمها بمسؤولية."
            en="Warning: automatically reverting a server mute/deafen bypasses server moderation and may violate server rules or Discord's Terms of Service, risking a kick/ban. Requires the Mute/Deafen Members permission. Use responsibly."
        />,
    },
});

async function patchSelf(userId: string, guildId: string, body: Record<string, boolean>) {
    await RestAPI.patch({ url: Constants.Endpoints.GUILD_MEMBER(guildId, userId), body });
}

export default definePlugin({
    name: "AutoUnmute",
    description: "Automatically unmutes and undeafens you when you are server-muted/deafened, if you have permission.",
    authors: [{ name: "Bash", id: 1327483363518582784n }],
    settings,

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const me = UserStore.getCurrentUser();
            if (!me) return;

            for (const state of voiceStates) {
                const { userId, channelId, guildId, mute, selfMute, deaf, selfDeaf } = state;
                if (userId !== me.id || !channelId || !guildId) continue;

                const channel = ChannelStore.getChannel(channelId);
                if (!channel) continue;

                if (mute && !selfMute && PermissionStore.can(PermissionsBits.MUTE_MEMBERS, channel)) {
                    setTimeout(async () => {
                        try { await patchSelf(me.id, guildId, { mute: false }); }
                        catch { try { VoiceActions.toggleSelfMute(); } catch (err) { logger.debug("Ignored error", err); } }
                    }, 100);
                }

                if (deaf && !selfDeaf && PermissionStore.can(PermissionsBits.DEAFEN_MEMBERS, channel)) {
                    setTimeout(async () => {
                        try { await patchSelf(me.id, guildId, { deaf: false }); }
                        catch { try { VoiceActions.toggleSelfDeaf(); } catch (err) { logger.debug("Ignored error", err); } }
                    }, 100);
                }
            }
        }
    },
});
