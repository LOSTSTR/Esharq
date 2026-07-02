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
    name: "ClapText",
    description: "Adds /clap to 👏 put 👏 claps 👏 between 👏 your 👏 words.",
    authors: [EquicordDevs.LOSTSTR, { name: "Sharp", id: 0n }],
    dependencies: ["CommandsAPI"],
    commands: [
        {
            name: "clap",
            description: t("ضع 👏 تصفيقاً 👏 بين 👏 الكلمات", "Put 👏 claps 👏 between 👏 words"),
            options: [RequiredMessageOption],
            execute: opts => ({
                content: findOption(opts, "message", "")
                    .split(/\s+/)
                    .filter(Boolean)
                    .join(" 👏 ")
            })
        }
    ]
});
