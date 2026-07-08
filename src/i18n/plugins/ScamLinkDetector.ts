/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يكشف روابط الاحتيال/التصيّد ويحذّرك منها اعتماداً على قاعدة Discord AntiScam العامة — التحذير يظهر لك وحدك، ولا يُرسَل أي بيان منك.",
        "en": "Detects and warns about scam links using the Discord AntiScam database"
    },
    "options": {
        "enableDebugLogs": { "ar": "تفعيل سجلّات تفصيلية في الكونسول." },
        "blockMessage": { "ar": "حذف الرسالة التي تحتوي روابط احتيال (يتطلّب صلاحية)." },
        "notifyInDMs": { "ar": "إرسال التحذير في الرسائل الخاصة بدل القناة." }
    }
});
