/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يمنع ظهور مؤشر الكتابة للآخرين",
        "en": "Prevents your typing indicator from showing to others."
    },
    "options": {
        "enabledGlobally": {
            "ar": "تبديل إخفاء مؤشر الكتابة الخاص بك بشكل عام.",
            "en": "Enable or disable hiding your typing indicator globally."
        },
        "hideChatBoxTypingIndicators": {
            "ar": "إخفاء مؤشرات كتابة المستخدمين الآخرين من أعلى شريط الدردشة.",
            "en": "Hide other users' typing indicators above the chat box."
        },
        "hideMembersListTypingIndicators": {
            "ar": "إخفاء مؤشرات كتابة المستخدمين الآخرين من قائمة الأعضاء.",
            "en": "Hide other users' typing indicators in the member list."
        },
        "chatIcon": {
            "ar": "إظهار أيقونة في شريط الدردشة لتعديل الإضافة أثناء الاستخدام.",
            "en": "Show an icon in the chat bar to toggle the plugin while in use."
        },
        "chatIconLeftClickAction": {
            "ar": "ما يحدث عند النقر بالزر الأيسر على أيقونة الدردشة.",
            "en": "What happens when left-clicking the chat icon.",
            "choices": {
                "global": { "ar": "تبديل الكتابة عالمياً", "en": "Toggle Typing Globally" },
                "channel": { "ar": "تبديل الكتابة في القناة", "en": "Toggle Typing in Channel" },
                "guild": { "ar": "تبديل الكتابة في السيرفر", "en": "Toggle Typing in Guild" },
                "settings": { "ar": "فتح إعدادات الإضافة", "en": "Open Plugin Settings" }
            }
        },
        "chatIconMiddleClickAction": {
            "ar": "ما يحدث عند النقر بزر الفأرة الأوسط على أيقونة الدردشة.",
            "en": "What happens when middle-clicking the chat icon.",
            "choices": {
                "global": { "ar": "تبديل الكتابة عالمياً", "en": "Toggle Typing Globally" },
                "channel": { "ar": "تبديل الكتابة في القناة", "en": "Toggle Typing in Channel" },
                "guild": { "ar": "تبديل الكتابة في السيرفر", "en": "Toggle Typing in Guild" },
                "settings": { "ar": "فتح إعدادات الإضافة", "en": "Open Plugin Settings" }
            }
        },
        "chatIconRightClickAction": {
            "ar": "ما يحدث عند النقر بالزر الأيمن على أيقونة الدردشة.",
            "en": "What happens when right-clicking the chat icon.",
            "choices": {
                "global": { "ar": "تبديل الكتابة عالمياً", "en": "Toggle Typing Globally" },
                "channel": { "ar": "تبديل الكتابة في القناة", "en": "Toggle Typing in Channel" },
                "guild": { "ar": "تبديل الكتابة في السيرفر", "en": "Toggle Typing in Guild" },
                "settings": { "ar": "فتح إعدادات الإضافة", "en": "Open Plugin Settings" }
            }
        },
        "chatContextMenu": {
            "ar": "إظهار قائمة منسدلة في قائمة سياق الدردشة لتعديل إعدادات الإضافة أثناء الاستخدام.",
            "en": "Show a context menu in the chat bar to toggle plugin settings."
        },
        "defaultHidden": {
            "ar": "إذا كان مفعّلاً، ستخفي الإضافة مؤشر كتابتك عن الآخرين في أي رسائل مباشرة/قنوات/خوادم غير مدرجة في \"المواقع المعطّلة\" أدناه. وإذا كان معطّلاً، ستُظهر الإضافة مؤشر كتابتك للآخرين في أي رسائل مباشرة/قنوات/خوادم غير مدرجة في \"المواقع المفعّلة\" أدناه.",
            "en": "If enabled, your typing is hidden by default in all locations not listed in 'Enabled Locations'. If disabled, your typing is shown in all locations not listed in 'Disabled Locations'."
        },
        "alwaysEnableInActiveVoiceChat": {
            "ar": "السماح دائماً بإظهار مؤشر الكتابة عند الكتابة في قناة صوتية أنت متصل بها.",
            "en": "Always allow your typing indicator to show when typing in a voice channel you are connected to."
        },
        "temporaryEnableThresholdServers": {
            "ar": "السماح مؤقتاً بإظهار مؤشر الكتابة لهذا العدد من الثواني بعد إرسال رسالة في قناة خادم. إذا كان مؤشر الكتابة ظاهراً بالفعل في القناة، فلن يكون لهذا الإعداد أي أثر.",
            "en": "Temporarily allow your typing indicator to show for this many seconds after sending a message in a server channel. If the typing indicator is already visible in the channel, this setting will have no effect."
        },
        "temporaryEnableThresholdDirectMessages": {
            "ar": "السماح مؤقتاً بإظهار مؤشر الكتابة لهذا العدد من الثواني بعد إرسال رسالة في رسالة مباشرة أو مجموعة. إذا كان مؤشر الكتابة ظاهراً بالفعل في القناة، فلن يكون لهذا الإعداد أي أثر.",
            "en": "Temporarily allow your typing indicator to show for this many seconds after sending a message in a DM or Group DM. If the typing indicator is already visible in the channel, this setting will have no effect."
        },
        "enabledLocations": {
            "ar": "تفعيل الوظيفة لهذه المعرّفات. يقبل قائمة مفصولة بفواصل من معرّفات الرسائل المباشرة والقنوات والخوادم. يُستخدم فقط إذا كان \"مخفي افتراضياً\" معطّلاً.",
            "en": "Enable the feature for these IDs. Accepts a comma-separated list of DM, channel, and server IDs. Only used when 'Hidden by Default' is disabled."
        },
        "disabledLocations": {
            "ar": "تعطيل الوظيفة لهذه المعرّفات. يقبل قائمة مفصولة بفواصل من معرّفات الرسائل المباشرة والقنوات والخوادم. يُستخدم فقط إذا كان \"مخفي افتراضياً\" مفعّلاً.",
            "en": "Disable the feature for these IDs. Accepts a comma-separated list of DM, channel, and server IDs. Only used when 'Hidden by Default' is enabled."
        }
    }
});
