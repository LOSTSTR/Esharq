/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin from "@utils/types";

const NUMBERS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

export default definePlugin({
    name: "PollMaker",
    description: "/poll formats a quick poll. Use: question | option | option ...",
    authors: [EquicordDevs.LOSTSTR, { name: "Dann", id: 0n }],
    dependencies: ["CommandsAPI"],
    commands: [
        {
            name: "poll",
            description: t("أنشئ استطلاعاً: السؤال | خيار | خيار", "Make a poll: question | option one | option two"),
            options: [
                {
                    name: "text",
                    description: t("السؤال | خيار | خيار ...", "question | option | option ..."),
                    type: ApplicationCommandOptionType.STRING,
                    required: true
                }
            ],
            execute: (opts, ctx) => {
                const parts = findOption(opts, "text", "").split("|").map(s => s.trim()).filter(Boolean);
                const question = parts.shift();
                const choices = parts.slice(0, NUMBERS.length);

                if (!question || choices.length < 2) {
                    sendBotMessage(ctx.channel.id, { content: t("أحتاج سؤالاً وخيارين على الأقل، افصل بينها بـ `|`.", "Need a question and at least two options, split with `|`.") });
                    return;
                }

                const body = choices.map((c, i) => `${NUMBERS[i]} ${c}`).join("\n");
                return { content: `📊 **${question}**\n${body}` };
            }
        }
    ]
});
