/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "زامن حالتك مع Steam! (متصل، بعيد، مخفي، أو غير متصل.)",
        "en": "Sync your status with Steam! (Online, Away, Invisible, or Offline.)"
    },
    "options": {
        "onlineStatus": {
            "ar": "حالة Steam عند الاتصال",
            "en": "Discord status to sync when Steam is Online.",
            "choices": {
                "online": { "ar": "متصل", "en": "Online" },
                "offline": { "ar": "غير متصل (قطع دردشة Steam)", "en": "Offline (Disconnect Steam Chat)" },
                "none": { "ar": "معطّل", "en": "Disabled" }
            }
        },
        "idleStatus": {
            "ar": "حالة Steam عند الخمول",
            "en": "Discord status to sync when Steam is Away.",
            "choices": {
                "online": { "ar": "متصل", "en": "Online" },
                "away": { "ar": "بعيد", "en": "Away" },
                "invisible": { "ar": "خفي", "en": "Invisible" },
                "offline": { "ar": "غير متصل (قطع دردشة Steam)", "en": "Offline (Disconnect Steam Chat)" },
                "none": { "ar": "معطّل", "en": "Disabled" }
            }
        },
        "dndStatus": {
            "ar": "حالة Steam عند 'عدم الإزعاج'",
            "en": "Discord status to sync when Steam is Busy."
        },
        "invisibleStatus": {
            "ar": "حالة Steam عند الإخفاء",
            "en": "Discord status to sync when Steam is Invisible."
        },
        "goInvisibleIfActivityIsHidden": {
            "ar": "اذهب دائماً إلى وضع الإخفاء عند إخفاء نشاط اللعبة على Discord",
            "en": "Go invisible if the activity is hidden."
        }
    }
});
