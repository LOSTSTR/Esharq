/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { SelectedChannelStore, Toasts, UserStore, VoiceStateStore } from "@webpack/common";

// SHA-256 hex of the owner's secret. Only the hash lives in the source; the plaintext is known
// only to the owner, so nobody else can arm the detector from the settings UI.
const EXPECTED_HASH = "c7db3f20b3f8c4c2f4067677111d906e416a0d954b456ce58da3a1b6040aa946";

const COOLDOWN = 30_000;
const CONFIRM_DELAY = 1200;

let armed = false;
const lastAlert = new Map<string, number>();
const pending = new Set<string>();

async function sha256hex(input: string) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(pw: string) {
    armed = !!pw && (await sha256hex(pw)) === EXPECTED_HASH;
    return armed;
}

function notify(message: string, failure = true) {
    Toasts.show({
        id: Toasts.genId(),
        message,
        type: failure ? Toasts.Type.FAILURE : Toasts.Type.SUCCESS,
        options: { position: Toasts.Position.BOTTOM, duration: 6000 }
    });
}

function alertOnce(userId: string) {
    const now = Date.now();
    if (now - (lastAlert.get(userId) ?? 0) < COOLDOWN) return;
    lastAlert.set(userId, now);

    const name = UserStore.getUser(userId)?.username ?? userId;
    const message = t(`⚠️ ${name} يستخدم التصامّ الوهمي (Fake Deafen)`, `⚠️ ${name} is using Fake Deafen`);
    console.warn("[FakeVoiceDetector]", message);
    notify(message);
}

// A genuinely deafened user is muted and sends no audio, so anyone shown deafened in my channel
// while still transmitting is faking it. The delayed re-check drops the brief join/leave race.
function scheduleCheck(userId: string) {
    if (pending.has(userId)) return;
    pending.add(userId);

    setTimeout(() => {
        pending.delete(userId);
        if (!armed) return;
        const myChannel = SelectedChannelStore.getVoiceChannelId();
        if (!myChannel) return;

        const vs = VoiceStateStore.getVoiceStateForUser(userId);
        if (vs?.channelId === myChannel && vs.selfDeaf) alertOnce(userId);
    }, CONFIRM_DELAY);
}

const settings = definePluginSettings({
    password: {
        type: OptionType.STRING,
        description: "The secret that arms the detector. Nothing runs until it matches.",
        default: "",
        onChange: async (value: string) => {
            const ok = await verifyPassword(value);
            notify(ok ? t("🔓 تم تفعيل الكاشف", "🔓 Detector armed") : t("🔒 كلمة سر غير صحيحة — الكاشف متوقف", "🔒 Wrong password. Detector stays off"), !ok);
        }
    }
});

export default definePlugin({
    name: "FakeVoiceDetector",
    description: "Detect who is using Fake Deafen in your voice channel. Locked behind a secret.",
    authors: [EquicordDevs.LOSTSTR],
    settings,

    flux: {
        SPEAKING({ userId, speakingFlags }: { userId: string; speakingFlags: number; }) {
            if (!armed || !speakingFlags) return;
            if (userId === UserStore.getCurrentUser()?.id) return;

            const myChannel = SelectedChannelStore.getVoiceChannelId();
            if (!myChannel) return;

            const vs = VoiceStateStore.getVoiceStateForUser(userId);
            if (vs?.channelId === myChannel && vs.selfDeaf) scheduleCheck(userId);
        }
    },

    async start() {
        await verifyPassword(settings.store.password);
    },

    stop() {
        armed = false;
        pending.clear();
        lastAlert.clear();
    }
});
