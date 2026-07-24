/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { addSettingsPanelButton, DeafenIcon, removeSettingsPanelButton } from "@plugins/philsPluginLibrary";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import type { Channel, VoiceState } from "@vencord/discord-types";
import { findByCodeLazy, findByProps, findStore } from "@webpack";
import { ChannelStore, MediaEngineStore, PermissionsBits, PermissionStore, SelectedChannelStore, UserStore, VoiceActions } from "@webpack/common";

export let fakeD = false;

// بثّ/نشاط وهمي (منقول من آلية مُتحقَّقة): بدء «بث مباشر» بلا مصدر حقيقي، وبدء نشاط
// Watch Together، مع إخفاء نافذة المعاينة المحلية عبر الرقع أدناه. اختياريّ ومطفأ
// افتراضياً — لا يمسّ مسار الكتم/الإصمام إطلاقاً.
const startStreamAction = findByCodeLazy('type:"STREAM_START"');
const stopStreamAction = findByCodeLazy('type:"STREAM_STOP"');
const STREAM = 1n << 9n;
const WATCH_TOGETHER_APPLICATION_ID = "880218394199220334";
let fakeStreamActive = false;

function getSelectedVoiceChannel(): Channel | null {
    const selected = SelectedChannelStore.getVoiceChannelId();
    if (!selected) return null;
    return ChannelStore.getChannel(selected);
}

function startFakeStream() {
    const channel = getSelectedVoiceChannel();
    if (!channel) return;
    startStreamAction(channel.guild_id, channel.id, {
        pid: null,
        sourceId: null,
        sourceName: null,
        audioSourceId: null,
        sound: false,
        previewDisabled: true
    });
}

function stopFakeStream() {
    const ConnectionStore = findStore("StreamRTCConnectionStore");
    for (const streamKey of ConnectionStore?.getAllActiveStreamKeys?.() ?? []) {
        stopStreamAction(streamKey, { streamKey, appContext: "app" });
        break;
    }
}

function hasFakeStream(): boolean {
    const ConnectionStore = findStore("StreamRTCConnectionStore");
    return (ConnectionStore?.getAllActiveStreamKeys?.().length ?? 0) > 0;
}

function getEmbeddedActivityLocation(channelId: string) {
    return { channelId, guildId: ChannelStore.getChannel(channelId)?.guild_id ?? null };
}

async function startFakeActivity(channelId: string) {
    const activityApi = findByProps("su", "_H");
    if (!activityApi?.su) return;
    await activityApi.su({
        channelId,
        applicationId: WATCH_TOGETHER_APPLICATION_ID,
        isStart: true,
        locationObject: getEmbeddedActivityLocation(channelId)
    });
}

function hasFakeActivity(channelId: string): boolean {
    const store = findStore("EmbeddedActivitiesStore");
    return store?.getSelfEmbeddedActivityForChannel?.(channelId)?.applicationId === WATCH_TOGETHER_APPLICATION_ID;
}

function leaveFakeActivity(channelId?: string) {
    const activityApi = findByProps("su", "_H");
    const frameApi = findByProps("launchFrame", "refreshProxyTicket", "stopFrame");
    const store = findStore("EmbeddedActivitiesStore");
    const activity = store?.getCurrentEmbeddedActivity?.()
        ?? (channelId ? store?.getSelfEmbeddedActivityForChannel?.(channelId) : null);
    const location = store?.getConnectedActivityLocation?.()
        ?? activity?.location
        ?? (channelId ? getEmbeddedActivityLocation(channelId) : null);

    if (!location || !activity?.applicationId) return;

    activityApi?._H?.({ location, applicationId: activity.applicationId, showFeedback: false });
    frameApi?.stopFrame?.({ applicationId: activity.applicationId });
}

function canStream(channel: Channel) {
    return PermissionStore.can(STREAM, channel);
}

function canUseActivity(channel: Channel) {
    return PermissionStore.can(PermissionsBits.USE_EMBEDDED_ACTIVITIES, channel);
}

// يُطبّق حالة البثّ/النشاط الوهمية وفق `fakeD` والإعدادات. يُستدعى من التبديل ومن
// VOICE_STATE_UPDATES ليظلّ ثابتاً عند تغيّر حالة الصوت.
function syncStreamAndActivity() {
    const channel = getSelectedVoiceChannel();

    if (!fakeD || !channel) {
        if (fakeStreamActive) { fakeStreamActive = false; stopFakeStream(); }
        return;
    }

    if (settings.store.fakeStream && canStream(channel)) {
        fakeStreamActive = true;
        if (!hasFakeStream()) startFakeStream();
    }

    if (settings.store.fakeGame && canUseActivity(channel) && !hasFakeActivity(channel.id)) {
        void startFakeActivity(channel.id);
    }
}

