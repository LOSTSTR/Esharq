/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يُضيف إجراءات عند النقر على الرسائل",
        "en": "Adds actions when clicking on messages."
    },
    "options": {
        "singleClickAction": {
            "ar": "الإجراء عند النقر مرة واحدة (رسائلك)",
            "en": "Action on single click (your messages)."
        },
        "singleClickModifier": {
            "ar": "المعدِّل المطلوب للنقر المفرد (رسائلك)",
            "en": "Modifier required for single click (your messages)."
        },
        "singleClickOthersAction": {
            "ar": "الإجراء عند النقر مرة واحدة (رسائل الآخرين)",
            "en": "Action on single click (others' messages)."
        },
        "singleClickOthersModifier": {
            "ar": "المعدِّل المطلوب للنقر المفرد (رسائل الآخرين)",
            "en": "Modifier required for single click (others' messages)."
        },
        "doubleClickAction": {
            "ar": "الإجراء عند النقر المزدوج (رسائلك)",
            "en": "Action on double click (your messages)."
        },
        "doubleClickOthersAction": {
            "ar": "الإجراء عند النقر المزدوج (رسائل الآخرين)",
            "en": "Action on double click (others' messages)."
        },
        "doubleClickModifier": {
            "ar": "المعدِّل المطلوب للنقر المزدوج",
            "en": "Modifier required for double click."
        },
        "tripleClickAction": {
            "ar": "الإجراء عند النقر الثلاثي",
            "en": "Action on triple click."
        },
        "tripleClickModifier": {
            "ar": "المعدِّل المطلوب للنقر الثلاثي",
            "en": "Modifier required for triple click."
        },
        "reactEmoji": {
            "ar": "الإيموجي المستخدم لإجراءات التفاعل.",
            "en": "Emoji to use for reaction actions."
        },
        "addAdditionalReacts": {
            "ar": "إضافة إيموجيات تفاعل إضافية مخصصة أيضاً",
            "en": "Also add custom emoji as reaction actions."
        },
        "disableInDms": {
            "ar": "تعطيل جميع إجراءات النقر في الرسائل المباشرة",
            "en": "Disable all click actions in DMs."
        },
        "disableInSystemDms": {
            "ar": "تعطيل جميع إجراءات النقر في رسائل النظام",
            "en": "Disable all click actions in system messages."
        },
        "clickTimeout": {
            "ar": "مهلة التمييز بين النقر المزدوج/الثلاثي (بالمللي ثانية)",
            "en": "Timeout to distinguish between double and triple clicks (ms)."
        },
        "doubleClickHoldThreshold": {
            "ar": "أقصى مدة ضغط للنقر المزدوج (مللي ثانية). الضغط الأطول يتيح تحديد النص",
            "en": "Maximum press duration for double click (ms). Longer presses allow text selection."
        },
        "deferDoubleClickForTriple": {
            "ar": "تأخير النقر المزدوج للسماح بإجراءات النقر الثلاثي (تعطيل النقر الثلاثي عند الإيقاف)",
            "en": "Delay double click to allow triple-click actions (disables triple click when off)."
        },
        "selectionHoldTimeout": {
            "ar": "مهلة للسماح بتحديد النص (بالمللي ثانية)",
            "en": "Timeout to allow text selection (ms)."
        },
        "quoteWithReply": {
            "ar": "عند الاقتباس، الرد على الرسالة أيضاً",
            "en": "When quoting, also reply to the message."
        },
        "useSelectionForQuote": {
            "ar": "عند الاقتباس، استخدام النص المحدد إن توفر",
            "en": "When quoting, use selected text if available."
        },
        "additionalReactEmojis": {
            "ar": "إيموجيات إضافية تُضاف عند استخدام إجراء التفاعل (مفصولة بفاصلة أو سطر جديد، بحدّ أقصى 8).",
            "en": "Additional emojis to add when using React action (comma/newline separated, max 8)"
        }
    }
});
