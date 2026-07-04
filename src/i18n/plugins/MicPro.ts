/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "لوحة تحكّم واحدة للميكروفون في شريط الصوت: مقياس مستوى حيّ، كسب، إلغاء ضوضاء (بلا/قياسي/Krisp)، إلغاء صدى، AGC، وحساسية كشف الصوت — كلها على محرّك ديسكورد الأصلي فتؤثّر على ما يسمعه الآخرون — بالإضافة إلى اختبار loopback حقيقي ونقل ستيريو عالي الجودة (bitrate أعلى/ستيريو).",
        "en": "One microphone control panel in the voice bar: live level meter, gain, noise reduction (None/Standard/Krisp), echo cancellation, AGC, and voice sensitivity — all on Discord's native engine so they affect what others hear — plus a real loopback test and high-quality stereo transmission (higher Opus bitrate/stereo)."
    },
    "options": {
        "autoDeafenOnTest": {
            "ar": "كتم السماع تلقائياً أثناء اختبار الميكروفون (كي لا تسمع القناة مزدوجة)",
            "en": "Self-deafen while the loopback mic test is active (so you don't hear the channel doubled)"
        }
    }
});
