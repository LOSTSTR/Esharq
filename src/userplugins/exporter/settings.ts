/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// وحدة مستقلّة للإعدادات كي يقرأها memberList دون أن يستورد index (الذي يستورده بدوره)،
// فلا تنشأ دورة استيراد.

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

// الوصف بالإنجليزية هنا، وترجمته في overlay ‏src/i18n/plugins/Exporter.ts (نهج المستودع).
export const settings = definePluginSettings({
    exportFormat: {
        type: OptionType.SELECT,
        description: "File format used when exporting the member list.",
        options: [
            { label: "JSON", value: "json", default: true },
            { label: "CSV", value: "csv" }
        ]
    }
});
