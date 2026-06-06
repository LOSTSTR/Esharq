/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    showChatButton: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("عرض زر الدردشة في لوحة الصوت", "Show the chat button in the voice panel"),
        restartNeeded: true,
    },
    showMuteButton: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("هل تريد إظهار زر كتم الصوت", "Whether to show the mute button"),
        restartNeeded: true,
    },
    showDeafenButton: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("هل تريد إظهار زر إخراس الصوت", "Whether to show the deafen button"),
        restartNeeded: true,
    },
    muteSoundboard: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("تبديل لوحة الأصوات عند النقر على زر الإخراس.", "Toggle soundboard when clicking the deafen button."),
    },
    disableVideo: {
        type: OptionType.BOOLEAN,
        default: true,
        description: t("تعطيل الفيديو عند النقر على زر الإخراس.", "Disable video when clicking the deafen button."),
    },
    useServer: {
        type: OptionType.BOOLEAN,
        description: t("استخدام كتم/إخراس السيرفر بدلاً من المحلي عند توفر الصلاحية.", "Use server mute/deafen instead of local when you have the permission."),
        default: false,
    },
    serverSelf: {
        type: OptionType.BOOLEAN,
        description: t("إخراس/كتم نفسك في السيرفر عند استخدام أزرار الكتم/الإخراس.", "Server deafen/mute yourself when using the mute/deafen buttons."),
        default: false,
    },
    showButtonsSelf: {
        type: OptionType.SELECT,
        description: t("هل تريد إظهار الأزرار لمستخدمك الخاص. نفس وظيفة الأزرار الأخرى لكنها ستفتح لوحة الرسائل المباشرة وتكتم/تخرس نفسك.", "Whether to show buttons for your own user. Same functionality as other buttons but will open the DM panel and mute/deafen yourself."),
        restartNeeded: true,
        options: [
            { label: t("العرض", "Display"), value: "display", default: true },
            { label: t("إخفاء", "Hide"), value: "hide" },
            { label: t("تعطيل", "Disable"), value: "disable" },
        ],
    },
    whichNameToShow: {
        type: OptionType.SELECT,
        description: t("اختر إظهار الاسم المستعار أو اسم المستخدم في التلميح.", "Choose to show the nickname or username in the tooltip."),
        options: [
            { label: t("كلاهما", "Both"), value: "both", default: true },
            { label: t("الاسم العام", "Global Name"), value: "global" },
            { label: t("اسم المستخدم", "Username"), value: "username" },
        ],
    },
    buttonPosition: {
        type: OptionType.SELECT,
        description: t("اختر مكان وضع أزرار الصوت في صف مستخدم الصوت.", "Choose where to place voice buttons in the voice user row."),
        options: [
            { label: t("يسار", "Left"), value: "left", default: true },
            { label: t("يمين", "Right"), value: "right" },
        ],
    }
}, {
    useServer: {
        disabled() {
            return !this.store.showMuteButton && !this.store.showDeafenButton;
        },
    },
    serverSelf: {
        disabled() {
            return !this.store.useServer && !this.store.showMuteButton && !this.store.showDeafenButton;
        },
    }
});
