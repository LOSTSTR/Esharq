/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle } from "@api/Styles";
import { EquicordDevs } from "@utils/constants";
import { fillStyleClassesWhenReady } from "@utils/esharqLateClasses";
import definePlugin from "@utils/types";

import style from "./style.css?managed";

// messageContent هو صنف ديسكورد المُصغَّر لمتن الرسالة، ويُغذّي العنصر النائب
// `[--messageContent]` في style.css بدل تثبيت `[class*="messageContent-"]`.
//
// 🔴 كان يُقرأ داخل `start()` عبر `findCssClassesLazy`. ووحدةُ الرسائل تُحمَّل
// **كسولاً**، فمن يُقلع على صفحة الأصدقاء لا تكون عنده بعد ⇒ الصنف `undefined`
// ⇒ يُبقي `compileStyle` العنصرَ النائب، وهو مُحدِّدُ سمةٍ لا يطابق شيئاً.
// ولا شيء يُعيد الترجمة لاحقاً، فالإضافة تبقى **حيّةً صامتة طوال الجلسة**.
// قِيس حيّاً: فُتحت قناة حتى ظهرت عناصر الرسائل في DOM، والعنصر النائب باقٍ.

export default definePlugin({
    name: "SmartBidi",
    description: "Fix how Arabic and other right-to-left text renders when it's mixed with numbers, links, mentions or code — no more scrambled word order or misplaced punctuation.",
    authors: [EquicordDevs.LOSTSTR],
    tags: ["Accessibility", "Appearance"],
    start() {
        enableStyle(style);
        fillStyleClassesWhenReady([style], ["messageContent"]);
    },
    stop: () => disableStyle(style),
});
