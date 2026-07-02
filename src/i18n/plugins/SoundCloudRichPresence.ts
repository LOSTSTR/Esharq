/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": { "ar": "اعرض أغنية SoundCloud التي تشغّلها حالياً كحضور غنيّ في ديسكورد.", "en": "Show your currently playing SoundCloud track as Discord rich presence." },
    "options": {
        "oauthToken": { "ar": "رمز OAuth الخاص بـ SoundCloud. احصل عليه من soundcloud.com ← F12 ← Application ← Cookies ← oauth_token." },
        "discordAppId": { "ar": "معرّف تطبيق ديسكورد للحضور الغنيّ. انظر دليل الإعداد أدناه." },
        "showSongLink": { "ar": "إظهار زرّ يربط بالأغنية المشغّلة حالياً." },
        "shareProfile": { "ar": "إظهار زرّ يربط بملفّك على SoundCloud." },
        "useListeningStatus": { "ar": "استخدام حالة «يستمع إلى»." },
        "refreshInterval": { "ar": "مدّة تحديث الحالة (بالثواني)." }
    }
});
