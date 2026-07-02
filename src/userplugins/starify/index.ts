/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findOption, RequiredMessageOption } from "@api/Commands";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "Starify",
    description: "Adds /starify to wrap your message in sparkles ｡ﾟ☆.",
    authors: [EquicordDevs.LOSTSTR, { name: "Sharp", id: 0n }],
    dependencies: ["CommandsAPI"],
    commands: [
        {
            name: "starify",
            description: t("زخرف رسالتك بالنجوم", "Decorate your message with sparkles"),
            options: [RequiredMessageOption],
            execute: opts => {
                const text = findOption(opts, "message", "");
                return { content: `✦ﾟ｡⋆ ${text} ⋆｡ﾟ✦` };
            }
        }
    ]
});
