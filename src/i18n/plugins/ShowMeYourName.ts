/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يعرض اسم المستخدم الأصلي بجانب اللقب",
        "en": "Shows the original username next to the display name."
    },
    "options": {
        "messages": {
            "ar": "اعرض تنسيق الاسم المخصص في الرسائل.",
            "en": "Show usernames in messages."
        },
        "replies": {
            "ar": "عرض تنسيق الاسم المخصص في الردود.",
            "en": "Show usernames in reply previews."
        },
        "mentions": {
            "ar": "عرض تنسيق الاسم المخصص في الإشارات.",
            "en": "Show usernames in mentions."
        },
        "typingIndicator": {
            "ar": "عرض أول اسم متاح في تنسيق الاسم المخصص في مؤشر الكتابة.",
            "en": "Show usernames in the typing indicator."
        },
        "memberList": {
            "ar": "عرض أول اسم متاح في تنسيق الاسم المخصص في قائمة الأعضاء وقائمة الرسائل المباشرة وقائمة الأصدقاء.",
            "en": "Show usernames in the member list."
        },
        "profilePopout": {
            "ar": "عرض أول اسم متاح في تنسيق الاسم المخصص في نوافذ الملف الشخصي المنبثقة.",
            "en": "Show usernames in the profile popout."
        },
        "voiceChannels": {
            "ar": "عرض أول اسم متاح في تنسيق الاسم المخصص في القنوات الصوتية.",
            "en": "Show usernames in voice channel user lists."
        },
        "reactions": {
            "ar": "عرض أول اسم متاح في تنسيق الاسم المخصص في تلميحات ردود الفعل والاسم الكامل في نوافذ ردود الفعل المنبثقة.",
            "en": "Show the first available name in reaction tooltips and the full name in reaction popouts."
        },
        "discriminators": {
            "ar": "إلحاق المُعرِّفات بأسماء مستخدمي البوتات. لم تعد المُعرِّفات مستخدمة للمستخدمين، لكنها لا تزال مستخدمة للبوتات. بشكل افتراضي، يساوي اسم مستخدم البوت الاسم العالمي للمستخدم، لذا يمكن لعدة بوتات أن تتشارك الاسم ذاته. إلحاق المُعرِّفات يجعلها فريدة من جديد.",
            "en": "Append discriminators to bot usernames."
        },
        "hideDefaultAtSign": {
            "ar": "إخفاء رمز \"@\" الافتراضي قبل الاسم في الإشارات والردود. يُطبَّق فقط إذا كانت إحدى الميزتين مفعّلة.",
            "en": "Hide the default @ sign before usernames."
        },
        "truncateAllNamesWithStreamerMode": {
            "ar": "اقتصاص جميع الأسماء وليس أسماء المستخدمين فقط في وضع البث.",
            "en": "Truncate all names (not just usernames) in streamer mode."
        },
        "removeDuplicates": {
            "ar": "إذا كانت أي أسماء متطابقة، فتُحذف تاركةً فقط الأسماء الفريدة.",
            "en": "If any names are identical, remove duplicates leaving only unique names."
        },
        "ignoreFonts": {
            "ar": "استخدام الخطوط الافتراضية لـ Discord للأسماء غير الأساسية بصرف النظر عن خط النيترو المخصص للمستخدم.",
            "en": "Use Discord's default fonts for non-primary names regardless of the user's custom Nitro font."
        },
        "ignoreEffects": {
            "ar": "للأسماء غير الأساسية، يُستعمل لون الدور الأساسي وحده وتُحذف تأثيرات اسم العرض.",
            "en": "For non-primary names, use only the primary role color and omit display name effects."
        },
        "animateEffects": {
            "ar": "تحريك تدرّجات الأدوار وتأثيرات اسم العرض على الأسماء غير الأساسية. يُعطّله «تجاهل التأثيرات» وتقليل الحركة.",
            "en": "Animate role gradients and display name effects on non-primary names. This is disabled by \"Ignore Effects\" and reduced motion."
        },
        "nameSeparator": {
            "ar": "الفاصل المستخدم بين الأسماء. الافتراضي هو مسافة واحدة.",
            "en": "Separator used between names. Default is a single space."
        },
        "friendNameOnlyInDirectMessages": {
            "ar": "عرض أسماء الأصدقاء فقط في الرسائل المباشرة وليس في الخوادم.",
            "en": "Show friend names only in DMs, not in servers."
        },
        "customNameOnlyInDirectMessages": {
            "ar": "عرض الأسماء المخصصة فقط في الرسائل المباشرة وليس في الخوادم.",
            "en": "Show custom names only in DMs, not in servers."
        },
        "alwaysAnimateEffects": {
            "ar": "إجبار تأثيرات اسم العرض على الحركة حين تكون ظاهرة أصلاً، بلا حاجة إلى التحويم.",
            "en": "Force display name effects to animate when they would already be visible, even without hover."
        },
        "includedNames": {
            "ar": "ترتيب عرض أسماء المستخدمين وأسماء العرض والألقاب وأسماء الأصدقاء والأسماء المخصصة. استخدم العناصر النائبة التالية: {user}، {display}، {nick}، {friend}، {custom}. يمكنك تقديم خيارات أسماء متعددة كبدائل إذا لم يكن أحدها متاحاً بفصلها بفواصل هكذا: {custom, friend, nick}. يمكن أن يكون لكل اسم ما يصل إلى ثلاثة بادئات وثلاثة لاحقات.",
            "en": "Order and configuration of displayed name components."
        },
        "customNameColor": {
            "ar": "اللون المستخدم للاسم المخصص الذي عيّنته للمستخدم إذا لم يكن أول اسم معروض. يقبل أي مدخل CSS صالح. استخدم \"Role\" لمتابعة ألوان أعلى دور للمستخدم أو ألوان تأثير نيترو أو لون IRCColors إذا كان مفعّلاً. استخدم \"Role+-#\" لضبط السطوع بهذه النسبة (مثال: \"Role+15\")",
            "en": "Color used for the custom name if it is not the first displayed name."
        },
        "friendNameColor": {
            "ar": "اللون المستخدم للقب اسم الصديق إذا لم يكن أول اسم معروض. يقبل أي مدخل CSS صالح. استخدم \"Role\" لمتابعة ألوان أعلى دور للمستخدم أو ألوان تأثير نيترو أو لون IRCColors إذا كان مفعّلاً. استخدم \"Role+-#\" لضبط السطوع بهذه النسبة (مثال: \"Role+15\")",
            "en": "Color used for the friend name if it is not the first displayed name."
        },
        "nicknameColor": {
            "ar": "اللون المستخدم للقب إذا لم يكن أول اسم معروض. يقبل أي مدخل CSS صالح. استخدم \"Role\" لمتابعة ألوان أعلى دور للمستخدم أو ألوان تأثير نيترو أو لون IRCColors إذا كان مفعّلاً. استخدم \"Role+-#\" لضبط السطوع بهذه النسبة (مثال: \"Role+15\")",
            "en": "Color used for the nickname if it is not the first displayed name."
        },
        "displayNameColor": {
            "ar": "اللون المستخدم لاسم العرض إذا لم يكن أول اسم معروض. يقبل أي مدخل CSS صالح. استخدم \"Role\" لمتابعة ألوان أعلى دور للمستخدم أو ألوان تأثير نيترو أو لون IRCColors إذا كان مفعّلاً. استخدم \"Role+-#\" لضبط السطوع بهذه النسبة (مثال: \"Role+15\")",
            "en": "Color used for the display name if it is not the first displayed name."
        },
        "usernameColor": {
            "ar": "اللون المستخدم لاسم المستخدم إذا لم يكن أول اسم معروض. يقبل أي مدخل CSS صالح. استخدم \"Role\" لمتابعة ألوان أعلى دور للمستخدم أو ألوان تأثير نيترو أو لون IRCColors إذا كان مفعّلاً. استخدم \"Role+-#\" لضبط السطوع بهذه النسبة (مثال: \"Role+15\")",
            "en": "Color used for the username if it is not the first displayed name."
        },
        "gradientGlow": {
            "ar": "يضيف توهّجاً لتدرّجات المستخدم المتحرّكة كما تتوهّج تدرّجات أدوار الخادم.",
            "en": "Add a glow to animated user gradients the same way server role gradients glow."
        },
        "styleDirectMessagesList": {
            "ar": "يُظهر تأثيرات اسم العرض على المدخلات غير المحدَّدة بلا حاجة إلى التحويم. والمحدَّدة والمُحوَّم عليها تبقى منسّقة عند التعطيل.",
            "en": "Show display name effects on unselected entries without requiring hover. Selected and hovered entries are still styled when disabled."
        },
        "styleDirectMessagesMessages": {
            "ar": "يُظهر تأثيرات اسم العرض على كاتبي الرسائل بلا حاجة إلى التحويم. والأسماء المُحوَّم عليها تبقى منسّقة عند التعطيل.",
            "en": "Show display name effects on message authors without requiring hover. Hovered names are still styled when disabled."
        },
        "styleFriendsList": {
            "ar": "يُظهر تأثيرات اسم العرض بلا حاجة إلى التحويم. والمدخلات المُحوَّم عليها تبقى منسّقة عند التعطيل.",
            "en": "Show display name effects without requiring hover. Hovered entries are still styled when disabled."
        },
        "styleActiveNow": {
            "ar": "يُظهر تأثيرات اسم العرض بلا حاجة إلى التحويم. والمدخلات المُحوَّم عليها تبقى منسّقة عند التعطيل.",
            "en": "Show display name effects without requiring hover. Hovered entries are still styled when disabled."
        },
        "triggerNameRerender": {
            "ar": "تشغيل إعادة رسم الأسماء عبر تبديل هذا الإعداد.",
            "en": "Trigger name re-render by toggling this setting."
        }
    }
});
