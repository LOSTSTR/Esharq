/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يتيح خلفية مخصّصة لكل قناة على حدة (صورة/GIF/فيديو). محلي بالكامل — لا يُرفَع ولا يُشارَك أي شيء.",
        "en": "Allows for custom backgrounds for every individual channel. Fully local — nothing is uploaded or shared."
    },
    "options": {
        "opacity": {
            "ar": "شفافية الخلفية (0 = غير مرئية، 1 = كاملة)",
            "en": "Wallpaper opacity (0 = invisible, 1 = full)"
        },
        "blur": {
            "ar": "ضبابية الخلفية (بكسل)",
            "en": "Wallpaper blur (px)"
        },
        "defaultWallpaper": {
            "ar": "رابط الخلفية الافتراضية (للقنوات بلا خلفية مخصّصة). فارغ = بلا خلفية.",
            "en": "Default wallpaper URL (for channels without a custom one). Empty = none."
        }
    }
});