function mute() {
    // اكتم فقط إن لم تكن مكتوماً — مطابق لسلوك زر «Mute» الأصلي، لكن عبر دالة
    // ديسكورد مباشرةً بدل النقر على DOM بالنص فيعمل أياً كانت لغة الواجهة.
    if (!MediaEngineStore.isSelfMute()) VoiceActions.toggleSelfMute();
}

function deafen() {
    // أصمِت فقط إن لم تكن مُصمَتاً (مستقلّ عن اللغة)
    if (!MediaEngineStore.isSelfDeaf()) VoiceActions.toggleSelfDeaf();
}

const settings = definePluginSettings({
    hideIcon: {
        type: OptionType.BOOLEAN,
        description: "",
        default: false,
        onChange: (value: boolean) => {
            if (value) {
                removeSettingsPanelButton("faked");
            } else {
                addSettingsPanelButton({
                    name: "faked",
                    icon: DeafenIcon,
                    tooltipText: t("الوضع الوهمي للسماعه والمايك Fake Deafen", "Fake Deafen"),
                    onClick: toggleFakeDeafen
                });
            }
        }
    },
    keybind: {
        type: OptionType.SELECT,
        description: "",
        options: [
            { label: "F1", value: "f1", default: false },
            { label: "F2", value: "f2", default: false },
            { label: "F3", value: "f3", default: false },
            { label: "F4", value: "f4", default: false },
            { label: "F5", value: "f5", default: false },
            { label: "F6", value: "f6", default: false },
            { label: "F7", value: "f7", default: false },
            { label: "F8", value: "f8", default: false },
            { label: "F9", value: "f9", default: true },
            { label: "F10", value: "f10", default: false },
            { label: "F11", value: "f11", default: false },
            { label: "F12", value: "f12", default: false },
            { label: "Ctrl+D", value: "ctrl+d", default: false },
            { label: "Ctrl+Shift+D", value: "ctrl+shift+d", default: false },
            { label: "Alt+D", value: "alt+d", default: false },
            { label: "Alt+F", value: "alt+f", default: false },
            { label: "Ctrl+Alt+D", value: "ctrl+alt+d", default: false },
            { label: "Shift+F9", value: "shift+f9", default: false },
            { label: "Shift+F10", value: "shift+f10", default: false },
            { label: "Shift+F11", value: "shift+f11", default: false },
            { label: "Shift+F12", value: "shift+f12", default: false }
        ]
    },
    muteUponFakeDeafen: {
        type: OptionType.BOOLEAN,
        description: "",
        default: false
    },
    mute: {
        type: OptionType.BOOLEAN,
        description: "",
        default: true
    },
    deafen: {
        type: OptionType.BOOLEAN,
        description: "",
        default: true
    },
    cam: {
        type: OptionType.BOOLEAN,
        description: "",
        default: false
    },
    fakeStream: {
        type: OptionType.BOOLEAN,
        description: "",
        default: false,
        onChange: () => { if (fakeD) syncStreamAndActivity(); }
    },
    fakeGame: {
        type: OptionType.BOOLEAN,
        description: "",
        default: false,
        onChange: () => { if (fakeD) syncStreamAndActivity(); }
    },
    useCustomKeybind: {
        type: OptionType.BOOLEAN,
        description: "",
        default: false,
        onChange: () => {
            setupKeybindListener();
        }
    },
    customKeybind: {
        type: OptionType.STRING,
        description: "",
        default: "",
        disabled: () => !settings.store.useCustomKeybind,
        onChange: () => {
            setupKeybindListener();
        }
    }
});

function toggleFakeDeafen() {
    fakeD = !fakeD;

    // تبديل الإصمات مرّتين (تشغيل ثم إيقاف) عبر دالة ديسكورد مباشرةً بدل النقر على
    // DOM بالنص — يعمل أياً كانت لغة الواجهة. كل تبديل يُطلق voiceStateUpdate الذي
    // تعترضه الرقعة فيُبقي الآخرين يرونك مُصمَتاً بينما تسمع أنت.
    VoiceActions.toggleSelfDeaf();
    setTimeout(() => VoiceActions.toggleSelfDeaf(), 250);

    if (fakeD && settings.store.muteUponFakeDeafen) {
        setTimeout(mute, 300);
    }

    // بثّ/نشاط وهمي (اختياري): يبدأ عند التفعيل، ويُوقَف/يُغادَر عند الإطفاء.
    if (fakeD) {
        syncStreamAndActivity();
    } else {
        const channel = getSelectedVoiceChannel();
        fakeStreamActive = false;
        stopFakeStream();
        if (settings.store.fakeGame) leaveFakeActivity(channel?.id);
    }
}

