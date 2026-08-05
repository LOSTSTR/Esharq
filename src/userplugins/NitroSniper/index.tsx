/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, NavigationRouter, React, UserStore } from "@webpack/common";

const logger = new Logger("NitroSniper");
const GiftActions = findByPropsLazy("redeemGiftCode");

let startTime = 0;
let claiming = false;
const codeQueue: Array<{
    code: string;
    channelId: string;
    guildId?: string;
    messageId: string;
    /** Who posted the code — shown in the notification so a claim is traceable to its source. */
    senderName?: string;
}> = [];

const settings = definePluginSettings({
    ignoreOwnGiftLinks: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Do not redeem Nitro gift links from messages you sent yourself."
    },
    notifyOnRedeem: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show a notification when a Nitro code is successfully redeemed."
    },
    notifyOnFail: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Show a notification when a Nitro code fails to redeem."
    }
});

function processQueue() {
    if (claiming || !codeQueue.length) return;

    claiming = true;
    const { code, channelId, guildId, messageId, senderName } = codeQueue.shift()!;

    logger.log(`Attempting to redeem code: ${code} (channel: ${channelId}, guild: ${guildId ?? "dm"})`);

    const onSuccess = (gift: any) => {
        logger.log(`Successfully redeemed code: ${code} (channel: ${channelId}, guild: ${guildId ?? "dm"})`);

        if (settings.store.notifyOnRedeem) {
            const user = UserStore.getCurrentUser();
            const giftType = gift?.subscription_plan?.name || "Nitro";

            showNotification({
                title: "Nitro Sniped! 🎉",
                body: senderName
                    ? t(`استُبدل كود ${giftType} من ${senderName}`, `Redeemed a ${giftType} code from ${senderName}`)
                    : t(`استُبدل كود ${giftType}`, `Successfully redeemed ${giftType} code`),
                color: "#5865F2",
                icon: user.getAvatarURL(),
                onClick: () => {
                    NavigationRouter.transitionTo(`/channels/${guildId ?? "@me"}/${channelId}/${messageId}`);
                }
            });
        }

        finish();
    };

    const onFailure = (err: unknown) => {
        logger.error(`Failed to redeem code: ${code} (channel: ${channelId}, guild: ${guildId ?? "dm"})`, err);

        if (settings.store.notifyOnFail) {
            const user = UserStore.getCurrentUser();

            showNotification({
                title: "Nitro Redeem Failed ❌",
                body: senderName
                    ? t(`فشل استبدال كود من ${senderName}`, `Failed to redeem a code from ${senderName}`)
                    : t(`فشل استبدال الكود: ${code}`, `Failed to redeem code: ${code}`),
                color: "#ED4245",
                icon: user.getAvatarURL(),
                onClick: () => {
                    NavigationRouter.transitionTo(`/channels/${guildId ?? "@me"}/${channelId}/${messageId}`);
                }
            });
        }

        finish();
    };

    // حارس: أيّاً كان شكل الواجهة، لا نُنهي المحاولة إلا مرّة واحدة — فلو نفّذ ديسكورد
    // النداء الراجع *و* حلّ الوعد معاً لم يُستهلك عنصران من الطابور بمحاولة واحدة.
    let settled = false;
    function finish() {
        if (settled) return;
        settled = true;
        claiming = false;
        processQueue();
    }

    // ديسكورد حوّل redeemGiftCode من نداءات راجعة (onRedeemed/onError) إلى Promise.
    // النسخة القديمة كانت تمرّر النداءات فقط: لا يُستدعى أيٌّ منها أبداً، فتبقى الراية
    // `claiming` مرفوعة إلى الأبد ويتجمّد الطابور بعد أوّل رابط هدية — وهو سبب توقّف
    // الإضافة عن العمل. نمرّر الاثنين معاً فتعمل مع أيّ من الشكلين بلا تخمين.
    try {
        const result = GiftActions.redeemGiftCode({ code, onRedeemed: onSuccess, onError: onFailure });
        if (result != null && typeof result.then === "function") result.then(onSuccess, onFailure);
    } catch (err) {
        onFailure(err);
    }
}

export default definePlugin({
    name: "NitroSniper",
    description: "Automatically redeems Nitro gift links sent in chat.\n\n⚠️ WARNING: This plugin automatically redeems Nitro gift codes found in chat. This may violate Discord's Terms of Service and could result in account suspension. Use at your own risk.",
    tags: ["Utility", "Fun"],
    searchTerms: ["nitro", "gift", "redeem", "snipe", "نيترو", "هدية"],
    authors: [
        { name: "neoarz", id: 1015372540937502851n },
        { name: "irritably", id: 928787166916640838n }
    ],

    settingsAboutComponent: () => (
        <div style={{
            color: "var(--text-danger)",
            border: "1px solid var(--text-danger)",
            borderRadius: 6,
            padding: "10px 12px",
            margin: "8px 0",
            fontWeight: 600
        }}>
            {t("⚠️ تحذير: تستبدل هذه الإضافة أكواد نيترو تلقائياً — قد يخالف شروط خدمة Discord ويُعرّض حسابك للحظر. استخدمها على مسؤوليتك الخاصة.", "⚠️ WARNING: This plugin auto-redeems Nitro codes — may violate Discord's Terms of Service and get your account suspended. Use at your own risk.")}
        </div>
    ),

    settings,

    start() {
        startTime = Date.now();
        codeQueue.length = 0;
        claiming = false;
    },

    stop() {
        // Disabling mid-claim would otherwise leave the claiming flag raised and stale entries
        // queued, so the next enable would redeem codes from a session that already ended.
        codeQueue.length = 0;
        claiming = false;
    },

    flux: {
        MESSAGE_CREATE({ message }) {
            if (!message.content) return;
            if (settings.store.ignoreOwnGiftLinks && message.author?.id === UserStore.getCurrentUser()?.id) return;

            const match = message.content.match(/(?:discord\.gift\/|discord\.com\/gifts?\/)([a-zA-Z0-9]{16,24})/);
            if (!match) return;

            if (new Date(message.timestamp).getTime() < startTime) return;

            // MESSAGE_CREATE does not reliably include guild_id, and without it the jump link
            // below resolves to /channels/@me/<guild channel>/<id> and goes nowhere. The channel
            // store is authoritative; the payload field stays as a fallback. Same order our
            // autoClaim plugin already uses.
            const channel = ChannelStore.getChannel(message.channel_id);

            codeQueue.push({
                code: match[1],
                channelId: message.channel_id,
                guildId: channel?.guild_id ?? message.guild_id,
                messageId: message.id,
                senderName: message.author?.globalName ?? message.author?.username
            });
            processQueue();
        }
    }
});
