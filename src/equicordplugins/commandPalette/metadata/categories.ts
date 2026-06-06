/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { t } from "@utils/esharqI18n";

import {
    EXTENSIONS_CATALOG_CATEGORY_ID,
    EXTENSIONS_ROOT_CATEGORY_ID,
    HOLY_NOTES_EXTENSION_DETAIL_CATEGORY_ID,
    RANDOM_VOICE_EXTENSION_DETAIL_CATEGORY_ID,
    SCHEDULED_MESSAGES_EXTENSION_DETAIL_CATEGORY_ID,
    SILENT_MESSAGE_TOGGLE_EXTENSION_DETAIL_CATEGORY_ID,
    SILENT_TYPING_EXTENSION_DETAIL_CATEGORY_ID
} from "../extensions/catalog";
import type { CommandCategory } from "../registry";
import {
    TAG_CONTEXT,
    TAG_CORE,
    TAG_CUSTOM,
    TAG_DEVELOPER,
    TAG_FRIENDS,
    TAG_GUILDS,
    TAG_NAVIGATION,
    TAG_PLUGINS,
    TAG_SESSION,
    TAG_UTILITY
} from "./tags";

export const DEFAULT_CATEGORY_ID = "quick-actions";
export const CUSTOM_COMMANDS_CATEGORY_ID = "custom-commands";
export const SESSION_TOOLS_CATEGORY_ID = "session-tools";
export const CONTEXT_PROVIDER_ID = "context-current";
export const CUSTOM_PROVIDER_ID = "custom-commands";
export const TOOLBOX_ACTIONS_CATEGORY_ID = "plugins-settings";
export const TOOLBOX_ACTIONS_PROVIDER_ID = "plugin-toolbox-actions";
export const CHATBAR_ACTIONS_CATEGORY_ID = "plugins-settings";
export const GUILD_CATEGORY_ID = "guilds-actions";
export const FRIENDS_CATEGORY_ID = "friends-actions";
export const PLUGIN_MANAGER_ROOT_COMMAND_ID = "plugins-manager-root";
export const PLUGIN_MANAGER_ENABLE_COMMAND_ID = "plugins-manager-enable";
export const PLUGIN_MANAGER_DISABLE_COMMAND_ID = "plugins-manager-disable";
export const PLUGIN_MANAGER_SETTINGS_COMMAND_ID = "plugins-manager-settings";
export const MENTION_PROVIDER_ID = "mentions-provider";
export const MENTIONS_CATEGORY_ID = "mentions-actions";
export const RECENTS_CATEGORY_ID = "recent-actions";
export const PINNED_CATEGORY_ID = "pinned-actions";

export const CATEGORY_WEIGHTS = new Map<string, number>([
    [DEFAULT_CATEGORY_ID, 100],
    [CONTEXT_PROVIDER_ID, 95],
    [SESSION_TOOLS_CATEGORY_ID, 90],
    ["discord-settings", 90],
    ["updates", 75],
    [CUSTOM_COMMANDS_CATEGORY_ID, 80],
    ["plugins", 45],
    ["plugins-enable", 45],
    ["plugins-disable", 45],
    ["plugins-settings", 45],
    [MENTIONS_CATEGORY_ID, 55],
    [PINNED_CATEGORY_ID, 72],
    [RECENTS_CATEGORY_ID, 70],
    [EXTENSIONS_ROOT_CATEGORY_ID, 60],
    [EXTENSIONS_CATALOG_CATEGORY_ID, 60],
    [SILENT_TYPING_EXTENSION_DETAIL_CATEGORY_ID, 60],
    [RANDOM_VOICE_EXTENSION_DETAIL_CATEGORY_ID, 60],
    [HOLY_NOTES_EXTENSION_DETAIL_CATEGORY_ID, 60],
    [SILENT_MESSAGE_TOGGLE_EXTENSION_DETAIL_CATEGORY_ID, 60],
    [SCHEDULED_MESSAGES_EXTENSION_DETAIL_CATEGORY_ID, 60],
    [GUILD_CATEGORY_ID, 40],
    [FRIENDS_CATEGORY_ID, 40]
]);

