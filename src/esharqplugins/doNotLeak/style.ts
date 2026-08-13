/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findByProps } from "@webpack";

/**
 * Blurring is switched on by the `vc-dnl-active` class that index.ts puts on
 * <body> from Discord's own streaming state. It used to be decided here in CSS
 * with `body:has(div.{sidebar} > section div.{actionButtons} > button:nth-child(2).{buttonActive})`,
 * which guessed at the share-screen button by its position and mangled class
 * names — so any layout change made it match while nothing was being shared,
 * and everything stayed blurred.
 */
const CssFormatCode: string = `body.vc-dnl-active .{messageContent} {
filter: blur(12px);
}

body.vc-dnl-active .{visualMediaItemContainer} {
filter: blur(50px) brightness(0.1);
}

body.vc-dnl-active .{embedWrapper} {
filter: blur(50px);
}

body.vc-dnl-active.vc-dnl-show-messages .{messageContent},
body.vc-dnl-active.vc-dnl-show-messages .{visualMediaItemContainer},
body.vc-dnl-active.vc-dnl-show-messages .{embedWrapper} {
filter: none !important;
}

body.vc-dnl-active.vc-dnl-hover-to-view .{messageContent}:hover,
body.vc-dnl-active.vc-dnl-hover-to-view .{visualMediaItemContainer}:hover,
body.vc-dnl-active.vc-dnl-hover-to-view .{embedWrapper}:hover {
filter: none !important;
}`;

export function getStyle(): string {
    // Resolve each token from its OWN module. Merging every module into one
    // object let a shared key (`wrapper`, …) from a later module overwrite an
    // earlier one, so a token could silently end up as the wrong class.
    const tokens: Record<string, string | undefined> = {
        messageContent: findByProps("messageContent", "titleCase")?.messageContent,
        visualMediaItemContainer: findByProps("visualMediaItemContainer")?.visualMediaItemContainer,
        embedWrapper: findByProps("embedWrapper")?.embedWrapper
    };

    let css = CssFormatCode;
    for (const [token, className] of Object.entries(tokens)) {
        // An unresolved token would leave `.{token}` in the sheet, which is an
        // invalid selector — drop that rule instead of shipping broken CSS.
        css = css.replaceAll(`{${token}}`, className ?? "vc-dnl-unresolved");
    }
    return css;
}
