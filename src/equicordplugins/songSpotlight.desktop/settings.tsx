/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import { makeRange, OptionType } from "@utils/types";

import { apiConstants } from "./lib/api";
import Settings from "./ui/settings";

export default definePluginSettings({
    collapseSongList: {
        type: OptionType.BOOLEAN,
        description: t("يطوي قائمة الأغاني في ملفات المستخدمين إلى زر يفتح قائمة منفصلة", "Collapses the song list in user profiles into a button that opens a separate list"),
        default: false,
    },
    profileSongsLimit: {
        type: OptionType.SLIDER,
        description: t("عدد الأغاني التي تظهر عند النقر على ملف المستخدم أول مرة", "Number of songs shown when first clicking on a user profile"),
        default: apiConstants.songLimit,
        markers: makeRange(1, 3),
    },
    previewVolume: {
        type: OptionType.SLIDER,
        description: t("مستوى صوت معاينات الأغاني عند تشغيلها", "Volume of song previews when played"),
        markers: [0, 25, 50, 100],
        default: 100,
        stickToMarkers: false
    },
    manager: {
        type: OptionType.COMPONENT,
        component: () => <Settings />,
    },
}, {
    profileSongsLimit: {
        disabled() {
            return this.store.collapseSongList;
        },
    },
});
