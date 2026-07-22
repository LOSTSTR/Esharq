/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يضيف شخصية متحركة تتبع مؤشر الفأرة",
        "en": "Adds an animated character that follows your cursor."
    },
    "options": {
        "buddy": {
            "ar": "اختر شخصية مؤشر الفأرة",
            "en": "Select the cursor buddy character."
        },
        "speed": {
            "ar": "سرعة الشخصية",
            "en": "Movement speed of the buddy."
        },
        "fps": {
            "ar": "معدل إطارات الشخصية",
            "en": "Animation frame rate."
        },
        "furColor": {
            "ar": "لون الفراء بصيغة hex لـ Oneko",
            "en": "Buddy fur/body color."
        },
        "outlineColor": {
            "ar": "لون الحدود بصيغة hex لـ Oneko",
            "en": "Buddy outline color."
        },
        "size": {
            "ar": "حجم الحصان",
            "en": "Size of the buddy."
        },
        "fade": {
            "ar": "تلاشي الحصان عند اقتراب المؤشر منه",
            "en": "Fade the buddy when inactive."
        },
        "freeroam": {
            "ar": "تجوال الحصان بحرية عند التوقف",
            "en": "Allow the buddy to roam freely."
        },
        "shake": {
            "ar": "اهتزاز النافذة أثناء مشي الحصان",
            "en": "Shake the buddy on click."
        },
        "customSize": {
            "ar": "حجم الصورة المخصّصة",
            "en": "Custom image size"
        },
        "customFlip": {
            "ar": "قلب الصورة أفقيّاً عند التحرّك يساراً",
            "en": "Flip the image horizontally when moving left"
        }
    }
});
