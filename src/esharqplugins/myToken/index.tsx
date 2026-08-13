/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";

// Discord's own authentication-token module (standard, specific finder: it owns
// both getToken and hideToken). We ONLY read via getToken() — no localStorage,
// no webpack scanning, no fetch interception. If the module can't be found the
// command degrades to a friendly "couldn't retrieve" with no side effects.
const TokenModule = findByPropsLazy("getToken", "hideToken");

export default definePlugin({
    name: "MyToken",
    description: "Adds a /mytoken command that privately shows your own account token (only you can see it — it is never sent anywhere).",
    authors: [EquicordDevs.LOSTSTR],
    tags: ["Privacy", "Utility"],
    dependencies: ["CommandsAPI"],
    commands: [
        {
            name: "mytoken",
            description: t("يعرض توكن حسابك أنت فقط (لا تشاركه مع أحد)", "Shows your own account token (never share it with anyone)"),
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: (_, ctx) => {
                const token = TokenModule?.getToken?.();

                if (typeof token !== "string" || !token) {
                    sendBotMessage(ctx.channel.id, {
                        content: t("تعذّر الحصول على التوكن.", "Couldn't retrieve the token.")
                    });
                    return;
                }

                // sendBotMessage is LOCAL-ONLY (a client-side Clyde message) — the
                // token is shown only in your own client and is never transmitted.
                sendBotMessage(ctx.channel.id, {
                    content: t(
                        `⚠️ **لا تشارك هذا التوكن مع أحد — من يملكه يملك حسابك بالكامل.**\n\`\`\`\n${token}\n\`\`\``,
                        `⚠️ **Never share this token with anyone — whoever has it fully controls your account.**\n\`\`\`\n${token}\n\`\`\``
                    )
                });
            }
        }
    ]
});
