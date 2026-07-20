/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addContextMenuPatch, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import { HeaderBarButton } from "@api/HeaderBar";
import { DataStore } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { Menu, React, Toasts, useEffect,useState } from "@webpack/common";
import { Logger } from "@utils/Logger";

const logger = new Logger("FollowUser");

const VoiceStateStore = findStoreLazy("VoiceStateStore");
const ChannelStore = findStoreLazy("ChannelStore");
const UserStore = findStoreLazy("UserStore");
const FluxDispatcher = findByPropsLazy("dispatch", "subscribe");

const DS_KEY = "followuser-v2";

const settings = definePluginSettings({
    autoStopMinutes: {
        type: OptionType.SELECT,
        description: "Stop following automatically after this long without the user moving channels",
        options: [
            { label: "After 30 minutes", value: 30, default: true },
            { label: "Never — keep following until I stop it myself", value: 0 },
        ],
        // Re-arm (or cancel) straight away instead of waiting for the next move.
        onChange: () => { if (followedId) resetInactivityTimer(); },
    },
    onlyWhenInVoice: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Only auto-join when you are already in a voice channel",
    },
    leaveWhenUserLeaves: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Leave the voice channel when the followed user leaves",
    },
    pauseWhileStreaming: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Don't auto-join while you're screen-sharing or on camera, so following can't yank you out of your own stream (you can still rejoin manually with the header button)",
    },
    notifyOnAutoJoin: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show a small toast when you're automatically moved into the followed user's channel",
    },
});

function amIInVoice(): boolean {
    try {
        const myId = UserStore?.getCurrentUser?.()?.id;
        return !!(myId && VoiceStateStore?.getVoiceStateForUser?.(myId)?.channelId);
    } catch { return false; }
}

// selfStream = screen-sharing, selfVideo = camera. Field names verified against
// the same fields used by randomVoice / voiceChannelLog, not guessed.
function amIStreaming(): boolean {
    try {
        const myId = UserStore?.getCurrentUser?.()?.id;
        if (!myId) return false;
        const vs = VoiceStateStore?.getVoiceStateForUser?.(myId);
        return !!(vs?.selfStream || vs?.selfVideo);
    } catch { return false; }
}

// ── Etat global ───────────────────────────────────────────────────────────────
let followedId: string | null = null;
let followedName: string = "";
let followedChannel: string | null = null;
let fluxUnsub: (() => void) | null = null;
let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<() => void>();
function notifyAll() { listeners.forEach(fn => fn()); }

export function useFollowId(): string | null {
    const [, tick] = useState(0);
    useEffect(() => {
        const fn = () => tick(n => n + 1);
        listeners.add(fn);
        return () => { listeners.delete(fn); };
    }, []);
    return followedId;
}

async function persist() {
    await DataStore.set(DS_KEY, followedId ? { id: followedId, name: followedName } : null);
}

function getChannelOf(userId: string): string | null {
    try {
        const all: any = VoiceStateStore?.getAllVoiceStates?.() ?? {};
        for (const guildMap of Object.values(all) as any[]) {
            if (guildMap?.[userId]?.channelId) return guildMap[userId].channelId;
        }
        return VoiceStateStore?.getVoiceStateForUser?.(userId)?.channelId ?? null;
    } catch { return null; }
}

function joinChannel(channelId: string) {
    try {
        const ch = ChannelStore?.getChannel?.(channelId);
        // Utilisation de setTimeout pour eviter de dispatch pendant un cycle de dispatch de Discord
        // ce qui cause le "dispatch during dispatch" error et fait crash/refresh le client
        setTimeout(() => {
            FluxDispatcher?.dispatch?.({
                type: "VOICE_CHANNEL_SELECT",
                channelId,
                guildId: ch?.guild_id ?? null,
            });
        }, 100);
    } catch (err) { logger.debug("Ignored error", err); }
}

// ── Timer d'inactivite : unfollow auto apres X min sans utilisation ───────────
// autoStopMinutes = 0 means "never" — no timer is armed at all.
function resetInactivityTimer() {
    clearInactivityTimer();
    const minutes = settings.store.autoStopMinutes;
    if (!minutes) return;
    inactivityTimer = setTimeout(() => {
        if (followedId) {
            Toasts.show({ message: t(`خمول ${minutes} دقيقة — إيقاف متابعة ${followedName}`, `Inactive for ${minutes}min — stopped following ${followedName}`), type: Toasts.Type.FAILURE, id: Toasts.genId() });
            unfollow();
        }
    }, minutes * 60 * 1000);
}

function clearInactivityTimer() {
    if (inactivityTimer) { clearTimeout(inactivityTimer); inactivityTimer = null; }
}

// ── Listener voix ─────────────────────────────────────────────────────────────
function leaveChannel() {
    try {
        setTimeout(() => {
            FluxDispatcher?.dispatch?.({ type: "VOICE_CHANNEL_SELECT", channelId: null, guildId: null });
        }, 100);
    } catch (err) { logger.debug("Ignored error", err); }
}

