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
    },
    // Persisted processing intent (echo / AGC / noise / VAD threshold). Hidden from the
    // settings page (OptionType.CUSTOM) — it's driven by the panel, not the settings UI.
    // MicPro owns this because Discord's per-connection audio setters don't update the
    // MediaEngineStore getters, so the store can't be the source of truth for these.
    procState: {
        type: OptionType.CUSTOM,
        description: "",
        default: null as null | {
            echo: boolean;
            agc: boolean;
            noiseMode: "none" | "standard" | "krisp";
            vadThreshold: number;
        }
    }
});
