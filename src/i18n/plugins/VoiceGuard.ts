/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "قاوِم إشراف الصوت في الخادم: إعادة اتصال تلقائية، وإلغاء الكتم/كتم السماع، والبقاء في قناة مثبّتة إن نُقلت. ⚠️ قد تخالف شروط ديسكورد. تشغيلها على مسؤوليتك التامّة — إشراق يُخلي مسؤوليته.",
        "en": "Resist server voice moderation: auto-rejoin, auto-unmute/undeafen, and stay in a pinned channel if moved. ⚠️ May violate Discord ToS. Use at your own risk — Esharq disclaims all liability."
    },
    "options": {
        "autoReconnect": { "ar": "يُعيدك تلقائياً إذا قطع أحدهم اتصالك. لا يحتاج تثبيتاً: يُرجعك إلى القناة نفسها التي أُخرجت منها. وإن كنت قد ثبّتت قناة، فيُرجعك إليها هي. خروجك بنفسك لا يُرجعك." },
        "autoUndeafen": { "ar": "التراجع تلقائياً عن كتم السماع من الخادم." },
        "autoUnmute": { "ar": "التراجع تلقائياً عن الكتم من الخادم." },
        "stayInChannel": { "ar": "العودة للقناة المثبّتة إن تم نقلك. ⚠️ لا يعمل إلا بعد تثبيت القناة الصوتية: انقر عليها بالزرّ الأيمن ثم اختر «تثبيت القناة»." },
        "cooldown": { "ar": "فترة تهدئة بين الإجراءات (بالثواني)، لتجنّب صراع متكرّر مع الخادم." }
    }
});
