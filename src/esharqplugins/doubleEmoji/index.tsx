/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { t } from "@utils/esharqI18n";
import { Logger } from "@utils/Logger";

const logger = new Logger("DoubleEmoji");

let clickListener: ((e: MouseEvent) => void) | undefined;

export default definePlugin({
    name: "DoubleEmoji",
    description: "Keeps the emoji picker open on click and highlights the selected emoji with a blue border.",
    authors: [{ name: t("مؤلف غير معروف", "Unknown"), id: 0n }],

    start() {
        clickListener = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const emojiWrapper = target.closest("[class*='emojiItem'], [class*='EmojiItem']") as HTMLElement | null;
            if (!emojiWrapper) return;
            if (!target.closest("[class*='emojiPicker'], #emoji-picker-tab-panel, [class*='expressionPicker']")) return;

            emojiWrapper.style.border = "1px solid #5865f2";
            emojiWrapper.style.borderRadius = "4px";
            emojiWrapper.style.background = "rgb(88 101 242 / 5%)";

            // Discord keeps the picker open when Shift is held; spoof it on this click.
            try { Object.defineProperty(e, "shiftKey", { get: () => true, configurable: true }); } catch (err) { logger.debug("Ignored error", err); }
        };

        document.addEventListener("click", clickListener, { capture: true });
    },

    stop() {
        if (clickListener) document.removeEventListener("click", clickListener, { capture: true });
        clickListener = undefined;
    }
});
