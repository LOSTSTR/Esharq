/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import type { Channel, Emoji } from "@vencord/discord-types";

const settings = definePluginSettings({
    shownEmojis: {
        description: "The types of emojis that appear in the autocomplete list.",
        type: OptionType.SELECT,
        default: "onlyUnicode",
        options: [
            { label: t("إيموجي يونيكود فقط", "Only unicode emojis"), value: "onlyUnicode" },
            { label: t("إيموجي يونيكود وإيموجي الخادم الحالي", "Unicode emojis and server emojis from current server"), value: "currentServer" },
            { label: t("إيموجي يونيكود وكل إيموجي الخادم (افتراضي ديسكورد)", "Unicode emojis and all server emojis (Discord default)"), value: "all" }
        ]
    }
});

export default definePlugin({
    name: "NoServerEmojis",
    authors: [Devs.UlyssesZhan],
    description: "Prevents Discord from converting emoji text into server emoji images",
    tags: ["Emotes", "Servers"],
    settings,

    patches: [
        {
            find: "}searchWithoutFetchingLatest(",
            replacement: {
                match: /\.nameMatchesChain\(\i\)\.reduce\(\((\i),(\i)\)=>\{(?<=channel:(\i).+?)/,
                replace: "$&if($self.shouldSkip($3,$2))return $1;"
            }
        }
    ],

    shouldSkip(channel: Channel | undefined | null, emoji: Emoji) {
        if (emoji.type !== 1) {
            return false;
        }

        if (settings.store.shownEmojis === "onlyUnicode") {
            return true;
        }

        if (settings.store.shownEmojis === "currentServer") {
            return emoji.guildId !== (channel != null ? channel.getGuildId() : null);
        }

        return false;
    }
});
