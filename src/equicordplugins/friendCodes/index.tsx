/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

import FriendCodesPanel from "./FriendCodesPanel";

export default definePlugin({
    name: "FriendCodes",
    description: "Generates friend codes for easily adding friends",
    tags: ["Friends", "Utility"],
    authors: [Devs.HypedDomi],
    patches: [
        {
            find: "#{intl::ADD_FRIEND})}),(",
            replacement: {
                match: /#{intl::ADD_FRIEND}.{0,15}\(\i,\{\}\)/,
                replace: "$&,$self.FriendCodesPanel"
            },
            noWarn: true,
        }
    ],

    get FriendCodesPanel() {
        return <FriendCodesPanel />;
    }
});
