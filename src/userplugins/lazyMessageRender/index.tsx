/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle, setStyleClassNames } from "@api/Styles";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findCssClassesLazy } from "@webpack";

import style from "./style.css?managed";

const classes = findCssClassesLazy("messageListItem");

export default definePlugin({
    name: "LazyMessageRender",
    description: "Skips layout and paint for offscreen messages using CSS content-visibility, reducing lag in large servers.",
    authors: [EquicordDevs.LOSTSTR, { name: "x2b", id: 996137713432530976n }],

    start() {
        setStyleClassNames(style, { messageListItem: classes.messageListItem });
        enableStyle(style);
    },

    stop() {
        disableStyle(style);
    }
});
