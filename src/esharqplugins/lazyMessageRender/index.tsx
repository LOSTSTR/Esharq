/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle } from "@api/Styles";
import { fillStyleClassesWhenReady } from "@utils/esharqLateClasses";
import definePlugin from "@utils/types";

import style from "./style.css?managed";

// 🔴 وحدةُ الرسائل تُحمَّل كسولاً. ينظر التعليق في `@utils/esharqLateClasses`.

export default definePlugin({
    name: "LazyMessageRender",
    description: "Keeps the message action toolbar from clipping under the message above by lifting the hovered/focused row. (content-visibility was removed — Discord's virtualized scroller mis-measures contained rows after recent updates, causing scroll jumping.)",
    authors: [{ name: "x2b", id: 996137713432530976n }],
    tags: ["Appearance", "Chat"],

    start() {
        fillStyleClassesWhenReady([style], ["messageListItem"]);
        enableStyle(style);
    },

    stop() {
        disableStyle(style);
    }
});
