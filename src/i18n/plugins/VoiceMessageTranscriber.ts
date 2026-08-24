/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "نسخ الرسائل الصوتية نصّاً على الجهاز مباشرةً بواسطة Whisper v3",
        "en": "On-device transcriptions for voice messages powered by Whisper v3"
    },
    "options": {
        "embed": {
            "ar": "اعرض النسخ النصّي داخل مرفق الرسالة الصوتية مباشرةً بدل نافذةٍ منبثقة.",
            "en": "Display transcription directly in the voice message attachment instead of a modal."
        },
        "maintainHorizontal": {
            "ar": "أبقِ العرض الأفقي لصندوق النسخ المُضمَّن ووسّعه عمودياً.",
            "en": "Maintain horizontal size for the embedded transcription box and expand vertically."
        },
        "selectedModel": {
            "ar": "حجم النموذج",
            "en": "Model size.",
            "choices": {
                "Xenova/whisper-tiny": { "ar": "صغير جداً (الأسرع، أقل دقّة)", "en": "Tiny (Fastest, lowest accuracy)" },
                "Xenova/whisper-base": { "ar": "أساسي (موصى به)", "en": "Base (Recommended)" },
                "Xenova/whisper-small": { "ar": "صغير", "en": "Small" },
                "Xenova/whisper-medium": { "ar": "متوسط (الأبطأ، أفضل دقّة)", "en": "Medium (Slowest, best accuracy)" }
            }
        },
        "quantized": {
            "ar": "استخدام النموذج المضغوط (حجم أصغر، دقّة أقل قليلاً).",
            "en": "Use quantized models (smaller size, slight quality loss)."
        },
        "deleteModalFiles": {
            "ar": "احذف الملفّات المخزَّنة مؤقّتاً من التخزين.",
            "en": "Delete cached files from storage."
        }
    }
});
