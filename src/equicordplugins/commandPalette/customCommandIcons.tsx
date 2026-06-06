/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CogWheel, CopyIcon, LinkIcon, MainSettingsIcon, NotesIcon, PluginIcon, RestartIcon } from "@components/Icons";
import { t } from "@utils/esharqI18n";
import type { ComponentType } from "react";

type IconComponent = ComponentType<{ className?: string; size?: string; height?: number; width?: number; }>;

export type CustomCommandIconId =
    | "auto"
    | "alias"
    | "quicklink"
    | "sequence"
    | "settings"
    | "notes"
    | "plugin"
    | "gear";

interface CustomCommandIconMeta {
    id: CustomCommandIconId;
    label: string;
    icon: IconComponent;
}

const CUSTOM_COMMAND_ICON_META: CustomCommandIconMeta[] = [
    { id: "auto", label: t("تلقائي", "Auto"), icon: CogWheel },
    { id: "alias", label: t("اسم مستعار", "Alias"), icon: CopyIcon },
    { id: "quicklink", label: t("رابط سريع", "Quicklink"), icon: LinkIcon },
    { id: "sequence", label: t("تسلسل", "Sequence"), icon: RestartIcon },
    { id: "settings", label: t("الإعدادات", "Settings"), icon: MainSettingsIcon },
    { id: "notes", label: t("ملاحظات", "Notes"), icon: NotesIcon },
    { id: "plugin", label: t("إضافة", "Plugin"), icon: PluginIcon },
    { id: "gear", label: t("ترس", "Gear"), icon: CogWheel }
];

const CUSTOM_COMMAND_ICON_MAP = new Map<CustomCommandIconId, IconComponent>(
    CUSTOM_COMMAND_ICON_META.map(item => [item.id, item.icon])
);

const CUSTOM_COMMAND_ICON_ID_SET = new Set<CustomCommandIconId>(
    CUSTOM_COMMAND_ICON_META.map(item => item.id)
);

export function isCustomCommandIconId(value: unknown): value is CustomCommandIconId {
    return typeof value === "string" && CUSTOM_COMMAND_ICON_ID_SET.has(value as CustomCommandIconId);
}

export function getCustomCommandIconMetaList() {
    return CUSTOM_COMMAND_ICON_META;
}

export function resolveCustomCommandDefaultIconId(actionType: "command" | "settings" | "url" | "macro"): Exclude<CustomCommandIconId, "auto"> {
    switch (actionType) {
        case "command":
            return "alias";
        case "url":
            return "quicklink";
        case "macro":
            return "sequence";
        case "settings":
            return "settings";
        default:
            return "gear";
    }
}

export function getCustomCommandIconById(iconId: CustomCommandIconId): IconComponent {
    return CUSTOM_COMMAND_ICON_MAP.get(iconId) ?? CogWheel;
}
