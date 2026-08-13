/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Exporter — دمج إضافتَي ExportDM و MemberListExport في إضافة واحدة.
 *
 * كانتا إضافتين منفصلتين تفعلان الشيء نفسه من زاويتين (تصدير محتوى قناة / تصدير قائمة
 * أعضائها)، فيظهر في قائمة الإضافات مدخلان وزرّان وإعدادان لمهمّة واحدة. المصدر الأصلي
 * وحّدهما بدوره؛ نتبعه هنا مع الإبقاء على تطبيقنا الخاصّ (يستعمل RestAPI لا قراءة رمز
 * الحساب الخام — وهي قاعدتنا الثابتة) وعلى تعريبنا.
 *
 * تُنسَب لأصحابها الأصليين: تصدير الرسائل من Nightcord، وتصدير قائمة الأعضاء من
 * SirPhantom89 — لا يُضاف مؤلّف من عندنا لعمل منقول.
 */

import { addChannelToolbarButton, addHeaderBarButton, removeChannelToolbarButton, removeHeaderBarButton } from "@api/HeaderBar";
import definePlugin from "@utils/types";
import { React } from "@webpack/common";

import { MemberListToolbarButton } from "./memberList";
import { ExportMessagesButton } from "./messages";
import { settings } from "./settings";

export default definePlugin({
    name: "Exporter",
    enabledByDefault: false,
    description: "Export a channel's messages (TXT/JSON/CSV/MD/HTML) and its member list (JSON/CSV).",
    authors: [
        { name: "Nightcord", id: 0n },
        { name: "SirPhantom89", id: 1464279455844274188n }
    ],
    tags: ["Servers", "Utility"],
    dependencies: ["HeaderBarAPI"],
    settings,

    start() {
        addHeaderBarButton("esharq-exporter-messages", () => <ExportMessagesButton />, 4);
        addChannelToolbarButton("esharq-exporter-memberlist", () => <MemberListToolbarButton />, 5);
    },

    stop() {
        removeHeaderBarButton("esharq-exporter-messages");
        removeChannelToolbarButton("esharq-exporter-memberlist");
    }
});
