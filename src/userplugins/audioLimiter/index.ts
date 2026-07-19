/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import definePlugin, { makeRange, OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { UserStore } from "@webpack/common";
import { Logger } from "@utils/Logger";

const logger = new Logger("AudioLimiter");

interface StreamData {
    id: string;
    audioContext: AudioContext;
    stream: MediaStream;
    gainNode?: GainNode;
    streamSourceNode?: MediaStreamAudioSourceNode;
    _mute: boolean;
    _volume: number;
    __ncSourceNode?: MediaStreamAudioSourceNode;
    __ncGainNode?: GainNode;
    __ncLimiterNode?: DynamicsCompressorNode;
}

const activeStreams = new Map<string, StreamData>();
const MediaEngineModule = findByPropsLazy("getMediaEngine");

function applyLimiter(data: StreamData) {
    if (!settings.store.enabled) return;
    if (data.__ncLimiterNode) return;
    if (data.stream.getAudioTracks().length === 0) return;

    // Ignore local user's microphone to prevent WebRTC crashes (which cause disconnect/reconnect loops on mute)
    const myId = UserStore?.getCurrentUser?.()?.id;
    if (myId && (data.id === myId || data.id === "default" || data.id === "local")) return;

    try {
        const ctx = data.audioContext;
        const source = data.__ncSourceNode ?? ctx.createMediaStreamSource(data.stream);
        data.__ncSourceNode = source;

        const gain = ctx.createGain();
        gain.gain.value = data._mute ? 0 : data._volume / 100;
        data.__ncGainNode = gain;

        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = settings.store.maxVolume;
        compressor.ratio.value = 20;
        compressor.knee.value = 0;
        compressor.attack.value = settings.store.attack / 1000;
        compressor.release.value = 0.1;
        data.__ncLimiterNode = compressor;

        try { data.gainNode?.disconnect(); } catch (err) { logger.debug("Ignored error", err); }
        try { data.streamSourceNode?.disconnect(); } catch (err) { logger.debug("Ignored error", err); }

        source.connect(gain);
        gain.connect(compressor);
        compressor.connect(ctx.destination);
        activeStreams.set(data.id, data);

        const cleanup = () => {
            removeLimiter(data);
            data.stream.removeEventListener("inactive", cleanup);
        };
        data.stream.addEventListener("inactive", cleanup);
    } catch (e) {
        console.error("[AudioLimiter] apply failed:", e);
    }
}

function removeLimiter(data: StreamData) {
    try { data.__ncSourceNode?.disconnect(); } catch (err) { logger.debug("Ignored error", err); }
    try { data.__ncGainNode?.disconnect(); } catch (err) { logger.debug("Ignored error", err); }
    try { data.__ncLimiterNode?.disconnect(); } catch (err) { logger.debug("Ignored error", err); }
    delete data.__ncSourceNode;
    delete data.__ncGainNode;
    delete data.__ncLimiterNode;
    activeStreams.delete(data.id);
}

function enableAll() {
    const engine = MediaEngineModule?.getMediaEngine?.();
    if (!engine) return;
    const streams = Object.values((engine as any)._streams ?? (engine as any).streams ?? {}) as StreamData[];
    for (const s of streams) applyLimiter(s);
}

function disableAll() {
    for (const s of activeStreams.values()) removeLimiter(s);
    activeStreams.clear();
}

function updateParams() {
    for (const s of activeStreams.values()) {
        if (s.__ncLimiterNode) {
            s.__ncLimiterNode.threshold.value = settings.store.maxVolume;
            s.__ncLimiterNode.attack.value = settings.store.attack / 1000;
        }
        if (s.__ncGainNode) {
            s.__ncGainNode.gain.value = s._mute ? 0 : s._volume / 100;
        }
    }
}

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل محدّد الصوت", "Enable audio limiter"),
        default: false,
        onChange: (v: boolean) => v ? enableAll() : disableAll(),
    },
    maxVolume: {
        type: OptionType.SLIDER,
        description: t("أقصى مستوى صوت مسموح (ديسيبل) — يُضغط ما فوقه", "Maximum allowed volume (dB) — sounds above are compressed"),
        markers: makeRange(-30, 0, 3),
        default: -6,
        stickToMarkers: false,
        onChange: () => updateParams(),
    },
    attack: {
        type: OptionType.SLIDER,
        description: t("سرعة الاستجابة (مللي ثانية) — الأقل = أسرع", "Reaction speed (ms) — lower = more reactive"),
        markers: [1, 5, 10, 15, 20, 30, 50],
        default: 2,
        stickToMarkers: false,
        onChange: () => updateParams(),
    },
});

export default definePlugin({
    name: "AudioLimiter",
    description: "Automatically caps the volume of other users — no more screaming or loud noises that pierce your ears.",
    authors: [{ name: "mushzi", id: 449282863582412850n }],
    settings,

    patches: [
        {
            find: "streamSourceNode",
            replacement: {
                // The setter body is a comma expression, not statements, so the old
                // `this._volume=<ident>;` anchor stopped matching and the whole plugin
                // silently did nothing. Current shape:
                //   set volume(e){this._volume=arguments[0],this.updateAudioElement()}
                match: /set volume\(\i\)\{this\._volume=arguments\[0\],/,
                replace: "$&$self.onVolumeChange(this),",
            },
        },
    ],

    onVolumeChange(data: StreamData) {
        if (!settings.store.enabled || !data?.id) return;
        if (data.__ncLimiterNode) {
            if (data.__ncGainNode) {
                data.__ncGainNode.gain.value = data._mute ? 0 : data._volume / 100;
            }
        } else {
            applyLimiter(data);
        }
    },

    start() {
        if (settings.store.enabled) setTimeout(() => enableAll(), 2000);
    },

    stop() {
        disableAll();
    },
});
