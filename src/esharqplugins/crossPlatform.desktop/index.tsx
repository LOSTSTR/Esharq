/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";

import { applyPresences, installInjection, removeInjection } from "./inject";
import Panel from "./panel";
import { buildPlatforms } from "./platforms";
import { accountsFor, getCredentials, loadStore } from "./store";
import { PlatformPresence } from "./types";

const logger = new Logger("CrossPlatform");

const settings = definePluginSettings({
    interval: {
        type: OptionType.SELECT,
        description: "How often to ask the platforms for an update.",
        options: [
            { label: t("كل ٣٠ ثانية", "Every 30 seconds"), value: 30 },
            { label: t("كل دقيقة", "Every minute"), value: 60, default: true },
            { label: t("كل دقيقتين", "Every 2 minutes"), value: 120 },
            { label: t("كل خمس دقائق", "Every 5 minutes"), value: 300 }
        ]
    },
    panel: {
        type: OptionType.COMPONENT,
        component: Panel
    }
});

let timer: ReturnType<typeof setTimeout> | null = null;
/** يمنع جولتين متداخلتين لو تأخّرت الشبكة أكثر من الفاصل. */
let running = false;

interface Row {
    discordId: string;
    platformLabel: string;
    presence: PlatformPresence;
}

async function pollOnce(): Promise<void> {
    const creds = getCredentials();
    const rows: Row[] = [];

    for (const platform of buildPlatforms()) {
        // معرّف الحساب على المنصّة ← معرّف ديسكورد المربوط به.
        const linked = accountsFor(platform.id);
        if (linked.size === 0) continue;

        try {
            const presences = await platform.poll(creds, [...linked.keys()]);
            for (const presence of presences) {
                const discordId = linked.get(presence.accountId);
                if (discordId) rows.push({ discordId, platformLabel: platform.label, presence });
            }
        } catch (e) {
            // منصّةٌ تفشل لا تُسقط البقيّة.
            logger.error(`فشل استطلاع ${platform.label}`, e);
        }
    }

    applyPresences(rows);
}

async function tick(): Promise<void> {
    if (running) return;
    running = true;
    try {
        await pollOnce();
    } finally {
        running = false;
        // الجدولة بعد الانتهاء لا قبله، فيُحترم الفاصل مهما بطؤت الشبكة،
        // وتُقرأ المدّة من الإعداد كلّ مرّة فيسري تغييرها بلا إعادة تشغيل.
        timer = setTimeout(tick, settings.store.interval * 1000);
    }
}

export default definePlugin({
    name: "CrossPlatform",
    description: "Show what your friends are playing on Steam, Hypixel and Twitch inside Discord. You link each friend yourself and supply your own API keys.",
    authors: [EquicordDevs.LOSTSTR],
    tags: ["Utility"],
    settings,

    async start() {
        await loadStore();
        installInjection();
        tick();
    },

    stop() {
        if (timer !== null) clearTimeout(timer);
        timer = null;
        running = false;
        removeInjection();
    }
});
