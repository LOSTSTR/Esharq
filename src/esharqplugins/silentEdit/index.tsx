/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { addMessagePopoverButton as addButton, removeMessagePopoverButton as removeButton } from "@api/MessagePopover";
import { definePluginSettings } from "@api/Settings";
import { BanRiskWarning } from "@utils/esharqBanWarning";
import { t } from "@utils/esharqI18n";
import { sleep } from "@utils/misc";
import definePlugin, { OptionType } from "@utils/types";
import { MessageFlags, MessageType } from "@vencord/discord-types/enums";
import { findByPropsLazy } from "@webpack";
import { ChannelStore, Constants, Menu, React, RestAPI, showToast, Toasts, UserStore } from "@webpack/common";

const MessageActions = findByPropsLazy("deleteMessage", "startEditMessage");

/**
 * شرطٌ واحد لمدخلَي «التعديل الصامت» (زرّ الشريط وقائمة السياق) فلا يفترقان.
 *
 * 🔴 التعديل الصامت **يُرسل رسالةً جديدة ثمّ يحذف الأصليّة**، فكلّ حالةٍ لا يصحّ فيها
 * الحذف يبقى فيها الإرسال — وينشر المستخدم شيئاً بلا قصد:
 *  • `msg.deleted`: شبحٌ يُبقيه سجلّ الرسائل ظاهراً. كان الزرّ يظهر عليه (وقائمة
 *    السياق تستثنيه)، فينجح الإرسال ويفشل الحذف ٤٠٤.
 *  • `state !== "SENT"`: ما زالت في الطريق، ومعرّفها محلّيّ مؤقّت.
 *  • 🔴 وما لا يستطيع نصُّنا إعادة بنائه **يُفقد إلى الأبد**: المرفقات والملصقات
 *    والاستطلاع والرسائل المُعاد توجيهها والصوتيّة. الطلب الذي نرسله نصٌّ خالص
 *    (انظر `sendMessage` أدناه) ثمّ تُحذف الأصليّة من الخادم بلا رجعة — فصورةٌ
 *    يُعدَّل تعليقها كانت تختفي نهائياً. لا يُعرض الزرّ عليها أصلاً.
 */
function canSilentEdit(msg: any): boolean {
    if (!msg || msg.author?.id !== UserStore.getCurrentUser()?.id) return false;
    if (msg.deleted || msg.state !== "SENT") return false;
    if (![MessageType.DEFAULT, MessageType.REPLY].includes(msg.type)) return false;
    if (msg.hasFlag?.(MessageFlags.IS_VOICE_MESSAGE)) return false;
    if (msg.attachments?.length || msg.stickerItems?.length || msg.poll) return false;
    if (msg.messageSnapshots?.length || msg.messageReference?.type) return false;
    return true;
}

/**
 * 🔴 كان الخطّاف يُركَّب على `editMessage` **مع كلّ نقرة** ويُفكّ عند أوّل نداءٍ أيّاً
 * كان صاحبه، و`stop()` لا يُعيده أبداً. فمن فتح تعديلاً صامتاً ثمّ **ألغاه** يبقى
 * الخطّاف مسلّحاً، فإذا عدّل تلك الرسالة تعديلاً عاديّاً بعد حين حُوّل تعديله بصمت إلى
 * حذفٍ وإعادة نشرٍ في آخر القناة. يُركَّب الآن **مرّةً واحدة**، ولا يلتقط إلّا الرسالة
 * التي سلّحته بعينها، ويُفكّ عند إيقاف الإضافة.
 */
let pendingSilentEdit: { channelId: string; messageId: string; messageReference?: any; } | null = null;
let originalEditMessage: ((...args: any[]) => any) | null = null;
let ourEditMessage: ((...args: any[]) => any) | null = null;

function installEditHook() {
    if (ourEditMessage) return;
    originalEditMessage = MessageActions.editMessage;
    ourEditMessage = async function (this: any, channelId: string, messageId: string, content: any) {
        const target = pendingSilentEdit;
        pendingSilentEdit = null;

        if (!target || target.channelId !== channelId || target.messageId !== messageId)
            return originalEditMessage!.call(this, channelId, messageId, content);

        try {
            await sendMessage(content.content, messageId, channelId, settings.store.suppressNotifications, target.messageReference);
        } catch (error) {
            console.error("[SilentEdit] send failed:", error);
            showToast(t("تعذّر إرسال النسخة الجديدة، ولم تُحذف رسالتك الأصليّة.", "Could not send the new copy, so your original message was not deleted."), Toasts.Type.FAILURE);
            return;
        }

        if (!settings.store.deleteOriginalMessage) return;
        await sleep(settings.store.deleteDelay);
        try {
            await deleteMessage(channelId, messageId);
        } catch (error) {
            console.error("[SilentEdit] delete failed:", error);
            showToast(t("أُرسلت النسخة الجديدة لكن تعذّر حذف الأصليّة — الرسالتان ظاهرتان الآن.", "The new copy was sent but the original could not be deleted — both messages are now visible."), Toasts.Type.FAILURE);
        }
    };
    MessageActions.editMessage = ourEditMessage;
}

function uninstallEditHook() {
    // لا يُعاد الأصل إلّا إن كان خطّافنا هو القائم — كي لا نمحو خطّاف إضافةٍ أخرى رُكّب بعدنا.
    if (originalEditMessage && MessageActions.editMessage === ourEditMessage) MessageActions.editMessage = originalEditMessage;
    originalEditMessage = null;
    ourEditMessage = null;
    pendingSilentEdit = null;
}

