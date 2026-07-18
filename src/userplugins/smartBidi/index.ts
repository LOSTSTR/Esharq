/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle, setStyleClassNames } from "@api/Styles";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findCssClassesLazy } from "@webpack";

import style from "./style.css?managed";

// messageContent is Discord's mangled class for the chat message body.
// Resolved here instead of hardcoding `[class*="messageContent-"]`, and fed
// into the `[--messageContent]` placeholder in style.css. Graceful failure:
// if it doesn't resolve, compileStyle leaves the placeholder in place — a
// selector that matches nothing — so the fix is simply absent, never a crash.
const classes = findCssClassesLazy("messageContent");

export default definePlugin({
    name: "SmartBidi",
    description: "Fix how Arabic and other right-to-left text renders when it's mixed with numbers, links, mentions or code — no more scrambled word order or misplaced punctuation.",
    authors: [EquicordDevs.LOSTSTR],
    start() {
        setStyleClassNames(style, { messageContent: classes.messageContent });
        enableStyle(style);
    },
    stop: () => disableStyle(style),
});
