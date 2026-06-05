/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Alerts, Button, GuildStore } from "@webpack/common";

const DeleteGuild = findByPropsLazy("deleteGuild", "sendTransferOwnershipPincode").deleteGuild;

function GetPropsAndDeleteGuild(id) {
    const GotGuild = GuildStore.getGuild(id);
    if (!GotGuild) return;

    DeleteGuild(id, GotGuild.name);
}

const settings = definePluginSettings({
    domain: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Remove the warning popup when opening links from untrusted domains",
        restartNeeded: true
    },
    file: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Remove the 'Potentially Dangerous Download' popup when opening links",
        restartNeeded: true
    },
    noDeleteSafety: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Remove the requirement to type the server name when deleting it",
        restartNeeded: true
    },
    confirmModal: {
        type: OptionType.BOOLEAN,
        description: "Whether to show an 'Are you sure?' confirmation modal before deleting",
        default: true
    },
});

export default definePlugin({
    name: "AlwaysTrust",
    description: "Removes verification messages and warning popups when opening external links or downloading files",
    tags: ["Utility"],
    authors: [Devs.zt, Devs.Trwy],
    isModified: true,
    settings,
    patches: [
        {
            find: '="MaskedLinkStore",',
            replacement: {
                match: /(?<=isTrustedDomain\(\i\){)return \i\(\i\)/,
                replace: "return true"
            },
            predicate: () => settings.store.domain
        },
        {
            find: "bitbucket.org",
            replacement: {
                match: /function \i\(\i\){(?=.{0,30}pathname:\i)/,
                replace: "$&return null;"
            },
            predicate: () => settings.store.file
        },
        {
            find: ".DELETE,onClick(){let",
            replacement: {
                match: /let\{name:\i\}=(\i)\.guild/,
                replace: "$self.HandleGuildDeleteModal($1);$&"
            },
            predicate: () => settings.store.noDeleteSafety
        }
    ],
    async HandleGuildDeleteModal(server) {
        if (settings.store.confirmModal) {
            return Alerts.show({
                title: t("حذف السيرفر؟", "Delete server?"),
                body: <p>{t("إنه دائم، إن لم يكن ذلك واضحاً.", "It's permanent, if that wasn't obvious.")}</p>,
                confirmColor: Button.Colors.RED,
                confirmText: t("حذف", "Delete"),
                onConfirm: () => GetPropsAndDeleteGuild(server.id),
                cancelText: t("إلغاء", "Cancel")
            });
        } else {
            return GetPropsAndDeleteGuild(server.id);
        }
    },
});