let keydownListener: ((e: KeyboardEvent) => void) | null = null;

function parseKeybind(keybind: string): { ctrl: boolean; shift: boolean; alt: boolean; key: string } {
    const parts = keybind.toLowerCase().split("+");
    return {
        ctrl: parts.includes("ctrl") || parts.includes("control"),
        shift: parts.includes("shift"),
        alt: parts.includes("alt"),
        key: parts[parts.length - 1]
    };
}

function setupKeybindListener() {
    if (keydownListener) {
        document.removeEventListener("keydown", keydownListener);
    }

    keydownListener = (e: KeyboardEvent) => {

        const keybindValue = settings.store.useCustomKeybind && settings.store.customKeybind
            ? settings.store.customKeybind
            : settings.store.keybind || "f9";

        const keybind = parseKeybind(keybindValue);

        const ctrlMatch = keybind.ctrl === (e.ctrlKey || e.metaKey);
        const shiftMatch = keybind.shift === e.shiftKey;
        const altMatch = keybind.alt === e.altKey;
        const keyMatch = e.key.toLowerCase() === keybind.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
            e.preventDefault();
            toggleFakeDeafen();
        }
    };

    document.addEventListener("keydown", keydownListener);
}

export default definePlugin({
    name: "FakeDeafen",
    description: "Appear as deafened to others while still being able to hear.",
    dependencies: ["PhilsPluginLibrary"],
    authors: [EquicordDevs.LOSTSTR],

    patches: [
        {
            find: "}voiceStateUpdate(",
            replacement: {
                match: /self_mute:([^,]+),self_deaf:([^,]+),self_video:([^,]+)/,
                replace: "self_mute:$self.toggle($1, 'mute'),self_deaf:$self.toggle($2, 'deaf'),self_video:$self.toggle($3, 'video')"
            }
        },
        // إخفاء فتح نشاط Watch Together محلياً عند تفعيل fakeGame (تظهر للآخرين فقط).
        {
            find: "OPEN_EMBEDDED_ACTIVITY,{location:",
            replacement: {
                match: /\i\._\.dispatch\(\i\.\i\.OPEN_EMBEDDED_ACTIVITY,\{location:\i,applicationId:\i,/,
                replace: "$self.shouldOpenEmbeddedActivity()&&$&"
            }
        },
        {
            find: "handleOpenActivityPopout",
            replacement: {
                match: /\i\.open\(\i\.\i\.ACTIVITY_POPOUT,.{0,80}?defaultHeight:480\}\)/,
                replace: "$self.shouldOpenEmbeddedActivity()&&$&"
            }
        },
        // إخفاء نافذة معاينة البثّ المحلية عند تفعيل fakeStream.
        {
            find: "CAMERA_PREVIEW]:",
            replacement: {
                match: /d\.set\(\i,\i\),(\i)===(\i\.\i)\.VIDEO.{0,100}?\2\.HAVEN&&null==\i&&\(\i=\i\)/,
                replace: "(($1!==$2.ACTIVITY||$self.shouldOpenEmbeddedActivity())&&($1!==$2.VIDEO||$self.shouldOpenStreamPip()))&&($&)",
                noWarn: true
            }
        }
    ],

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            if (!fakeD) return;
            const myId = UserStore.getCurrentUser()?.id;
            const selected = SelectedChannelStore.getVoiceChannelId();
            if (!selected || !voiceStates.some(s => s.userId === myId && s.channelId === selected)) return;
            syncStreamAndActivity();
        }
    },

    settings,
    toggle: (au: any, what: string) => {
        if (fakeD === false)
            return au;
        else
            switch (what) {
                case "mute": return settings.store.mute;
                case "deaf": return settings.store.deafen;
                case "video": return settings.store.cam;
            }
    },
    shouldOpenEmbeddedActivity: () => !(fakeD && settings.store.fakeGame),
    shouldOpenStreamPip: () => !(fakeD && fakeStreamActive),

    start() {

        if (!settings.store.hideIcon) {
            addSettingsPanelButton({
                name: "faked",
                icon: DeafenIcon,
                tooltipText: t("الوضع الوهمي للسماعه والمايك Fake Deafen", "Fake Deafen"),
                onClick: toggleFakeDeafen
            });
        }


        setupKeybindListener();
    },

    stop() {
        removeSettingsPanelButton("faked");

        if (keydownListener) {
            document.removeEventListener("keydown", keydownListener);
            keydownListener = null;
        }

        // إيقاف أي بثّ/نشاط وهمي بقي مفعّلاً عند تعطيل الإضافة.
        if (fakeStreamActive) { fakeStreamActive = false; stopFakeStream(); }
        leaveFakeActivity(getSelectedVoiceChannel()?.id);
    }
});
