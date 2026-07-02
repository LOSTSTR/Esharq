/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": { "ar": "يرفع معدّل بت صوت المكالمات فوق الافتراضي ويفكّ قيد شريط تأخير إطلاق زرّ التحدّث فوق حدّ الثانيتين.", "en": "Extends voice chat audio bitrate beyond Discord's default and unlocks the push-to-talk release delay slider above its 2-second cap." },
    "options": {
        "voiceBitrateKbps": { "ar": "معدّل بت ترميز صوت المكالمة بالكيلوبت/ث. الافتراضي 64. القيم الأعلى تحسّن الجودة وتستهلك نطاقاً أكثر." },
        "pttDelayMax": { "ar": "أقصى تأخير لإطلاق زرّ التحدّث بالمللي ثانية. الحد الأقصى الافتراضي 2000." }
    }
});