export const CATEGORY_GROUP_LABELS = new Map<string | undefined, string>([
    [DEFAULT_CATEGORY_ID, "الإجراءات الأساسية"],
    [CONTEXT_PROVIDER_ID, "الإجراءات الأساسية"],
    [SESSION_TOOLS_CATEGORY_ID, "الإجراءات الأساسية"],
    ["discord-settings", "إعدادات ديسكورد"],
    ["updates", "التحديثات"],
    [CUSTOM_COMMANDS_CATEGORY_ID, "الأوامر المخصصة"],
    ["plugins", "التحكم في الإضافات"],
    ["plugins-enable", "التحكم في الإضافات"],
    ["plugins-disable", "التحكم في الإضافات"],
    ["plugins-settings", "التحكم في الإضافات"],
    [MENTIONS_CATEGORY_ID, "الإشارات"],
    [PINNED_CATEGORY_ID, "الإجراءات الأساسية"],
    [RECENTS_CATEGORY_ID, "الإجراءات الأساسية"],
    [EXTENSIONS_ROOT_CATEGORY_ID, "الإضافات"],
    [EXTENSIONS_CATALOG_CATEGORY_ID, "الإضافات"],
    [SILENT_TYPING_EXTENSION_DETAIL_CATEGORY_ID, "الإضافات"],
    [RANDOM_VOICE_EXTENSION_DETAIL_CATEGORY_ID, "الإضافات"],
    [HOLY_NOTES_EXTENSION_DETAIL_CATEGORY_ID, "الإضافات"],
    [SILENT_MESSAGE_TOGGLE_EXTENSION_DETAIL_CATEGORY_ID, "الإضافات"],
    [SCHEDULED_MESSAGES_EXTENSION_DETAIL_CATEGORY_ID, "الإضافات"],
    [GUILD_CATEGORY_ID, "السيرفرات"],
    [FRIENDS_CATEGORY_ID, "الأصدقاء"]
]);

export const DEFAULT_CATEGORY_WEIGHT = 50;

export const CATEGORY_DEFAULT_TAGS = new Map<string, string[]>([
    [DEFAULT_CATEGORY_ID, [TAG_CORE]],
    [CONTEXT_PROVIDER_ID, [TAG_CONTEXT]],
    [SESSION_TOOLS_CATEGORY_ID, [TAG_SESSION]],
    ["discord-settings", [TAG_NAVIGATION]],
    ["updates", [TAG_DEVELOPER]],
    [CUSTOM_COMMANDS_CATEGORY_ID, [TAG_CUSTOM]],
    ["plugins", [TAG_PLUGINS]],
    ["plugins-enable", [TAG_PLUGINS]],
    ["plugins-disable", [TAG_PLUGINS]],
    ["plugins-settings", [TAG_PLUGINS, TAG_UTILITY]],
    [MENTIONS_CATEGORY_ID, [TAG_NAVIGATION]],
    [PINNED_CATEGORY_ID, [TAG_CORE, TAG_UTILITY]],
    [RECENTS_CATEGORY_ID, [TAG_CORE, TAG_UTILITY]],
    [EXTENSIONS_ROOT_CATEGORY_ID, [TAG_PLUGINS, TAG_UTILITY]],
    [EXTENSIONS_CATALOG_CATEGORY_ID, [TAG_PLUGINS, TAG_UTILITY]],
    [SILENT_TYPING_EXTENSION_DETAIL_CATEGORY_ID, [TAG_PLUGINS, TAG_UTILITY]],
    [RANDOM_VOICE_EXTENSION_DETAIL_CATEGORY_ID, [TAG_PLUGINS, TAG_UTILITY]],
    [HOLY_NOTES_EXTENSION_DETAIL_CATEGORY_ID, [TAG_PLUGINS, TAG_UTILITY]],
    [SILENT_MESSAGE_TOGGLE_EXTENSION_DETAIL_CATEGORY_ID, [TAG_PLUGINS, TAG_UTILITY]],
    [SCHEDULED_MESSAGES_EXTENSION_DETAIL_CATEGORY_ID, [TAG_PLUGINS, TAG_UTILITY]],
    [GUILD_CATEGORY_ID, [TAG_GUILDS]],
    [FRIENDS_CATEGORY_ID, [TAG_FRIENDS]]
]);

