/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, findOption, RequiredMessageOption, sendBotMessage } from "@api/Commands";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "WikiLookup",
    description: "/wiki pulls a short Wikipedia summary for anything (sent only to you).",
    authors: [EquicordDevs.LOSTSTR, { name: "Sharp", id: 0n }],
    dependencies: ["CommandsAPI"],
    commands: [
        {
            name: "wiki",
            description: t("ابحث عن ملخّص من ويكيبيديا", "Look up a Wikipedia summary"),
            inputType: ApplicationCommandInputType.BOT,
            options: [RequiredMessageOption],
            execute: async (opts, ctx) => {
                const query = findOption(opts, "message", "").trim();
                if (!query) return;
                try {
                    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
                    if (!res.ok) {
                        sendBotMessage(ctx.channel.id, { content: `No Wikipedia article found for **${query}**.` });
                        return;
                    }
                    const data = await res.json();
                    if (data.type === "disambiguation" || !data.extract) {
                        sendBotMessage(ctx.channel.id, { content: `**${query}** is ambiguous — try being more specific.` });
                        return;
                    }
                    const url = data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`;
                    sendBotMessage(ctx.channel.id, {
                        content: `📚 **${data.title}**\n${data.extract}\n<${url}>`
                    });
                } catch {
                    sendBotMessage(ctx.channel.id, { content: t("تعذّر الوصول إلى ويكيبيديا الآن.", "Couldn't reach Wikipedia right now.") });
                }
            }
        }
    ]
});
