/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يُعلن عند انضمام المستخدمين أو مغادرتهم أو تنقلهم في القنوات الصوتية عبر TikTok TTS.",
        "en": "Announces when users join, leave, or move between voice channels using a narrator via TikTok TTS. Revived and back again."
    },
    "options": {
        "latinOnly": {
            "ar": "إزالة الأحرف غير اللاتينية من الأسماء قبل نطقها",
            "en": "Strip non latin characters from names before saying them"
        },
        "joinMessage": {
            "ar": "العناصر النائبة: {{USER}}، {{DISPLAY_NAME}}، {{NICKNAME}}، {{CHANNEL}}، {{SOUND}}.",
            "en": "Placeholders: {{USER}}, {{DISPLAY_NAME}}, {{NICKNAME}}, {{CHANNEL}}, {{SOUND}}."
        },
        "joinSoundName": {
            "ar": "اسم ملف صوت الانضمام.",
            "en": "Join sound file name."
        },
        "leaveMessage": {
            "ar": "العناصر النائبة: {{USER}}، {{DISPLAY_NAME}}، {{NICKNAME}}، {{CHANNEL}}، {{SOUND}}.",
            "en": "Placeholders: {{USER}}, {{DISPLAY_NAME}}, {{NICKNAME}}, {{CHANNEL}}, {{SOUND}}."
        },
        "leaveSoundName": {
            "ar": "اسم ملف صوت المغادرة.",
            "en": "Leave sound file name."
        },
        "moveMessage": {
            "ar": "العناصر النائبة: {{USER}}، {{DISPLAY_NAME}}، {{NICKNAME}}، {{CHANNEL}}، {{SOUND}}.",
            "en": "Placeholders: {{USER}}, {{DISPLAY_NAME}}, {{NICKNAME}}, {{CHANNEL}}, {{SOUND}}."
        },
        "moveSoundName": {
            "ar": "اسم ملف صوت الانتقال.",
            "en": "Move sound file name."
        },
        "announceOthersMute": {
            "ar": "الإعلان عندما يكتم/يُلغي كتم مستخدمون آخرون في قناتك الصوتية الحالية",
            "en": "Announce when other users mute/unmute in your current VC"
        },
        "announceOthersDeafen": {
            "ar": "الإعلان عندما يُصمّ/يُلغي إصمام مستخدمون آخرون في قناتك الصوتية الحالية",
            "en": "Announce when other users deafen/undeafen in your current VC"
        },
        "announceOthersStream": {
            "ar": "الإعلان عندما يبدأ/يوقف مستخدمون آخرون البثّ في قناتك الصوتية الحالية",
            "en": "Announce when other users start/stop streaming in your current VC"
        },
        "announceSelfStream": {
            "ar": "الإعلان عندما تبدأ/توقف البثّ",
            "en": "Announce when you start/stop streaming"
        },
        "stateChangeCooldownMs": {
            "ar": "مهلة إعلان تغيّر الحالة (مللي ثانية)",
            "en": "State-change announce cooldown (ms)"
        },
        "userVoiceMap": {
            "ar": "أصوات مخصّصة لكل مستخدم (الصيغة: userId:voiceId,userId2:voiceId2). انقر بزرّ الفأرة الأيمن على المستخدمين للتعيين.",
            "en": "Per-user voice overrides (format: userId:voiceId,userId2:voiceId2). Right-click users to set."
        },
        "stateChangeFilterMode": {
            "ar": "تصفية المستخدمين الذين يُطلقون إعلانات تغيّر الحالة",
            "en": "Filter which users trigger state-change announcements"
        },
        "stateChangeFilterList": {
            "ar": "معرّفات مستخدمين مفصولة بفواصل للقائمة البيضاء/السوداء. انقر بزرّ الفأرة الأيمن على المستخدمين للإضافة/الإزالة.",
            "en": "Comma-separated user IDs for whitelist/blacklist. Right-click users to add/remove."
        },
        "ignoredUsers": {
            "ar": "معرّفات مستخدمين مفصولة بفواصل لتجاهلهم تماماً (بلا إعلانات انضمام/مغادرة/انتقال/حالة). انقر بزرّ الفأرة الأيمن على المستخدمين للإضافة/الإزالة.",
            "en": "Comma-separated user IDs to completely ignore (no join/leave/move/state announcements). Right-click users to add/remove."
        },
        "joinLeaveTimeout": {
            "ar": "مهلة لكل مستخدم لإعلانات الانضمام/المغادرة/الانتقال (ثوانٍ). تمنع الإزعاج من سريعي إعادة الانضمام.",
            "en": "Per-user cooldown for join/leave/move announcements (seconds). Prevents spam from rapid rejoiners."
        },
        "customVoice": {
            "ar": "صوت الراوي",
            "en": "TikTok TTS voice to use."
        },
        "volume": {
            "ar": "مستوى صوت الراوي",
            "en": "Narrator volume."
        },
        "rate": {
            "ar": "سرعة الراوي",
            "en": "Narrator speech rate."
        },
        "sayOwnName": {
            "ar": "قول اسمك الخاص",
            "en": "Announce your own name."
        },
        "ignoreSelf": {
            "ar": "تجاهل نفسك في جميع الأحداث.",
            "en": "Ignore your own joins/leaves."
        }
    }
});
