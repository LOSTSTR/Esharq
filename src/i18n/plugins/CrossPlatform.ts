/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "اعرض ما يلعبه أصدقاؤك على ستيم وHypixel وتويتش داخل ديسكورد. تربط كلّ صديق بنفسك، والمفاتيح مفاتيحك أنت.",
        "en": "Show what your friends are playing on Steam, Hypixel and Twitch inside Discord. You link each friend yourself and supply your own API keys."
    },
    "options": {
        "interval": {
            "ar": "كم مرّة نسأل المنصّات عن الجديد.",
            "en": "How often to ask the platforms for an update."
        }
    }
});
