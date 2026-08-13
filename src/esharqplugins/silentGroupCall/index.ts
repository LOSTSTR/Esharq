/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ChannelStore } from "@webpack/common";

// 1 = DM (1-on-1), 3 = GROUP_DM. Stable, long-documented Discord API values.
const CHANNEL_TYPE_DM = 1;
const CHANNEL_TYPE_GROUP_DM = 3;

const settings = definePluginSettings({
    silenceGroupCalls: {
        type: OptionType.BOOLEAN,
        description: "Don't ring members when you start a group call.",
        default: true
    },
    silenceDMCalls: {
        type: OptionType.BOOLEAN,
        description: "Don't ring the other person when you start a 1-on-1 DM call.",
        default: false
    },
    debugLogs: {
        type: OptionType.BOOLEAN,
        description: "Log plugin activity to the console.",
        default: false
    }
});

const logger = new Logger("SilentGroupCall");
const debug = (...args: any[]) => {
    if (settings.store.debugLogs) logger.info(...args);
};

const CallActions: any = findByPropsLazy("ring", "stopRinging");

// The original, unpatched ring function. null means "not currently patched".
let originalRing: ((...args: any[]) => any) | null = null;

function shouldSilence(channelId: string, channel: any): boolean {
    if (!channel) {
        debug(`unknown channel ${channelId} — passing through`);
        return false;
    }

    if (channel.type === CHANNEL_TYPE_GROUP_DM) return settings.store.silenceGroupCalls;
    if (channel.type === CHANNEL_TYPE_DM) return settings.store.silenceDMCalls;

    return false;
}

export default definePlugin({
    name: "SilentGroupCall",
    description: "Start DM and group calls without ringing the other members — they can still see and join the call, they just don't get the incoming-call notification.",
    authors: [{ name: "gandhistyle", id: 0n }, EquicordDevs.LOSTSTR],
    tags: ["Voice", "Utility"],
    enabledByDefault: false,
    settings,
    start() {
        // Re-entrancy guard: never double-wrap (would leak the original and make
        // stop() unable to fully revert).
        if (originalRing) {
            debug("start() called while already patched — ignoring");
            return;
        }

        let ring: unknown;
        try {
            ring = CallActions.ring;
        } catch (e) {
            logger.error("could not find ring/stopRinging module — plugin inactive", e);
            return;
        }

        if (typeof ring !== "function") {
            logger.error("could not find ring/stopRinging module — plugin inactive");
            return;
        }

        const orig = ring as (...args: any[]) => any;
        originalRing = orig;

        CallActions.ring = function (this: unknown, channelId: string, ...rest: any[]) {
            let channel: any;
            try {
                channel = ChannelStore.getChannel(channelId);
            } catch {
                channel = undefined;
            }

            if (shouldSilence(channelId, channel)) {
                // Silencing = simply not calling the original ring. We deliberately
                // send NO extra requests: the plugin only ever omits traffic the
                // client would have sent, never adds any.
                debug(`→ silencing (skipping ring) for ${channelId}`);
                return;
            }

            debug(`→ ringing normally: ${channelId}`);
            return orig.call(this, channelId, ...rest);
        };

        logger.info("patched ring()");
    },
    stop() {
        if (!originalRing) return;

        try {
            CallActions.ring = originalRing;
        } catch (e) {
            logger.error("failed to restore original ring()", e);
        } finally {
            originalRing = null;
        }

        logger.info("unpatched ring()");
    }
});
