/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMessagePreEditListener, addMessagePreSendListener, MessageEditListener, MessageSendListener, removeMessagePreEditListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { showToast, Toasts } from "@webpack/common";

const settings = definePluginSettings({
    sanitizeOutgoing: {
        type: OptionType.BOOLEAN,
        description: "Sanitize outgoing messages (before sending)",
        default: true
    },
    sanitizeEdits: {
        type: OptionType.BOOLEAN,
        description: "Sanitize edited messages too",
        default: true
    },
    showToastOnDetection: {
        type: OptionType.BOOLEAN,
        description: "Show a notification when invisible characters are detected",
        default: true
    },
    verboseLogs: {
        type: OptionType.BOOLEAN,
        description: "Show detailed logs in console",
        default: false
    }
});

// \u0627\u0644\u0645\u062D\u0627\u0631\u0641 \u063A\u064A\u0631 \u0627\u0644\u0645\u0631\u0626\u064A\u0629 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u0629 \u0641\u064A \u0627\u0644\u0628\u0635\u0645\u0629/\u0627\u0644\u062A\u062A\u0628\u0651\u0639. \u0625\u0635\u0644\u0627\u062D \u0625\u0634\u0631\u0627\u0642: \u0646\u0633\u062A\u0628\u0639\u062F \u0639\u0645\u062F\u0627\u064B \u0645\u062D\u0627\u0631\u0641
// \u062B\u0646\u0627\u0626\u064A \u0627\u0644\u0627\u062A\u062C\u0627\u0647 \u0648\u0648\u0635\u0644 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u2014 U+200C/200D (ZWNJ/ZWJ \u0644\u0631\u0648\u0627\u0628\u0637 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0648\u0627\u0644\u0641\u0627\u0631\u0633\u064A\u0629)\u060C
// U+200E/200F (LRM/RLM) \u0648U+202A\u2011202E (\u062A\u0636\u0645\u064A\u0646 \u0627\u0644\u0628\u0627\u064A\u062F\u064A) \u2014 \u0643\u064A \u0644\u0627 \u0646\u0643\u0633\u0631 \u062A\u0646\u0633\u064A\u0642 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 RTL.
// \u0646\u062D\u0630\u0641 \u0641\u0642\u0637 \u0645\u0627 \u0644\u0627 \u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0646\u0635\u0651\u064A\u0627\u064B \u0645\u0634\u0631\u0648\u0639\u0627\u064B \u0644\u0647: ZWSP \u0648Word\u2011Joiner \u0648\u0627\u0644\u0640BOM \u0648\u0627\u0644\u0645\u0647\u062C\u0648\u0631\u0629.
const INVISIBLE_CHARS_REGEX = /[\u200B\u2060-\u2064\u206A-\u206F\uFEFF\u00AD]/g;

function log(message: string) {
    if (!settings.store.verboseLogs) return;
    console.log(`[ZeroWidthSanitizer] ${message}`);
}

function sanitize(text: string): { result: string; found: boolean; } {
    INVISIBLE_CHARS_REGEX.lastIndex = 0;
    const found = INVISIBLE_CHARS_REGEX.test(text);
    INVISIBLE_CHARS_REGEX.lastIndex = 0;
    const result = found ? text.replace(INVISIBLE_CHARS_REGEX, "") : text;
    return { result, found };
}

let preSendListener: MessageSendListener | null = null;
let preEditListener: MessageEditListener | null = null;

export default definePlugin({
    name: "ZeroWidthSanitizer",
    description: "Removes invisible zero-width characters from messages to prevent fingerprinting and tracking",
    tags: ["Privacy", "Chat"],
    authors: [{ name: "irritably", id: 928787166916640838n }],
    settings,

    // Richiede l'API MessageEvents
    dependencies: ["MessageEventsAPI"],

    start() {
        // Listener per i messaggi in uscita
        preSendListener = (channelId, messageObj) => {
            if (!settings.store.sanitizeOutgoing) return;
            if (typeof messageObj.content !== "string") return;

            const { result, found } = sanitize(messageObj.content);
            if (found) {
                messageObj.content = result;
                log(`Removed invisible characters from outgoing message in channel ${channelId}`);
                if (settings.store.showToastOnDetection) {
                    showToast(t("أُزيلت محارف التتبّع الخفيّة من رسالتك", "Removed hidden tracking characters from your message"), Toasts.Type.MESSAGE);
                }
            }
        };

        // Listener per i messaggi modificati
        preEditListener = (channelId, messageId, messageObj) => {
            if (!settings.store.sanitizeEdits) return;
            if (typeof messageObj.content !== "string") return;

            const { result, found } = sanitize(messageObj.content);
            if (found) {
                messageObj.content = result;
                log(`Removed invisible characters from edited message ${messageId}`);
                if (settings.store.showToastOnDetection) {
                    showToast(t("أُزيلت محارف التتبّع الخفيّة من تعديلك", "Removed hidden tracking characters from your edit"), Toasts.Type.MESSAGE);
                }
            }
        };

        addMessagePreSendListener(preSendListener);
        addMessagePreEditListener(preEditListener);

        log("Plugin started");
        showToast(t("منظّف المحارف الخفيّة مُفعَّل", "Zero-width sanitizer active"), Toasts.Type.SUCCESS);
    },

    stop() {
        if (preSendListener) {
            removeMessagePreSendListener(preSendListener);
            preSendListener = null;
        }
        if (preEditListener) {
            removeMessagePreEditListener(preEditListener);
            preEditListener = null;
        }

        log("Plugin stopped");
    }
});
