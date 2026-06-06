/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { t } from "@utils/esharqI18n";
import { TextInput } from "@webpack/common";

import type { CustomCommandDefinition } from "../../../registry";

interface BasicsStepProps {
    command: CustomCommandDefinition;
    onChange(next: CustomCommandDefinition): void;
}

export function BasicsStep({ command, onChange }: BasicsStepProps) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <TextInput
                label={t("اسم الأمر", "Command Name")}
                value={command.label}
                placeholder="e.g. Open Team Notes"
                onChange={value => onChange({ ...command, label: value })}
            />
            <TextInput
                label={t("الوصف (اختياري)", "Description (optional)")}
                value={command.description ?? ""}
                placeholder={t("عنوان فرعي قصير يظهر في اللوحة", "Short subtitle shown in palette")}
                onChange={value => onChange({ ...command, description: value })}
            />
        </div>
    );
}
