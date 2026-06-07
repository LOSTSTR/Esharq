/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getUserSettingLazy } from "@api/UserSettings";
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Devs, EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin from "@utils/types";
import { VoiceState } from "@vencord/discord-types";
import { findByCodeLazy, findStoreLazy } from "@webpack";
import { ChannelStore, MediaEngineStore, PermissionsBits, PermissionStore, SelectedChannelStore, showToast, Toasts, UserStore, VoiceActions, WindowStore } from "@webpack/common";

import { getCurrentMedia, settings } from "./utils";

let hasStreamed, isStreaming, streamKey;
const startStream = findByCodeLazy('type:"STREAM_START"');
const stopStream = findByCodeLazy('type:"STREAM_STOP"');
const StreamPreviewSettings = getUserSettingLazy("voiceAndVideo", "disableStreamPreviews")!;
const ApplicationStreamingSettingsStore = findStoreLazy("ApplicationStreamingSettingsStore");

async function autoStartStream(instant = true) {
    if (!instant && !WindowStore.isFocused() && settings.store.focusDiscord) return;
    const selected = SelectedChannelStore.getVoiceChannelId();
    if (!selected) return;

    const channel = ChannelStore.getChannel(selected);
    if (!channel) return;

    const isGuildChannel = !channel.isDM() && !channel.isGroupDM();

    if (channel.type === 13 || isGuildChannel && !PermissionStore.can(PermissionsBits.STREAM, channel)) return;

    if (settings.store.autoDeafen && !MediaEngineStore.isSelfDeaf() && instant) {
        VoiceActions.toggleSelfDeaf();
    } else if (settings.store.autoMute && !MediaEngineStore.isSelfMute() && instant) {
        VoiceActions.toggleSelfMute();
    }

    const streamMedia = await getCurrentMedia();
    const preview = StreamPreviewSettings.getSetting();
    const { soundshareEnabled } = ApplicationStreamingSettingsStore.getState();
    let sourceId = streamMedia.id;
    if (streamMedia.type === "video_device") sourceId = `camera:${streamMedia.id}`;

    if (isStreaming && streamKey.endsWith(UserStore.getCurrentUser().id)) {
        stopStream(streamKey);
    } else {
        startStream(channel.guild_id ?? null, selected, {
            "pid": null,
            "sourceId": sourceId,
            "sourceName": streamMedia.name,
            "audioSourceId": streamMedia.name,
            "sound": soundshareEnabled,
            "previewDisabled": preview
        });
    }
}

export default definePlugin({
    name: "InstantScreenshare",
    description: "Instantly starts screensharing when joining a voice channel, with support for desktop, windows, video cameras, and capture cards",
    tags: ["Media", "Voice"],
    authors: [Devs.HAHALOSAH, Devs.thororen, EquicordDevs.mart],
    dependencies: ["EquicordToolbox"],
    searchTerms: ["ScreenshareKeybind"],
    autoStartStream,
    settings,

    settingsAboutComponent: () => (
        <>
            <HeadingSecondary>{t("لنظام Linux", "For Linux")}</HeadingSecondary>
            <Paragraph>
                For Wayland it only pops up the screenshare select
                <br />{t("على X11 قد يعمل وقد لا يعمل :shrug:", "For X11 it may or may not work :shrug:")}</Paragraph>
            <br />
            <HeadingSecondary>{t("أجهزة الفيديو", "Video Devices")}</HeadingSecondary>
            <Paragraph>{t("يدعم الكاميرات وبطاقات الالتقاط (مثل Elgato HD60X) عند تفعيله في الإعدادات", "Supports cameras and capture cards (like Elgato HD60X) when enabled in settings")}</Paragraph>
            <br />
            <HeadingSecondary>{t("بخصوص إعدادات الصوت والمعاينة", "Regarding Sound & Preview Settings")}</HeadingSecondary>
            <Paragraph>{t("نستخدم الإعدادات التي يضبطها ويستخدمها ديسكورد لتحديد ما إذا كان ينبغي تفعيل معاينة البثّ والصوت أم لا", "We use the settings set and used by discord to decide if stream preview and sound should be enabled or not")}</Paragraph>
        </>
    ),

    patches: [
        {
            find: "DISCONNECT_FROM_VOICE_CHANNEL]",
            predicate: () => settings.store.keybindScreenshare,
            replacement: {
                match: /\[\i\.\i\.DISCONNECT_FROM_VOICE_CHANNEL/,
                replace: '["INSTANT_SCREEN_SHARE"]:{onTrigger(){$self.autoStartStream(false)},keyEvents:{keyUp:!1,keyDown:!0}},$&'
            },
        },
        {
            find: '"push-to-talk-priority"',
            predicate: () => settings.store.keybindScreenshare,
            replacement: {
                match: /=\[(\{id:.{0,25}value:\i\.\i\.UNASSIGNED)/,
                replace: '=[{id:"instant-screen-share",value:"INSTANT_SCREEN_SHARE",label:"Instant Screenshare"},$1'
            }
        }
    ],

    flux: {
        async VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            if (!settings.store.toolboxManagement || !settings.store.instantScreenshare) return;
            const myId = UserStore.getCurrentUser().id;
            for (const state of voiceStates) {
                const { userId, channelId } = state;
                if (userId !== myId) continue;

                if (channelId && !hasStreamed) {
                    hasStreamed = true;
                    await autoStartStream();
                }

                if (!channelId) {
                    hasStreamed = false;
                }

                break;
            }
        },
        STREAM_CREATE: d => {
            streamKey = d;
            isStreaming = true;
        },
        STREAM_DELETE: d => {
            streamKey = d;
            isStreaming = false;
        }
    },

    toolboxActions: {
        "Instant Screenshare"() {
            settings.store.toolboxManagement = !settings.store.toolboxManagement;
            showToast(`Instant Screenshare ${settings.store.toolboxManagement ? t("مُفعَّل", "Enabled") : t("مُعطَّل", "Disabled")}`, Toasts.Type.SUCCESS);
        }
    }
});
