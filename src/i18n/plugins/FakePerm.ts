/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يُحاكي بصرياً خيارات الإشراف في قائمة النقر بالزر الأيمن (كتم، إصمام، طرد، حظر، مهلة، رتب...). محلي بالكامل — لا يُرسَل أي إجراء فعلي إلى ديسكورد.",
        "en": "Visually simulates moderation options in the right-click menu (mute, deafen, kick, ban, timeout, roles...). Entirely local — no real action is ever sent to Discord."
    },
    "options": {
        "enabled": {
            "ar": "تفعيل الصلاحيات الوهمية في قائمة النقر بالزر الأيمن",
            "en": "Enable fake permissions in right-click menu"
        }
    }
});
