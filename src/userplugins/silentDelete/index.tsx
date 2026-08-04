/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";
import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { addMessagePopoverButton as addButton, removeMessagePopoverButton as removeButton } from "@api/MessagePopover";
import { definePluginSettings } from "@api/Settings";
import { BanRiskWarning } from "@utils/esharqBanWarning";
import { t } from "@utils/esharqI18n";
import { sleep } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, Constants, Menu, React, RestAPI, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    warning: {
        type: OptionType.COMPONENT,
        component: () => <BanRiskWarning
            ar="تحذير: الحذف الصامت وتجاوز مسجّلات الرسائل قد يخالف شروط خدمة Discord ويعرّض حسابك للحظر. أمر /silentpurge قد يصطدم بحدود المعدّل. استخدمها بمسؤولية."
            en="Warning: silently deleting and bypassing message loggers may violate Discord's Terms of Service and could get your account banned. /silentpurge may hit rate limits. Use responsibly."
        />,
    },
    replacementText: {
        type: OptionType.STRING,
        description: t("النص الذي يحلّ محلّ الرسالة قبل حذفها.", "Text to replace the message with before deletion."),
        default: "** **"
    },
    deleteDelay: {
        type: OptionType.NUMBER,
        description: t("التأخير بالمللي ثانية قبل حذف رسالة الاستبدال (يُنصح بـ 100-500).", "Delay in milliseconds before deleting the replacement message (recommended: 100-500)."),
        default: 200
    },
    suppressNotifications: {
        type: OptionType.BOOLEAN,
        description: t("كتم الإشعارات عند استبدال الرسالة (يمنع تنبيه المستخدمين المذكورين).", "Suppress notifications when replacing the message (prevents pinging mentioned users)."),
        default: true
    },
    deleteOriginal: {
        type: OptionType.BOOLEAN,
        description: t("حذف الرسالة الأصلية من الخادم. إذا عُطّل، ستعود الرسالة الأصلية عند إعادة تشغيل العميل.", "Delete the original message from server. If disabled, the original message will reappear on client restart."),
        default: true
    },
    purgeInterval: {
        type: OptionType.NUMBER,
        description: t("التأخير بالمللي ثانية بين كل عملية حذف أثناء ‎/silentpurge (يُنصح بـ 500-1000 لتجنّب حدود المعدّل).", "Delay in milliseconds between each message deletion during /silentpurge (recommended: 500-1000 to avoid rate limits)."),
        default: 500
    },
    accentColor: {
        type: OptionType.STRING,
        description: t("لون أيقونة الحذف الصامت (رمز hex).", "Accent color for the Silent Delete icon (hex code)."),
        default: "#ed4245"
    }
});

const getAccentColor = () => settings.store.accentColor || "#ed4245";

