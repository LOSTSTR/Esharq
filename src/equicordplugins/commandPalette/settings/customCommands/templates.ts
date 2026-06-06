/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { t } from "@utils/esharqI18n";

import type { CustomCommandDefinition } from "../../registry";
import type { CommandTemplateId } from "./types";

export interface TemplateConfig {
    id: CommandTemplateId;
    label: string;
    description: string;
    apply(command: CustomCommandDefinition): CustomCommandDefinition;
}

export const TEMPLATE_CONFIGS: TemplateConfig[] = [
    {
        id: "command",
        label: t("اسم مستعار", "Alias"),
        description: t("تشغيل أمر آخر من لوحة الأوامر.", "Run another command from the command palette."),
        apply: command => ({
            ...command,
            action: { type: "command", commandId: "" }
        })
    },
    {
        id: "settings",
        label: t("فتح صفحة الإعدادات", "Open Settings Page"),
        description: t("الانتقال مباشرةً إلى صفحة إعدادات ديسكورد.", "Navigate directly to a Discord settings page."),
        apply: command => ({
            ...command,
            action: { type: "settings", route: "My Account" }
        })
    },
    {
        id: "url",
        label: t("رابط سريع", "Quicklink"),
        description: t("فتح رابط في ديسكورد أو خارجياً.", "Open a link in Discord or externally."),
        apply: command => ({
            ...command,
            action: { type: "url", url: "https://", openExternal: true }
        })
    },
    {
        id: "macro",
        label: t("تسلسل", "Sequence"),
        description: t("تشغيل أوامر متعددة بالترتيب.", "Run multiple commands in sequence."),
        apply: command => ({
            ...command,
            action: { type: "macro", steps: [] }
        })
    }
];

export function getTemplateByActionType(actionType: CommandTemplateId): TemplateConfig {
    return TEMPLATE_CONFIGS.find(template => template.id === actionType) ?? TEMPLATE_CONFIGS[0];
}
