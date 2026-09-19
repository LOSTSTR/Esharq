/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";
import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { BanRiskWarning } from "@utils/esharqBanWarning";
import { t } from "@utils/esharqI18n";
import { sleep } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, Constants, Menu, React, RestAPI, UserStore } from "@webpack/common";

/**
 * 🔴 كانت `/silentpurge` تُكمل بعد إطفاء الإضافة. الأمر يجلب حتى ١٠٠ رسالة ثمّ يحذف
 * بفاصل `purgeInterval` (٥٠٠ مللي افتراضاً) ⇒ قد يبقى يعمل نحو خمسين ثانية، وكلّ دورة
 * **تُعدّل ثمّ تحذف رسالةً حقيقيّة** عبر واجهة ديسكورد. وهذه إضافة فيها خطر حظر، فـ«أطفأتُها
 * وظلّت تعمل» سلوكٌ لا يُقبل. والإضافة تصريحيّة بلا `start`/`stop`، فأُضيفا لهذا الغرض.
 */
let active = false;
/** 🔴 بلا هذا كان أمر الحذف الصامت يُشغَّل مرّتين معاً، فيتضاعف معدّل الطلبات الذي وُجد الفاصل ليحدّه. */
let purgeRunning = false;

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
        default: 200,
        isValid: (v: number) => (Number.isFinite(v) && v >= 50) || t("أقلّ قيمة مسموحة ٥٠ مللي ثانية.", "The minimum allowed value is 50 ms.")
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
        default: 500,
        // 🔴 كان صفرٌ يُكتب هنا فيُستبدَل صامتاً بـ٥٠٠ (احتياطيّ بالصدق لا بالغياب)، فيظنّ
        // المستخدم أنّ إعداده يعمل. الأرضيّة تُقال له بدل أن تُتجاهَل قيمته.
        isValid: (v: number) => (Number.isFinite(v) && v >= 100) || t("أقلّ قيمة مسموحة ١٠٠ مللي ثانية.", "The minimum allowed value is 100 ms.")
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
    tags: ["Chat", "Privacy"],
    dependencies: ["MessagePopoverAPI", "CommandsAPI"],
    settings,
    contextMenus: {
        "message": messageContextMenuPatch
    },

    start() { active = true; },
    stop() { active = false; },

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

                if (purgeRunning) {
                    sendBotMessage(channelId, { content: t("هناك عمليّة حذفٍ صامت تعمل الآن — انتظر انتهاءها.", "A silent purge is already running — wait for it to finish.") });
                    return;
                }
                purgeRunning = true;

                (async () => {
                    try {
                        const userMessages: any[] = [];
                        let lastMessageId: string | undefined;
                        // 🔴 كانت الحلقة تمشي إلى أوّل القناة بلا حدّ: طلبُ مئة رسالة في قناةٍ
                        // ضخمة لا يملك فيها المستخدم إلّا القليل يتحوّل إلى دقائق من الطلبات
                        // الصامتة. عشر صفحات (ألف رسالة) أبعد ممّا يحتاجه حدّ الأمر.
                        const MAX_PAGES = 10;
                        let pages = 0;

                        while (userMessages.length < count && pages++ < MAX_PAGES) {
                            if (!active) return;
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

                        if (!userMessages.length) {
                            sendBotMessage(channelId, { content: t("لم أجد رسائل لك في هذه القناة.", "I found no messages of yours in this channel.") });
                            return;
                        }

                        const purgeInterval = settings.store.purgeInterval || 500;
                        let successCount = 0;

                        let stopped = false;
                        for (let i = 0; i < userMessages.length; i++) {
                            if (!active) { stopped = true; break; }
                            if (await silentDeleteMessage(channelId, userMessages[i].id)) successCount++;
                            if (i < userMessages.length - 1) await sleep(purgeInterval);
                        }

                        const failed = (stopped ? 0 : userMessages.length) - successCount;
                        sendBotMessage(channelId, {
                            content: stopped
                                ? t("أُوقف الحذف الصامت لأنّ الإضافة عُطّلت — حُذفت {count} رسالة قبل التوقّف.", "Silent purge stopped because the plugin was disabled — {count} message(s) were deleted before it stopped.").replace("{count}", successCount.toString())
                                // 🔴 كان يُعلن النجاح ويبتلع الفشل: رسالةٌ استُبدلت بالنصّ النائب ثمّ
                                // لم تُحذف تبقى ظاهرةً للجميع بذلك النصّ، ولا يُخبَر صاحبها.
                                : failed > 0
                                    ? t("حُذفت {count} رسالة، وتعذّر حذف {failed} — قد تكون ظاهرةً الآن بنصّ الاستبدال.", "Deleted {count} message(s); {failed} could not be deleted and may now be visible with the placeholder text.").replace("{count}", successCount.toString()).replace("{failed}", failed.toString())
                                    : t("تمّ حذف {count} رسالة بصمت بنجاح.", "Successfully silently deleted {count} message(s).").replace("{count}", successCount.toString())
                        });
                    } catch (error) {
                        console.error("[SilentDelete] Error during silent purge:", error);
                        sendBotMessage(channelId, { content: t("توقّف الحذف الصامت بخطأ — التفاصيل في سجلّ المطوّر.", "The silent purge stopped with an error — details are in the developer console.") });
                    } finally {
                        purgeRunning = false;
                    }
                })();
            }
        }
    ],

    // الواجهة التصريحية بدل `addMessagePopoverButton` المهجورة: تُسجَّل من كائن
    // الإضافة فتظهر في إعدادات عناصر الواجهة ويستطيع المستخدم إخفاءها، ويسقط
    // `start`/`stop` اليدويّان.
    messagePopoverButton: {
        icon: SilentDeleteIcon,
        render(msg) {
            const mine = msg.author?.id === UserStore.getCurrentUser()?.id;
            if (!mine || msg.deleted) return null;

            return {
                label: t("حذف صامت", "Silent Delete"),
                icon: SilentDeleteIcon,
                message: msg,
                channel: ChannelStore.getChannel(msg.channel_id),
                onClick: () => silentDeleteMessage(msg.channel_id, msg.id)
            };
        }
    }
});