// Accepts + spreads the props Discord's popover button passes (className/size), so the
// button renders correctly; the colour is set via inline `style` (which beats Discord's
// `fill: currentColor` CSS) so the icon actually shows in the accent red, not muted grey.
const SilentDeleteIcon = ({ width = 18, height = 18, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg width={width} height={height} viewBox="0 0 24 24" {...props} style={{ fill: getAccentColor(), ...props.style }}>
        <path d="M15 3.999V2H9V3.999H3V5.999H21V3.999H15Z" />
        <path d="M5 6.99902V18.999C5 20.101 5.897 20.999 7 20.999H17C18.103 20.999 19 20.101 19 18.999V6.99902H5ZM11 17H9V11H11V17ZM15 17H13V11H15V17Z" />
    </svg>
);

async function silentDeleteMessage(channelId: string, messageId: string, deleteOriginal = true): Promise<boolean> {
    try {
        const { replacementText = "** **", deleteDelay = 200, suppressNotifications = true, deleteOriginal: shouldDelete = true } = settings.store;

        const response = await RestAPI.post({
            url: Constants.Endpoints.MESSAGES(channelId),
            body: {
                content: replacementText,
                flags: suppressNotifications ? 4096 : 0,
                mobile_network_type: "unknown",
                nonce: messageId,
                tts: false
            }
        });

        await sleep(deleteDelay);
        await RestAPI.del({ url: Constants.Endpoints.MESSAGE(channelId, response.body.id) });

        if (deleteOriginal && shouldDelete) {
            await sleep(100);
            await RestAPI.del({ url: Constants.Endpoints.MESSAGE(channelId, messageId) });
        }

        return true;
    } catch (error) {
        console.error("[SilentDelete] Error:", error);
        return false;
    }
}

const messageContextMenuPatch: NavContextMenuPatchCallback = (children, { message }) => {
    if (!message || message.author?.id !== UserStore.getCurrentUser()?.id) return;

    // Deleted own message → the existing "Silent Delete History" entry.
    if (message.deleted) {
        const group = findGroupChildrenByChildId("remove-message-history", children) ?? children;
        group.push(
            <Menu.MenuItem
                id="silent-delete-history"
                label={<span style={{ color: getAccentColor() }}>{t("سجلّ الحذف الصامت", "Silent Delete History")}</span>}
                action={() => silentDeleteMessage(message.channel_id, message.id, false)}
                icon={SilentDeleteIcon}
            />
        );
        return;
    }

    // Own, non-deleted message → the actual "Silent Delete" action, right in the menu
    // next to Discord's own Delete (so it's reachable without the hover toolbar).
    const group = findGroupChildrenByChildId("delete", children) ?? children;
    group.push(
        <Menu.MenuItem
            id="silent-delete-msg"
            label={<span style={{ color: getAccentColor() }}>{t("حذف صامت", "Silent Delete")}</span>}
            action={() => silentDeleteMessage(message.channel_id, message.id)}
            icon={SilentDeleteIcon}
        />
    );
};

export default definePlugin({
    name: "SilentDelete",
    description: "\"Silently\" deletes a message. Bypass message loggers by replacing the message with a placeholder.",
    authors: [
        { name: "Aurick", id: 1348025017233047634n },
        { name: "appleflyer", id: 1209096766075703368n }
    ],
    dependencies: ["MessagePopoverAPI", "CommandsAPI"],
    settings,
    contextMenus: {
        "message": messageContextMenuPatch
    },

    commands: [
        {
            name: "silentpurge",
            description: t("احذف رسائلك الأخيرة في هذه القناة بصمت", "Silently delete your recent messages in this channel"),
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [{
                name: "count",
                description: t("عدد رسائلك المراد حذفها بصمت (1-100)", "Number of your messages to silently delete (1-100)"),
                type: ApplicationCommandOptionType.INTEGER,
                required: true
            }],
            execute: (opts, ctx) => {
                const count = Number(opts.find(o => o.name === "count")?.value);
                if (!count || count < 1 || count > 100) return;

                const channelId = ctx.channel.id;
                const currentUserId = UserStore.getCurrentUser()?.id;

                (async () => {
                    try {
                        const userMessages: any[] = [];
                        let lastMessageId: string | undefined;

                        while (userMessages.length < count) {
                            const response = await RestAPI.get({
                                url: Constants.Endpoints.MESSAGES(channelId),
                                query: { limit: 100, ...(lastMessageId && { before: lastMessageId }) }
                            });

                            const messages = response.body;
                            if (!messages?.length) break;

                            for (const msg of messages) {
                                if (msg.author?.id === currentUserId) {
                                    userMessages.push(msg);
                                    if (userMessages.length >= count) break;
                                }
                            }

                            lastMessageId = messages[messages.length - 1].id;
                            if (messages.length < 100) break;
                            await sleep(100);
                        }

                        if (!userMessages.length) return;

                        const purgeInterval = settings.store.purgeInterval || 500;
                        let successCount = 0;

                        for (let i = 0; i < userMessages.length; i++) {
                            if (await silentDeleteMessage(channelId, userMessages[i].id)) successCount++;
                            if (i < userMessages.length - 1) await sleep(purgeInterval);
                        }

                        sendBotMessage(channelId, { content: t("تمّ حذف {count} رسالة بصمت بنجاح.", "Successfully silently deleted {count} message(s).").replace("{count}", successCount.toString()) });
                    } catch (error) {
                        console.error("[SilentDelete] Error during silent purge:", error);
                    }
                })();
            }
        }
    ],

    start() {
        addButton("SilentDelete", msg => {
            const mine = msg.author?.id === UserStore.getCurrentUser()?.id;
            if (!mine || msg.deleted) return null;

            return {
                key: "silent-delete",
                label: t("حذف صامت", "Silent Delete"),
                icon: SilentDeleteIcon,
                message: msg,
                channel: ChannelStore.getChannel(msg.channel_id),
                onClick: () => silentDeleteMessage(msg.channel_id, msg.id)
            };
        }, SilentDeleteIcon);
    },

    stop() {
        removeButton("SilentDelete");
    }
});
