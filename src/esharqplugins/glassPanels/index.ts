/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle } from "@api/Styles";
import definePlugin from "@utils/types";

import style from "./style.css?managed";

// 🔴 لا حلَّ لأصنافٍ هنا. كان `findCssClasses("sidebar", "membersWrap",
// "members")` يشترط اجتماع الثلاثة في وحدةٍ واحدة، وقِيس أنّها موزّعة على
// وحدتين — فلا يتحلّل شيء وتبقى الإضافة بلا أثر. التفصيل في `style.css`.

export default definePlugin({
    name: "GlassPanels",
    description: "Frosted-glass blur on the sidebar and member list.",
    authors: [{ name: "Sharp", id: 0n }],
    tags: ["Appearance", "Customisation"],
    start: () => enableStyle(style),
    stop: () => disableStyle(style),
});