export const BUILT_IN_CATEGORIES: CommandCategory[] = [
    {
        id: DEFAULT_CATEGORY_ID,
        label: t("إجراءات سريعة", "Quick Actions"),
        description: t("اختصارات Equicord الشائعة", "Common Equicord shortcuts")
    },
    {
        id: "plugins",
        label: t("الإضافات", "Plugins"),
        description: t("إدارة إضافات Equicord و Vencord", "Manage Equicord and Vencord plugins")
    },
    {
        id: CONTEXT_PROVIDER_ID,
        label: t("السياق الحالي", "Current Context"),
        description: t("إجراءات للقناة والسيرفر المحددَين", "Actions for the currently selected channel and server")
    },
    {
        id: "plugins-enable",
        label: t("تفعيل الإضافة", "Enable Plugin"),
        parentId: "plugins"
    },
    {
        id: "plugins-disable",
        label: t("تعطيل الإضافة", "Disable Plugin"),
        parentId: "plugins"
    },
    {
        id: "plugins-settings",
        label: t("إعدادات الإضافة", "Plugin Settings"),
        parentId: "plugins"
    },
    {
        id: "updates",
        label: t("التحديثات", "Updates"),
        description: t("ابقَ محدّثاً مع Equicord", "Stay up to date with Equicord")
    },
    {
        id: "discord-settings",
        label: t("إعدادات ديسكورد", "Discord Settings"),
        description: t("الانتقال إلى صفحات إعدادات ديسكورد", "Navigate to Discord settings pages")
    },
    {
        id: CUSTOM_COMMANDS_CATEGORY_ID,
        label: t("الأوامر المخصّصة", "Custom Commands"),
        description: t("إدخالات لوحة الأوامر المعرّفة من المستخدم", "User-defined command palette entries")
    },
    {
        id: SESSION_TOOLS_CATEGORY_ID,
        label: t("أدوات الجلسة", "Session Tools"),
        description: t("أدوات لإدارة جلسة ديسكورد", "Tools for managing your Discord session")
    },
    {
        id: GUILD_CATEGORY_ID,
        label: t("الخوادم", "Guilds"),
        description: t("الانتقال السريع إلى سيرفراتك", "Quickly navigate to your servers")
    },
    {
        id: FRIENDS_CATEGORY_ID,
        label: t("الأصدقاء", "Friends"),
        description: t("إرسال رسائل مباشرة سريعة لأصدقائك", "Send quick direct messages to your friends")
    },
    {
        id: PINNED_CATEGORY_ID,
        label: t("الأوامر المُثبَّتة", "Pinned Commands"),
        description: t("الأوامر التي ثبّتها للوصول السريع", "Commands you have pinned for quick access")
    },
    {
        id: MENTIONS_CATEGORY_ID,
        label: t("الإشارات", "Mentions"),
        description: t("الإشارات الأخيرة ورسائل البريد الوارد", "Recent mentions and inbox messages")
    },
    {
        id: RECENTS_CATEGORY_ID,
        label: t("الأوامر الحديثة", "Recent Commands"),
        description: t("الأوامر المنفّذة مؤخراً", "Recently executed commands")
    },
    {
        id: EXTENSIONS_ROOT_CATEGORY_ID,
        label: t("الإضافات الموسّعة", "Extensions"),
        description: t("تثبيت حزم أوامر الإضافات.", "Install plugin command packs.")
    },
    {
        id: EXTENSIONS_CATALOG_CATEGORY_ID,
        label: t("الفهرس", "Catalog"),
        parentId: EXTENSIONS_ROOT_CATEGORY_ID
    },
    {
        id: SILENT_TYPING_EXTENSION_DETAIL_CATEGORY_ID,
        label: "SilentTyping",
        parentId: EXTENSIONS_CATALOG_CATEGORY_ID
    },
    {
        id: RANDOM_VOICE_EXTENSION_DETAIL_CATEGORY_ID,
        label: "RandomVoice",
        parentId: EXTENSIONS_CATALOG_CATEGORY_ID
    },
    {
        id: HOLY_NOTES_EXTENSION_DETAIL_CATEGORY_ID,
        label: "HolyNotes",
        parentId: EXTENSIONS_CATALOG_CATEGORY_ID
    },
    {
        id: SILENT_MESSAGE_TOGGLE_EXTENSION_DETAIL_CATEGORY_ID,
        label: "SilentMessageToggle",
        parentId: EXTENSIONS_CATALOG_CATEGORY_ID
    },
    {
        id: SCHEDULED_MESSAGES_EXTENSION_DETAIL_CATEGORY_ID,
        label: "ScheduledMessages",
        parentId: EXTENSIONS_CATALOG_CATEGORY_ID
    }
];
