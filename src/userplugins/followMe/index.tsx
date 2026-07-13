/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addContextMenuPatch, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import { HeaderBarButton } from "@api/HeaderBar";
import * as DataStore from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { BanRiskWarning } from "@utils/esharqBanWarning";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { findStoreLazy } from "@webpack";
import { ChannelStore, Constants, Menu, PermissionsBits, PermissionStore, React, RestAPI, Toasts, useEffect, UserStore, useState } from "@webpack/common";

const VoiceStateStore = findStoreLazy("VoiceStateStore") as any;
const DS_KEY = "esharq-followMe-target";

let targetId: string | null = null;
let targetName = "";

const listeners = new Set<() => void>();
function notifyAll() { listeners.forEach(fn => fn()); }

function useTargetId(): string | null {
    const [, tick] = useState(0);
    useEffect(() => {
        const fn = () => tick(n => n + 1);
        listeners.add(fn);
        return () => { listeners.delete(fn); };
    }, []);
    return targetId;
}

function persist() {
    DataStore.set(DS_KEY, targetId ? { id: targetId, name: targetName } : null).catch(() => { });
}

async function moveTargetTo(guildId: string, channelId: string) {
    if (!targetId || !guildId || !channelId) return;
    const targetState = VoiceStateStore.getVoiceStateForUser(targetId);
    if (!targetState || targetState.channelId === channelId) return;

    const channel = ChannelStore.getChannel(channelId);
    if (!channel || !PermissionStore.can(PermissionsBits.MOVE_MEMBERS, channel)) return;

    try {
        await RestAPI.patch({
            url: Constants.Endpoints.GUILD_MEMBER(guildId, targetId),
            body: { channel_id: channelId }
        });
    } catch (e) {
        console.error("[FollowMe] Failed to move user:", e);
    }
}

function follow(userId: string) {
    if (targetId === userId) return;
    const user = UserStore.getUser(userId) as any;
    targetId = userId;
    targetName = user?.globalName ?? user?.username ?? userId;

    const myId = UserStore.getCurrentUser()?.id;
    const myState = VoiceStateStore.getVoiceStateForUser(myId);
    if (myState?.channelId && myState.guildId) moveTargetTo(myState.guildId, myState.channelId);

    notifyAll();
    persist();
    Toasts.show({ message: t(`يتبعك الآن: ${targetName}`, `Now following you: ${targetName}`), type: Toasts.Type.SUCCESS, id: Toasts.genId() });
}

function unfollow() {
    const name = targetName;
    targetId = null;
    targetName = "";
    notifyAll();
    persist();
    Toasts.show({ message: t(`تمّ إيقاف إجبار ${name} على المتابعة`, `Stopped forcing ${name} to follow`), type: Toasts.Type.MESSAGE, id: Toasts.genId() });
}

function StopIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#3ba55d">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
        </svg>
    );
}

function StopHeaderButton() {
    const tid = useTargetId();
    if (!tid) return null;
    return (
        <HeaderBarButton
            icon={StopIcon}
            tooltip={t(`إيقاف المتابعة: ${targetName}`, `Stop Follow Me: ${targetName}`)}
            onClick={unfollow}
        />
    );
}

const ctxPatch: NavContextMenuPatchCallback = (children, props) => {
    const userId: string | undefined = (props as any)?.user?.id;
    if (!Array.isArray(children) || !userId || userId === UserStore.getCurrentUser()?.id) return;

    const isFollowed = targetId === userId;
    children.push(
        <Menu.MenuCheckboxItem
            id="esharq-follow-me"
            label={isFollowed ? t("إيقاف المتابعة", "Stop Follow Me") : t("اجعله يتبعني", "Follow Me")}
            checked={isFollowed}
            action={() => isFollowed ? unfollow() : follow(userId)}
        />
    );
};

const settings = definePluginSettings({
    warning: {
        type: OptionType.COMPONENT,
        component: () => <BanRiskWarning
            ar="تحذير: نقل المستخدمين دون موافقتهم قد يخالف شروط خدمة Discord وقد يعرّض حسابك للحظر. يتطلّب صلاحية «نقل الأعضاء» في السيرفر. استخدمها بمسؤولية."
            en="Warning: moving users without their consent may violate Discord's Terms of Service and could get your account banned. Requires the Move Members permission. Use responsibly."
        />,
    },
});

export default definePlugin({
    name: "FollowMe",
    description: "Forces a user to follow you between voice channels when you have the Move Members permission. Right-click a user → Follow Me.",
    authors: [EquicordDevs.LOSTSTR],
    dependencies: ["HeaderBarAPI"],
    settings,

    headerBarButton: {
        icon: StopIcon,
        render: StopHeaderButton,
        priority: 6,
    },

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: any[]; }) {
            if (!targetId) return;
            const myId = UserStore.getCurrentUser()?.id;
            for (const s of voiceStates) {
                if (s.userId === myId) {
                    if (s.channelId && s.guildId) moveTargetTo(s.guildId, s.channelId);
                } else if (s.userId === targetId) {
                    const myState = VoiceStateStore.getVoiceStateForUser(myId);
                    if (myState?.channelId && myState.guildId && s.guildId === myState.guildId && s.channelId !== myState.channelId) {
                        moveTargetTo(myState.guildId, myState.channelId);
                    }
                }
            }
        }
    },

    async start() {
        const saved = await DataStore.get(DS_KEY) as { id: string; name: string; } | null;
        if (saved?.id) {
            targetId = saved.id;
            targetName = saved.name ?? saved.id;
        }
        addContextMenuPatch("user-context", ctxPatch);
        addContextMenuPatch("user-profile-actions", ctxPatch);
    },

    stop() {
        targetId = null;
        targetName = "";
        removeContextMenuPatch("user-context", ctxPatch);
        removeContextMenuPatch("user-profile-actions", ctxPatch);
    },
});
