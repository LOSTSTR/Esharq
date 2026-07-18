/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "حضور غنيّ لما تستمع إليه عبر Last.FM أو ListenBrainz",
        "en": "Rich Presence for Last.FM/Listenbrainz"
    },
    "options": {
        "scrobblerBackend": {
            "ar": "خدمة تتبّع الاستماع المستخدَمة.",
            "en": "The scrobbler backend to use."
        },
        "apiKey": {
            "ar": "مفتاح Last.fm API خاص بك. غير مطلوب لكن يُنصح به بشدّة لتجنّب حدّ الطلبات على مفتاحنا المشترك",
            "en": "Custom Last.fm API key. Not required but highly recommended to avoid rate limiting with our shared key"
        },
        "username": {
            "ar": "اسم المستخدم",
            "en": "Username"
        },
        "shareUsername": {
            "ar": "إظهار رابط ملفك في خدمة التتبّع",
            "en": "Show link to scrobbler profile"
        },
        "clickableLinks": {
            "ar": "جعل أسماء المقطع والفنان والألبوم روابط قابلة للنقر",
            "en": "Make the track, artist, and album names clickable links"
        },
        "hideWithSpotify": {
            "ar": "إخفاء الحضور إذا كان Spotify يعمل",
            "en": "Hide presence if Spotify is running"
        },
        "hideWithActivity": {
            "ar": "إخفاء الحضور إذا كان لديك أي حضور آخر",
            "en": "Hide presence if you have any other presence"
        },
        "statusName": {
            "ar": "نص الحالة المخصّص. يمكنك استخدام المتغيّرات: {artist} | {album} | {title}",
            "en": "Custom status text. You can use variables: {artist} | {album} | {title}"
        },
        "statusDisplayType": {
            "ar": "إظهار اسم المقطع / الفنان في قائمة الأعضاء",
            "en": "Show the track / artist name in the member list"
        },
        "nameFormat": {
            "ar": "إظهار اسم الأغنية والفنان في اسم الحالة",
            "en": "Show the song and artist name in the status name"
        },
        "useListeningStatus": {
            "ar": "إظهار حالة «يستمع إلى» بدلاً من «يلعب»",
            "en": "Show \"Listening to\" status instead of \"Playing\""
        },
        "missingArt": {
            "ar": "عند غياب الألبوم أو صورة الألبوم",
            "en": "When the album or album art is missing"
        },
        "showLogo": {
            "ar": "إظهار شعار خدمة التتبّع بجانب غلاف الألبوم",
            "en": "Show the scrobbler service logo by the album cover"
        },
        "showAlbumCover": {
            "ar": "إظهار غلاف الألبوم. تعطيله سيعرض صورة بديلة. مفيد إذا كانت موسيقاك تحتوي على فن غير لائق",
            "en": "Show album cover. Disabling this will display a placeholder. Useful if your music has inappropriate art"
        }
    }
});
