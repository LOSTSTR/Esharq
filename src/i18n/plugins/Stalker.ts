/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يراقب شخصاً محدَّداً ويُنبّهك ويسجّل حالته ونشاطه وحركته الصوتية محلياً على جهازك. ⚠️ راقبة شخص دون علمه قد تنتهك خصوصيته وشروط ديسكورد — استخدمها على مسؤوليتك.",
        "en": "Notifies you whenever a person does something (status, activity, voice), logging it locally on your device. ⚠️ Watching someone without their knowledge may violate their privacy and Discord's Terms — use responsibly."
    },
    "options": {
        "stalkContext": {
            "ar": "يضيف خياراً في قائمة سياق المستخدم لتفعيل مراقبته.",
            "en": "Adds an option on the user context menu that enables stalking for users."
        },
        "notifyCallJoin": {
            "ar": "أرسل إشعاراً عند انضمام المستخدم إلى قناة صوتية.",
            "en": "Send a notification when a user joins a voice channel."
        },
        "notifyCallLeave": {
            "ar": "أرسل إشعاراً عند مغادرة المستخدم قناة صوتية.",
            "en": "Send a notification when a user leaves a voice channel."
        },
        "notifyOffline": {
            "ar": "أرسل إشعاراً عندما يصبح المستخدم غير متصل.",
            "en": "Send a notification when a user goes offline."
        },
        "notifyOnline": {
            "ar": "أرسل إشعاراً عندما يصبح المستخدم متصلاً.",
            "en": "Send a notification when a user goes online."
        },
        "notifyDnd": {
            "ar": "أرسل إشعاراً عندما يفعّل المستخدم وضع «ممنوع الإزعاج».",
            "en": "Send a notification when a user goes on Do Not Disturb."
        },
        "notifyIdle": {
            "ar": "أرسل إشعاراً عندما يصبح المستخدم خاملاً.",
            "en": "Send a notification when a user goes idle."
        },
        "notifyGoOnline": {
            "ar": "أرسل إشعاراً عندما يسجّل المستخدم دخوله إلى ديسكورد أو يخرج من وضع التخفّي، بغضّ النظر عن الخيارات الأربعة أعلاه.",
            "en": "Send a notification when a user logs onto Discord or leaves invisible, regardless of the 4 above options."
        },
        "enableLogging": {
            "ar": "تفعيل تسجيل أحداث المراقبة في التخزين المحلي.",
            "en": "Enable logging of stalker events to local storage."
        },
        "openStalkingFolder": {
            "ar": "تصدير كل سجلّات المراقبة كملف JSON.",
            "en": "Export all stalking logs as a JSON file."
        },
        "logMessages": {
            "ar": "سجّل عندما يرسل المستخدم رسالة في أي قناة.",
            "en": "Log when a user sends a message in any channel."
        },
        "logMessagePreview": {
            "ar": "تضمين معاينات الرسائل في سجلّات الرسائل المحلية.",
            "en": "Include message previews in local message logs."
        },
        "logActivities": {
            "ar": "سجّل عندما يبدأ المستخدم نشاطاً أو يوقفه أو يغيّره.",
            "en": "Log when a user starts, stops, or changes an activity."
        },
        "notifyActivities": {
            "ar": "أرسل إشعاراً عندما يبدأ المستخدم نشاطاً.",
            "en": "Send a notification when a user starts an activity."
        },
        "logCustomStatus": {
            "ar": "سجّل تغييرات الحالة المخصّصة.",
            "en": "Log custom status changes."
        },
        "logClientStatus": {
            "ar": "سجّل ما إذا كان المستخدم متصلاً من سطح المكتب أو الجوال أو الويب.",
            "en": "Log whether a user is online from desktop, mobile, or web."
        },
        "logVoiceStateChanges": {
            "ar": "سجّل تغييرات الحالة الصوتية مثل الكتم والصمم والفيديو والبثّ.",
            "en": "Log voice state changes like mute, deaf, video, and streaming."
        },
        "targets": {
            "ar": "قائمة معرّفات المستخدمين المراد مراقبتهم، مفصولة بفاصلة.",
            "en": "List of user IDs to stalk, separate with a comma."
        }
    }
});
