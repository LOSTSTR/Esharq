/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import { fillStyleClassesWhenReady } from "@utils/esharqLateClasses";
import definePlugin, { OptionType } from "@utils/types";

import fadeStyle from "./fade.css?managed";
import slideStyle from "./slide.css?managed";

// 🔴 وحدةُ الرسائل تُحمَّل كسولاً، فقراءةُ الصنف في `start()` تُرجع
// `undefined` لمن يُقلع على صفحة الأصدقاء، ويبقى العنصر النائب طوال الجلسة.
// ينظر التعليق في `@utils/esharqLateClasses`.

function applyStyle() {
    disableStyle(fadeStyle);
    disableStyle(slideStyle);
    enableStyle(settings.store.includeFade ? fadeStyle : slideStyle);
}

const settings = definePluginSettings({
    includeFade: {
        type: OptionType.BOOLEAN,
        description: "Fade messages in while they slide.",
        default: true,
        onChange: applyStyle
    }
});

export default definePlugin({
    name: "SmoothMessages",
    description: "Makes new messages slide in smoothly from the left instead of appearing sharply.",
    authors: [{ name: "x2b", id: 0n }],
    tags: ["Appearance", "Chat"],
    settings,

    start() {
        applyStyle();
        fillStyleClassesWhenReady([fadeStyle, slideStyle], ["messageListItem"]);
    },

    stop() {
        disableStyle(fadeStyle);
        disableStyle(slideStyle);
    }
});