function onVoiceStateUpdates(data: any) {
    if (!followedId) return;
    const states: any[] = Array.isArray(data?.voiceStates) ? data.voiceStates
        : data?.voiceStates != null ? Array.from(data.voiceStates as any) : [];
    for (const s of states) {
        if (s.userId !== followedId) continue;
        const newCh: string | null = s.channelId ?? null;
        if (newCh !== followedChannel) {
            const prevCh = followedChannel;
            followedChannel = newCh;
            if (newCh) {
                // onlyWhenInVoice: don't auto-join unless we're already connected to voice
                if (settings.store.onlyWhenInVoice && !amIInVoice()) continue;
                // pauseWhileStreaming: never yank you out of your own stream/camera.
                // Checked before resetInactivityTimer so a skipped move doesn't re-arm it.
                if (settings.store.pauseWhileStreaming && amIStreaming()) continue;
                resetInactivityTimer(); // activite detectee, on repart pour 30min
                joinChannel(newCh);
                if (settings.store.notifyOnAutoJoin) {
                    Toasts.show({ message: t(`انتقلت مع ${followedName}`, `Moved with ${followedName}`), type: Toasts.Type.MESSAGE, id: Toasts.genId() });
                }
            } else if (settings.store.leaveWhenUserLeaves && prevCh) {
                // followed user left voice → leave too
                leaveChannel();
            }
        }
    }
}

function startFlux() {
    if (fluxUnsub) return;
    FluxDispatcher?.subscribe?.("VOICE_STATE_UPDATES", onVoiceStateUpdates);
    fluxUnsub = () => FluxDispatcher?.unsubscribe?.("VOICE_STATE_UPDATES", onVoiceStateUpdates);
}
function stopFlux() { fluxUnsub?.(); fluxUnsub = null; }

// ── Follow / Unfollow ─────────────────────────────────────────────────────────
export async function follow(userId: string) {
    const user = UserStore?.getUser?.(userId);
    const name = user?.globalName ?? user?.username ?? userId;

    // Si on followait deja quelqu'un d'autre, unfollow silencieux
    if (followedId && followedId !== userId) {
        stopFlux();
        clearInactivityTimer();
    }

    followedId = userId;
    followedName = name;
    followedChannel = getChannelOf(userId);

    await persist();
    startFlux();
    resetInactivityTimer();
    notifyAll();

    // Rejoindre immediatement son vocal si il est deja dans un channel
    if (followedChannel) {
        joinChannel(followedChannel);
    }
}

export async function unfollow() {
    followedId = null; followedName = ""; followedChannel = null;
    stopFlux();
    clearInactivityTimer();
    await persist();
    notifyAll();
}

function joinFollowed() {
    if (!followedChannel) {
        Toasts.show({ message: t(`${followedName} ليس في قناة صوتية`, `${followedName} is not in a voice channel`), type: Toasts.Type.FAILURE, id: Toasts.genId() });
        return;
    }
    joinChannel(followedChannel);
    resetInactivityTimer();
}

// ── Icone coeur ───────────────────────────────────────────────────────────────
function HeartIcon({ filled = false }: { filled?: boolean; }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24">
            {filled ? (
                <path fill="white" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            ) : (
                <path fill="currentColor" d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z" />
            )}
        </svg>
    );
}

// ── Bouton HeaderBar ──────────────────────────────────────────────────────────
// Clic gauche = rejoindre son vocal
// Clic droit  = unfollow
function FollowHeaderButton() {
    const fid = useFollowId();
    if (!fid) return null;

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (e.button === 2) {
            // Clic droit
            unfollow();
        } else {
            // Clic gauche
            joinFollowed();
        }
    };

    return (
        <HeaderBarButton
            icon={() => <HeartIcon filled={true} />}
            tooltip={t(`${followedName} — نقر: انضمام للصوت | نقر يمين: إلغاء المتابعة`, `${followedName} — Click: join voice | Right-click: unfollow`)}
            onClick={handleClick}
            onContextMenu={handleClick}
        />
    );
}

// ── Context menu ──────────────────────────────────────────────────────────────
const ctxPatch: NavContextMenuPatchCallback = (children, props) => {
    const userId: string | undefined = props?.user?.id;
    if (!userId) return;
    if (userId === UserStore?.getCurrentUser?.()?.id) return;
    const isFollowed = followedId === userId;
    children.push(
        <Menu.MenuCheckboxItem
            id="follow-user-ctx"
            label={isFollowed ? t("إلغاء متابعة المستخدم", "Unfollow User") : t("متابعة المستخدم", "Follow User")}
            checked={isFollowed}
            action={() => { if (isFollowed) unfollow(); else follow(userId); }}
        />
    );
};

// ── Plugin ────────────────────────────────────────────────────────────────────
export default definePlugin({
    name: "FollowUser",
    dependencies: ["HeaderBarAPI"],
    description: "Follow a user across voice channels. Right-click a user → Follow User (you join their channel). Choose whether it stops itself after 30 minutes of inactivity or keeps following until you stop it.",
    authors: [EquicordDevs.TheArmagan],
    settings,

    headerBarButton: {
        icon: HeartIcon,
        render: FollowHeaderButton,
        priority: 5,
    },

    async start() {
        const saved = await DataStore.get(DS_KEY) as { id: string; name: string; } | null;
        if (saved?.id) {
            followedId = saved.id;
            followedName = saved.name ?? saved.id;
            followedChannel = getChannelOf(saved.id);
            startFlux();
            resetInactivityTimer();
        }
        addContextMenuPatch("user-context", ctxPatch);
        addContextMenuPatch("user-profile-actions", ctxPatch);
        addContextMenuPatch("gdm-context", ctxPatch);
    },

    stop() {
        stopFlux();
        clearInactivityTimer();
        followedId = null; followedName = ""; followedChannel = null;
        removeContextMenuPatch("user-context", ctxPatch);
        removeContextMenuPatch("user-profile-actions", ctxPatch);
        removeContextMenuPatch("gdm-context", ctxPatch);
    },
});
