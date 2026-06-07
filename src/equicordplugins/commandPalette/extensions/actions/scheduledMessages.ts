/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled, plugins } from "@api/PluginManager";
import { toggleEnabled } from "@equicordplugins/equicordHelper/utils";
import { openViewScheduledModal } from "@equicordplugins/scheduledMessages/components/ViewScheduledModal";
import { t } from "@utils/esharqI18n";
import { Toasts } from "@webpack/common";

import { DEFAULT_CATEGORY_ID } from "../../metadata/categories";
import { TAG_NAVIGATION, TAG_PLUGINS, TAG_UTILITY } from "../../metadata/tags";
import type { CommandEntry } from "../../registry";
import { createCommandPageCommand } from "../../ui/pages/createCommandPageCommand";
import type { ScheduledMessagesPlugin } from "../types";

function showToast(message: string, type: (typeof Toasts.Type)[keyof typeof Toasts.Type]) {
    Toasts.show({ message, type, id: Toasts.genId(), options: { position: Toasts.Position.BOTTOM } });
}

function getScheduledMessagesPlugin(): ScheduledMessagesPlugin | null {
    const plugin = plugins.ScheduledMessages as ScheduledMessagesPlugin | undefined;
    return plugin ?? null;
}

async function ensureScheduledMessagesPluginEnabled() {
    const plugin = getScheduledMessagesPlugin();
    if (!plugin) {
        showToast(t("إضافة ScheduledMessages غير متاحة.", "ScheduledMessages plugin is unavailable."), Toasts.Type.FAILURE);
        return false;
    }

    if (isPluginEnabled(plugin.name)) return true;

    const success = await toggleEnabled(plugin.name);
    if (!success || !isPluginEnabled(plugin.name)) {
        showToast(t("فشل تفعيل ScheduledMessages.", "Failed to enable ScheduledMessages."), Toasts.Type.FAILURE);
        return false;
    }

    showToast(t("تمّ تفعيل ScheduledMessages.", "Enabled ScheduledMessages."), Toasts.Type.SUCCESS);
    return true;
}

async function runOpenScheduledMessages() {
    if (!await ensureScheduledMessagesPluginEnabled()) return;
    openViewScheduledModal();
}

export function createScheduledMessagesExtensionCommands(): CommandEntry[] {
    return [
        {
            id: "extension-scheduled-messages-open",
            label: t("فتح الرسائل المجدولة", "Open Scheduled Messages"),
            description: t("فتح نافذة الرسائل المجدولة.", "Open the scheduled messages window."),
            keywords: ["scheduled", "messages", "schedule", "queue", "open", "plugin", "extension"],
            categoryId: DEFAULT_CATEGORY_ID,
            tags: [TAG_PLUGINS, TAG_UTILITY, TAG_NAVIGATION],
            handler: runOpenScheduledMessages
        },
        createCommandPageCommand({
            id: "extension-scheduled-messages-create",
            label: t("إنشاء رسالة مجدولة", "Create Scheduled Message"),
            description: t("إنشاء رسالة مجدولة من حقول منفصلة.", "Create a scheduled message from separate fields."),
            keywords: ["create", "scheduled", "message", "channel", "time", "plugin", "extension"],
            categoryId: DEFAULT_CATEGORY_ID,
            tags: [TAG_PLUGINS, TAG_UTILITY],
            page: { id: "scheduled-create" }
        }),
        {
            id: "extension-scheduled-messages-quick-schedule-query",
            label: t("جدولة سريعة", "Quick Schedule"),
            description: t("جدولة رسالة من مدخل نصي طبيعي.", "Schedule a message from a natural language input."),
            keywords: ["schedule", "message", "quick", "delay", "time", "channel", "plugin", "extension"],
            categoryId: DEFAULT_CATEGORY_ID,
            tags: [TAG_PLUGINS, TAG_UTILITY],
            closeAfterExecute: true,
            queryTemplate: "schedule ",
            queryPlaceholder: "Message at time, optional channel",
            handler: () => undefined
        },
        {
            id: "extension-scheduled-messages-reschedule-query",
            label: t("إعادة جدولة الرسالة", "Reschedule Message"),
            description: t("إعادة جدولة رسالة في قائمة الانتظار.", "Reschedule a message in the queue."),
            keywords: ["reschedule", "scheduled", "message", "queue", "time", "plugin", "extension"],
            categoryId: DEFAULT_CATEGORY_ID,
            tags: [TAG_PLUGINS, TAG_UTILITY],
            closeAfterExecute: true,
            queryTemplate: "reschedule ",
            queryPlaceholder: "Select scheduled message, then new time",
            handler: () => undefined
        },
        {
            id: "extension-scheduled-messages-send-now-query",
            label: t("إرسال الرسالة المجدولة الآن", "Send Scheduled Message Now"),
            description: t("إرسال رسالة مجدولة في قائمة الانتظار فوراً.", "Send a queued scheduled message immediately."),
            keywords: ["send", "now", "scheduled", "message", "queue", "plugin", "extension"],
            categoryId: DEFAULT_CATEGORY_ID,
            tags: [TAG_PLUGINS, TAG_UTILITY],
            closeAfterExecute: true,
            queryTemplate: "send now ",
            queryPlaceholder: "Select scheduled message",
            handler: () => undefined
        },
        {
            id: "extension-scheduled-messages-cancel-query",
            label: t("إلغاء الرسالة المجدولة", "Cancel Scheduled Message"),
            description: t("إلغاء رسالة مجدولة في قائمة الانتظار.", "Cancel a queued scheduled message."),
            keywords: ["cancel", "delete", "remove", "scheduled", "message", "queue", "plugin", "extension"],
            categoryId: DEFAULT_CATEGORY_ID,
            tags: [TAG_PLUGINS, TAG_UTILITY],
            closeAfterExecute: true,
            queryTemplate: "cancel scheduled ",
            queryPlaceholder: "Select scheduled message",
            handler: () => undefined
        }
    ];
}
