/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يضيف تحسينات على مجلدات الخوادم",
        "en": "Adds improvements to server folders."
    },
    "options": {
        "sidebar": {
            "ar": "عرض السيرفرات من المجلد في شريط جانبي مخصص",
            "en": "Show servers from a folder in a dedicated sidebar."
        },
        "sidebarAnim": {
            "ar": "تحريك فتح الشريط الجانبي للمجلد",
            "en": "Animate opening the folder sidebar."
        },
        "closeAllFolders": {
            "ar": "إغلاق جميع المجلدات عند اختيار سيرفر لا ينتمي إلى أي مجلد",
            "en": "Close all folders when selecting a server not in any folder."
        },
        "closeAllHomeButton": {
            "ar": "إغلاق جميع المجلدات عند الضغط على زر الرئيسية",
            "en": "Close all folders when clicking the home button."
        },
        "closeOthers": {
            "ar": "إغلاق المجلدات الأخرى عند فتح مجلد",
            "en": "Close other folders when opening a folder."
        },
        "closeServerFolder": {
            "ar": "إغلاق المجلد عند اختيار سيرفر داخله",
            "en": "Close the folder when selecting a server inside it."
        },
        "forceOpen": {
            "ar": "إجبار المجلد على الفتح عند الانتقال إلى سيرفر داخله",
            "en": "Force the folder to open when navigating to a server inside it."
        },
        "enableNestedFolders": {
            "ar": "السماح بتداخل المجلدات داخل بعضها عبر السحب والإفلات.",
            "en": "Allow folders to be nested inside each other via drag and drop."
        },
        "keepIcons": {
            "ar": "الاستمرار في عرض أيقونات السيرفرات في شريط السيرفرات الرئيسي عند فتح الشريط الجانبي لـ BetterFolders",
            "en": "Keep showing server icons in the main server bar when the BetterFolders sidebar is open."
        },
        "showFolderIcon": {
            "ar": "إظهار أيقونة المجلد فوق سيرفرات المجلد في الشريط الجانبي لـ BetterFolders",
            "en": "Show the folder icon above folder servers in the BetterFolders sidebar.",
            "choices": {
                "0": { "ar": "أبداً", "en": "Never" },
                "1": { "ar": "دائماً", "en": "Always" },
                "2": { "ar": "عند توسيع أكثر من مجلد", "en": "When more than one folder is expanded" }
            }
        }
    }
});
