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
    // المفتاح الرئيسي لمختبر الصوت: حين يُطفأ لا نفرض شيئاً على المكالمات
    // الجديدة وتبقى إعدادات ديسكورد نفسها هي الحاكمة. لا يُخفى من صفحة
    // الإضافات كي يبقى الإطفاء ممكناً حتى لو لم يفتح المستخدم المختبر.
    applyToCalls: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Apply your Voice Lab settings to every call. When off, Discord's own audio settings take over."
    },
    autoDeafenOnTest: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Self-deafen while the loopback mic test is active (so you don't hear the channel doubled)"
    },
    // Whether the user has slid the "external tools" gate open. Persisted so the
    // warning is read once, not on every visit; OptionType.CUSTOM keeps it out of
    // the settings page — it is a record of consent, not a knob to flip there.
    externalToolsUnlocked: {
        type: OptionType.CUSTOM,
        description: "",
        default: false
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
