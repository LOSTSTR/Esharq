/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "نسخ الرسائل الصوتية على الجهاز مباشرةً بواسطة Whisper v3",
        "en": "Transcribes voice messages on-device using Whisper v3."
    },
    "options": {
        "selectedModel": {
            "ar": "حجم النموذج",
            "en": "Whisper model size.",
            "choices": {
                "Xenova/whisper-tiny": { "ar": "صغير جداً (الأسرع، أقل دقّة)", "en": "Tiny (Fastest, lowest accuracy)" },
                "Xenova/whisper-base": { "ar": "أساسي (موصى به)", "en": "Base (Recommended)" },
                "Xenova/whisper-small": { "ar": "صغير", "en": "Small" },
                "Xenova/whisper-medium": { "ar": "متوسط (الأبطأ، أفضل دقّة)", "en": "Medium (Slowest, best accuracy)" }
            }
        },
        "quantized": {
            "ar": "استخدام النموذج المضغوط (حجم أصغر، دقة أقل قليلاً)",
            "en": "Use the quantized (compressed) model (smaller size, slightly lower accuracy)."
        }
    }
});
