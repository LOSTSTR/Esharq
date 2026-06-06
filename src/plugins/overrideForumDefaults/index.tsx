/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    defaultLayout: {
        type: OptionType.SELECT,
        options: [
            { label: t("قائمة", "List"), value: 1, default: true },
            { label: t("معرض", "Gallery"), value: 2 }
        ],
        description: "Default layout for the forum"
    },
    defaultSortOrder: {
        type: OptionType.SELECT,
        options: [
            { label: t("نشط مؤخّراً", "Recently Active"), value: 0, default: true },
            { label: t("تاريخ النشر", "Date Posted"), value: 1 }
        ],
        description: "Default sort order for the forum"
    }
});

export default definePlugin({
    name: "OverrideForumDefaults",
    description: "Allows customizing the default settings for forum channels",
    tags: ["Servers", "Organisation", "Customisation"],
    authors: [Devs.Inbestigator],
    patches: [
        {
            find: "getDefaultLayout(){",
            replacement: [
                {
                    match: /}getDefaultLayout\(\){/,
                    replace: "$&return $self.getLayout();"
                },
                {
                    match: /}getDefaultSortOrder\(\){/,
                    replace: "$&return $self.getSortOrder();"
                }
            ]
        }
    ],

    getLayout: () => settings.store.defaultLayout,
    getSortOrder: () => settings.store.defaultSortOrder,

    settings
});
