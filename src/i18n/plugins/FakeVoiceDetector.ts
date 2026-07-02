/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "اكشف من يستخدم التصامّ الوهمي (Fake Deafen) في غرفتك الصوتية. محميّ بكلمة سرّ.",
        "en": "Detect who is using Fake Deafen in your voice channel. Locked behind a secret."
    },
    "options": {
        "password": {
            "ar": "الكلمة السرّية التي تُفعّل الكاشف. لا شيء يعمل حتى تُطابقها."
        }
    }
});
