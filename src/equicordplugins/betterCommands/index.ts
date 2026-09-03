/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    autoFillArguments: {
        description: "Automatically fill command with all arguments instead of just required ones.",
        type: OptionType.BOOLEAN,
        default: true,
    },
});

function fetchIndex(target: object) {
    FluxDispatcher.dispatch({
        type: "APPLICATION_COMMAND_INDEX_FETCH_REQUEST",
        target
    });
}

export default definePlugin({
    name: "BetterCommands",
    description: "Enhances the commands system with multiple improvements",
    dependencies: ["CommandsAPI"],
    tags: ["Appearance", "Commands", "Shortcuts"],
    authors: [Devs.thororen],
    settings,
    patches: [
        {
            find: 'applicationCommand",',
            predicate: () => settings.store.autoFillArguments,
            replacement: [
                {
                    match: /\(\i\.required.{0,20}\]\)/,
                    replace: "true"
                },
            ]
        },
    ],
    commands: [
        {
            name: "refresh",
            description: t("يحدّث أوامر التطبيق المحددة محلياً", "Locally refreshes the specified application commands"),
            options: [
                {
                    name: "user",
                    description: t("مستخدم محدد لمحاولة التحديث", "A specific user to attempt the refresh for"),
                    type: ApplicationCommandOptionType.USER,
                }
            ],
            inputType: ApplicationCommandInputType.BOT,
            execute: async (opts, ctx) => {
                try {
                    const channelId = ctx.channel.id;
                    const guildId = ctx.guild?.id;
                    const user = findOption(opts, "user") as string;

                    sendBotMessage(ctx.channel.id, {
                        content: t("جارٍ تحديث أوامر التطبيق...", "Refreshing application commands..."),
                    });

                    fetchIndex({ type: "channel", channelId });

                    if (guildId) fetchIndex({ type: "guild", guildId });

                    if (user) {
                        const target = await UserStore.getUser(user);
                        fetchIndex(
                            target.bot
                                ? { type: "application", applicationId: target.id }
                                : { type: "user" }
                        );
                    }

                    sendBotMessage(ctx.channel.id, {
                        content: t("تمّ تحديث الأوامر بنجاح!", "Commands refreshed successfully!"),
                    });
                } catch (err) {
                    console.error("[Refresh Command] Error refreshing commands:", err);
                    sendBotMessage(ctx.channel.id, {
                        content: t("فشل تحديث الأوامر. تحقّق من الكونسول للتفاصيل.", "Failed to refresh commands. Check the console for details."),
                    });
                }
            },
        },
    ]
});
