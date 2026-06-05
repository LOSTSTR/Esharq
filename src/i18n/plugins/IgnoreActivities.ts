/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يُتيح تجاهل أنشطة معينة من ظهورها في حالتك",
        "en": "Allows ignoring specific activities from showing in your status."
    },
    "options": {
        "ignoredActivities": {
            "ar": "الأنشطة المتجاهَلة"
        },
        "listMode": {
            "ar": "تغيير وضع قائمة الفلتر",
            "en": "Whether to use the list as a blacklist (ignore listed) or whitelist (only show listed)."
        },
        "ignorePlaying": {
            "ar": "تجاهل جميع أنشطة اللعب (وهي عادةً أنشطة الألعاب وRPC)",
            "en": "Ignore games with PLAYING status."
        },
        "ignoreStreaming": {
            "ar": "تجاهل جميع أنشطة البث",
            "en": "Ignore streams with STREAMING status."
        },
        "ignoreListening": {
            "ar": "تجاهل جميع أنشطة الاستماع (وهي عادةً أنشطة Spotify)",
            "en": "Ignore music with LISTENING status."
        },
        "ignoreWatching": {
            "ar": "تجاهل جميع أنشطة المشاهدة",
            "en": "Ignore videos with WATCHING status."
        },
        "ignoreCompeting": {
            "ar": "تجاهل جميع أنشطة التنافس (وهي عادةً أنشطة ألعاب خاصة)",
            "en": "Ignore events with COMPETING status."
        }
    }
});
