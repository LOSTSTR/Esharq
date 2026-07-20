/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { t } from "@utils/esharqI18n";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher } from "@webpack/common";

const MediaEngineStore = findByPropsLazy("getMediaEngine");

function fixEngine() {
    try {
        const engine = MediaEngineStore.getMediaEngine();
        if (engine && typeof engine.reconfigure === "function") engine.reconfigure();
    } catch (e) {
        console.error("[FixScreenshare] Error during engine fix:", e);
    }
}

const handleVoiceChannelSelect = () => setTimeout(fixEngine, 1000);

export default definePlugin({
    name: "FixScreenshare",
    description: "Fixes infinite loading and crashes on screenshare after a reload (Ctrl+R) by forcing the media engine to re-initialize.",
    authors: [{ name: t("مؤلف غير معروف", "Unknown"), id: 0n }],

    start() {
        fixEngine();
        setTimeout(fixEngine, 5000);
        setTimeout(fixEngine, 15000);
        FluxDispatcher.subscribe("VOICE_CHANNEL_SELECT", handleVoiceChannelSelect);
    },

    stop() {
        FluxDispatcher.unsubscribe("VOICE_CHANNEL_SELECT", handleVoiceChannelSelect);
    }
});
