/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle } from "@api/Styles";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

import style from "./style.css?managed";

// 🔴 لا بحثَ عن أصنافٍ هنا بعد اليوم. مرّ هذا الملفّ بعطلين متتاليين:
//
//  ① الصنف يُقرأ في `start()` ووحدةُ الرسائل تُحمَّل كسولاً، فيبقى النائب
//    فارغاً طوال الجلسة. أُصلح بإعادةِ محاولةٍ تنتظر الوحدة.
//  ② والإصلاح نفسه كان مبنيّاً على مِحكٍّ خاطئ: امتلأ النائب — فقيل «نجح» —
//    بصنفٍ قِيس أنّه يصيب **صفر عنصر**، لأنّ أربع وحداتٍ تحمل الاسم
//    و`findCssClasses` تُرجع أوّلها لا المستعملة.
//
// فصار المحدِّد على السمة في `style.css`، ولا شيء يُحلّ هنا. انظر تعليل الورقة.

export default definePlugin({
    name: "SmartBidi",
    description: "Fix how Arabic and other right-to-left text renders when it's mixed with numbers, links, mentions or code — no more scrambled word order or misplaced punctuation.",
    authors: [EquicordDevs.LOSTSTR],
    tags: ["Accessibility", "Appearance"],
    start: () => enableStyle(style),
    stop: () => disableStyle(style),
});
