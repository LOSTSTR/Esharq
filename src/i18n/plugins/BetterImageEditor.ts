/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "محرّر صور يحفظ صورك السابقة على رفّ ويتيح قصّها",
        "en": "Image editor with shelving for older images and allowing cropping"
    },
    "options": {
        "librarySize": {
            "ar": "عدد الصور المحفوظة على كلّ رفّ",
            "en": "How many pictures to keep on each shelf."
        },
        "rememberCrop": {
            "ar": "استعادة آخر تكبير وموضع استعملتهما لكلّ صورة",
            "en": "Restore the zoom and position you last used for a picture."
        },
        "forgetFraming": {
            "ar": "نسيان كلّ قصّ محفوظ وفتح كلّ صورة كما يفتحها ديسكورد",
            "en": "Drop every remembered crop and open each picture the way Discord would."
        },
        "saveCropped": {
            "ar": "الاحتفاظ بنسخة من كلّ صورة بعد قصّها",
            "en": "Keep a copy of each picture after you crop it."
        },
        "askBeforeSavingCropped": {
            "ar": "السؤال أوّلاً بدل الاحتفاظ بالنسخة المقصوصة تلقائياً",
            "en": "Ask first, instead of keeping the cropped copy automatically."
        },
        "transfer": {
            "ar": "نقل صورك وطريقة قصّ كلّ منها إلى جهاز آخر",
            "en": "Carry your pictures, and how each one is framed, to another device."
        },
        "clearLibrary": {
            "ar": "حذف كلّ الصور التي حفظتها",
            "en": "Throw away every picture you have saved."
        }
    }
});
