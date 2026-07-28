/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ApplicationStreamingStore, StreamerModeStore } from "@webpack/common";

import { getStyle } from "./style";

const settings = definePluginSettings({
    hoverToView: {
        type: OptionType.BOOLEAN,
        description: "When hovering over a message, show the contents.",
        default: false,
        onChange: () => updateClassList("hover-to-view", settings.store.hoverToView)
    },
    keybind: {
        type: OptionType.STRING,
        description: "The keybind to show the contents of a message.",
        default: "Insert",
        restartNeeded: false
    },
    enableForStream: {
        type: OptionType.BOOLEAN,
        description: "Also blur while Discord's Streamer Mode is on, not only while you are actually sharing.",
        default: false,
        onChange: syncActive
    }
});

function updateClassList(className: string, condition: boolean) {
    document.body.classList.toggle(`vc-dnl-${className}`, condition);
}

/**
 * Ask Discord whether anything is actually being shared, instead of guessing
 * from the toolbar's DOM. `getCurrentUserActiveStream` is non-null only while
 * WE are streaming, so nothing is blurred just because the plugin is enabled.
 */
function isSharing(): boolean {
    try {
        if (ApplicationStreamingStore.getCurrentUserActiveStream() != null) return true;
        return settings.store.enableForStream && StreamerModeStore.enabled;
    } catch {
        return false;
    }
}

function syncActive() {
    updateClassList("active", isSharing());
}

export default definePlugin({
    name: "DoNotLeak",
    description: "Hide all message contents and attachments while you are sharing your screen.",
    authors: [EquicordDevs.Perny, EquicordDevs.LOSTSTR],
    enabledByDefault: false,
    tags: ["Privacy", "Utility"],
    settings,
    start() {
        const style = document.createElement("style");
        style.setAttribute("id", "vc-dont-leak-style");
        style.innerHTML = getStyle();
        document.head.appendChild(style);

        document.addEventListener("keyup", keyUpHandler);
        document.addEventListener("keydown", keyDownHandler);
        ApplicationStreamingStore.addChangeListener(syncActive);
        StreamerModeStore.addChangeListener(syncActive);

        updateClassList("hover-to-view", settings.store.hoverToView);
        syncActive();
    },
    stop() {
        document.removeEventListener("keyup", keyUpHandler);
        document.removeEventListener("keydown", keyDownHandler);
        ApplicationStreamingStore.removeChangeListener(syncActive);
        StreamerModeStore.removeChangeListener(syncActive);

        document.getElementById("vc-dont-leak-style")?.remove();
        for (const c of ["active", "hover-to-view", "show-messages"]) updateClassList(c, false);
    }
});

function keyUpHandler(e: KeyboardEvent) {
    if (e.key !== settings.store.keybind) return;
    updateClassList("show-messages", false);
}

function keyDownHandler(e: KeyboardEvent) {
    if (e.key !== settings.store.keybind) return;
    updateClassList("show-messages", true);
}
