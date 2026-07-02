/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": { "ar": "يعرض سطر كلمات Spotify الحالي في حالتك المخصّصة لحظياً. الكلمات من LrcLib.", "en": "Shows the current Spotify lyric line in your Discord custom status in real time. Lyrics fetched from LrcLib." },
    "options": {
        "format": { "ar": "قالب الحالة. {lyrics} = السطر الحالي، {song} = اسم الأغنية، {artist} = الفنّان." },
        "clearOnStop": { "ar": "مسح حالتك المخصّصة عند توقّف الموسيقى أو تعطيل الإضافة." }
    }
});
