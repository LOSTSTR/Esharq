/*
 * MicPro — Esharq microphone control panel
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * الأوصاف هنا بالإنجليزية؛ العربية تأتي من overlay (src/i18n/plugins/MicPro.ts).
 * كل الإعدادات مجرّد تفضيلات عرض للوحة — التحكّم الفعلي يُطبَّق حيّاً على محرّك ديسكورد
 * الصوتي الأصلي (MediaEngine)، لا على أي تيار وهمي.
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    autoDeafenOnTest: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Self-deafen while the loopback mic test is active (so you don't hear the channel doubled)"
    }
});
