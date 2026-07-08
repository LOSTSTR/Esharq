/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "اكشف فوراً من يستخدم التصامّ الوهمي (Fake Deafen) في غرفتك الصوتية — يرصد حالة «مُصمّ بلا كتم» المستحيلة لحظة دخوله بلا حاجة لكلام، وأيضاً من يُسمَع وهو ظاهرٌ مُصمّ. العلامة الحمراء حيّة (تختفي فور إغلاقه الفيك ديفن)، وكل رصد يُحفَظ في سجلّ دائم. محميّ بكلمة سرّ.",
        "en": "Instantly detect who is using Fake Deafen in your voice channel — flags the impossible \"deafened-but-not-muted\" state on entry (no speech needed) and anyone audible while appearing deafened. The red marker is live (clears the moment they turn Fake Deafen off) and every detection is kept in a persistent log. Locked behind a secret."
    },
    "options": {
        "password": {
            "ar": "الكلمة السرّية التي تُفعّل الكاشف. لا شيء يعمل حتى تُطابقها."
        },
        "viewLog": {
            "ar": "سجلّ دائم بكل من ضُبط يستخدم الفيك ديفن (الاسم + السبب + الوقت)."
        }
    }
});
