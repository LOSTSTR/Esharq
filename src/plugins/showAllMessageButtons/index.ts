/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { MessageActions, PinActions } from "@webpack/common";

const settings = definePluginSettings({
    noShiftDelete: {
        type: OptionType.BOOLEAN,
        description: "Remove the requirement to hold Shift to delete a message.",
        default: true,
    },
    noShiftPin: {
        type: OptionType.BOOLEAN,
        description: "Remove the requirement to hold Shift to pin a message.",
        default: true,
    },
    noQuickReacts: {
        default: true,
        restartNeeded: true,
        type: OptionType.BOOLEAN,
        description: "Hide quick reacts. By default, showing the full menu hides quick react buttons.",
    },
});

export default definePlugin({
    name: "ShowAllMessageButtons",
    description: "Always shows all message buttons without hovering",
    tags: ["Chat", "Utility"],
    authors: [Devs.Nuckyz],
    settings,

    patches: [
        {
            find: "#{intl::MESSAGE_UTILITIES_A11Y_LABEL}",
            replacement: [
                {
                    match: /isExpanded:\i&&(.+?),/,
                    replace: "isExpanded:$1,"
                },
                {
                    predicate: () => settings.store.noShiftDelete,
                    match: /onClick:.{10,20}(?=,dangerous:!0)/,
                    replace: "onClick:() => $self.deleteMessage(arguments[0].message)",
                },
                {
                    predicate: () => settings.store.noShiftPin,
                    match: /onClick:.{10,30}(?=\},"pin")/,
                    replace: "onClick:() => $self.toggleMessagePin(arguments[0]),"
                },
                {
                    predicate: () => !settings.store.noQuickReacts,
                    // The quick-react element is now a member expression (`ns.$$`) rather
                    // than a bare identifier, so the trailing component needs an optional
                    // `<ident>.` prefix or this never matches.
                    match: /\i(\?null:\(0,\i\.jsxs\).{0,100}message:\i\}\)),\(0,\i\.jsxs?\)\((?:\i\.)?\i,\{\}\)/,
                    replace: "false$1"
                },
            ]
        },
    ],

    deleteMessage({ channel_id, id }) {
        MessageActions.deleteMessage(channel_id, id);
    },
    toggleMessagePin({ channel, message }) {
        if (message.pinned) return PinActions.unpinMessage(channel, message.id);

        PinActions.pinMessage(channel, message.id);
    },
});
