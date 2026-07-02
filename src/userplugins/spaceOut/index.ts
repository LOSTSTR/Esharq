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
    name: "SpaceOut",
    description: "/spaceout p u t s   s p a c e s   between every letter.",
    authors: [EquicordDevs.LOSTSTR, { name: "Sharp", id: 0n }],
    dependencies: ["CommandsAPI"],
    commands: [
        {
            name: "spaceout",
            description: t("باعِد بين كل حرف", "Space out every letter"),
            options: [RequiredMessageOption],
            execute: opts => ({
                content: findOption(opts, "message", "").split("").join(" ")
            })
        }
    ]
});