// Shared silent-edit trigger — used by both the hover-toolbar button and the right-click menu.
function triggerSilentEdit(msg: any) {
    pendingSilentEdit = { channelId: msg.channel_id, messageId: msg.id, messageReference: msg.messageReference };
    MessageActions.startEditMessage(msg.channel_id, msg.id, msg.content);
}

const settings = definePluginSettings({
    warning: {
        type: OptionType.COMPONENT,
        component: () => <BanRiskWarning
            ar="تحذير: التعديل الصامت وتجاوز سجلّ الرسائل قد يخالف شروط خدمة Discord ويعرّض حسابك للحظر. استخدمها بمسؤولية."
            en="Warning: silently editing and bypassing the message logger may violate Discord's Terms of Service and could get your account banned. Use responsibly."
        />,
    },
    deleteOriginalMessage: {
        type: OptionType.BOOLEAN,
        description: t("حذف الرسالة الأصلية من الخادم بعد التعديل الصامت. إذا عُطّل، ستعود الرسالة الأصلية بعد إعادة تحميل العميل.", "Delete the original server-side message after silent edit. If disabled, the original message will reappear after client reload."),
        default: true
    },
    deleteDelay: {
        type: OptionType.NUMBER,
        description: t("التأخير (بالمللي ثانية) قبل حذف الرسالة الأصلية إذا فُعّل.", "Delay (in milliseconds) before deleting the original message if enabled."),
        default: 500
    },
    suppressNotifications: {
        type: OptionType.BOOLEAN,
        description: t("يُنصح به في الرسائل الخاصة لتجنّب تنبيه المستخدمين.", "Recommended for use in DMs to prevent pinging users."),
        default: false
    },
    accentColor: {
        type: OptionType.STRING,
        description: t("لون أيقونة التعديل الصامت (رمز hex).", "Accent color for the Silent Edit icon (hex code)."),
        default: "#ed4245"
    }
});

const getAccentColor = () => settings.store.accentColor || "#ed4245";

// Accepts + spreads Discord's popover props so the button renders, and sets the colour via
// inline `style` (beats Discord's `fill: currentColor` CSS) so it shows in accent red.
const SilentEditIcon = ({ width = 18, height = 18, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg width={width} height={height} viewBox="0 0 24 24" {...props} style={{ fill: getAccentColor(), ...props.style }}>
        <path d="M19.2929 9.8299L19.9409 9.18278C21.353 7.77064 21.353 5.47197 19.9409 4.05892C18.5287 2.64678 16.2292 2.64678 14.817 4.05892L14.1699 4.70694L19.2929 9.8299ZM12.8962 5.97688L5.18469 13.6906L10.3085 18.813L18.0201 11.0992L12.8962 5.97688ZM4.11851 20.9704L8.75906 19.8112L4.18692 15.239L3.02678 19.8796C2.95028 20.1856 3.04028 20.5105 3.26349 20.7337C3.48669 20.9569 3.8116 21.046 4.11851 20.9704Z" />
    </svg>
);

function sendMessage(content: string, nonce: string, channelId: string, suppressNotifications: boolean, messageReference?: any) {
    const body: any = {
        content,
        flags: suppressNotifications ? 4096 : 0,
        mobile_network_type: "unknown",
        nonce,
        tts: false,
    };

    if (messageReference) {
        body.message_reference = {
            channel_id: messageReference.channel_id,
            message_id: messageReference.message_id,
            guild_id: messageReference.guild_id
        };
    }

    return RestAPI.post({
        url: Constants.Endpoints.MESSAGES(channelId),
        body
    });
}

function deleteMessage(channelId: string, messageId: string) {
    return RestAPI.del({
        url: Constants.Endpoints.MESSAGE(channelId, messageId)
    });
}

// Right-click menu entry (own messages), so Silent Edit is reachable without the toolbar.
const messageContextMenuPatch: NavContextMenuPatchCallback = (children, { message }) => {
    if (!canSilentEdit(message)) return;

    const group = findGroupChildrenByChildId("edit", children) ?? children;
    group.push(
        <Menu.MenuItem
            id="silent-edit-msg"
            label={<span style={{ color: getAccentColor() }}>{t("تعديل صامت", "Silent Edit")}</span>}
            action={() => triggerSilentEdit(message)}
            icon={SilentEditIcon}
        />
    );
};

export default definePlugin({
    name: "SilentEdit",
    description: "\"Silently\" edit a message without showing the edit tag and bypass Vencord's message logger.",
    authors: [{ name: "Aurick", id: 1348025017233047634n }],
    tags: ["Chat", "Privacy"],
    dependencies: ["MessagePopoverAPI"],
    settings,
    contextMenus: {
        "message": messageContextMenuPatch
    },
    start() {
        installEditHook();
        addButton("SilentEdit", msg => {
            if (!canSilentEdit(msg)) return null;

            return {
                key: "silent-edit",
                label: t("تعديل صامت", "Silent Edit"),
                icon: SilentEditIcon,
                message: msg,
                channel: ChannelStore.getChannel(msg.channel_id),
                onClick: () => triggerSilentEdit(msg)
            };
        }, SilentEditIcon);
    },

    stop() {
        removeButton("SilentEdit");
        uninstallEditHook();
    }
});
