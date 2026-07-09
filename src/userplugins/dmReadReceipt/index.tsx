/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin from "@utils/types";
import { MessageStore, React, TypingStore, UserStore, useStateFromStores } from "@webpack/common";

import { MessageDecorationProps } from "../../api/MessageDecorations";

/**
 * Honest DM activity indicator.
 *
 * Discord does NOT broadcast when the other person *reads* a DM — no gateway
 * event, store, or API exposes another user's read-state, so a true "seen"
 * receipt is impossible. The only REAL signal about the recipient is whether
 * they are actively typing (TypingStore) — which means they have the chat open
 * right now. So we show:
 *   • "typing…"  → recipient is typing (real, live).
 *   • "sent"     → your latest DM left your client (baseline).
 * We never claim a silent read, because that cannot be detected.
 *
 * Shown only under your MOST RECENT message in the channel; once they reply,
 * their message becomes the last one and the indicator naturally disappears.
 */
function ActivityIndicator({ message, channel }: MessageDecorationProps) {
    const recipientId = channel.recipients?.[0];

    const state = useStateFromStores(
        [MessageStore, TypingStore],
        () => {
            if (!recipientId) return null;
            const msgs = MessageStore.getMessages(channel.id);
            const last = msgs?.last();
            // Only decorate the last message in the channel (which, given the
            // author filter below, is your latest sent message).
            if (!last || last.id !== message.id) return null;
            return (TypingStore as any).isTyping(channel.id, recipientId) ? "typing" as const : "sent" as const;
        }
    );

    if (!state || !recipientId) return null;
    const isTyping = state === "typing";
    return (
        <span style={{ fontSize: "10px", color: isTyping ? "var(--text-positive, #3ba55c)" : "var(--text-muted)", marginLeft: "4px" }}>
            {isTyping ? t("✍️ يكتب الآن…", "✍️ typing…") : t("✓ أُرسلت", "✓ Sent")}
        </span>
    );
}

export default definePlugin({
    name: "DmReadReceipt",
    // Honest: Discord exposes no real read-state for the other user, so this is a
    // live typing/sent indicator, NOT a silent-read receipt.
    description: "Shows a live typing / sent indicator under your latest DM. Discord provides no real read receipts, so silent reads can't be detected.",
    tags: ["Chat", "Utility"],
    authors: [EquicordDevs.LOSTSTR],
    dependencies: ["MessageDecorationsAPI"],

    renderMessageDecoration: props => {
        const me = UserStore.getCurrentUser()?.id;
        if (!me || props.message.author.id !== me || !props.channel.isDM()) return null;
        return <ActivityIndicator {...props} />;
    },
});
