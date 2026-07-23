/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "احقن رسائل ومكالمات وهمية محلياً في محادثة خاصة أو جماعية بأي تاريخ ووقت تختاره، أو شغّل رنين مكالمة واردة حقيقيّة (شاشة ديسكورد ونغمتها الأصليّة). تأثير بصري بحت مخزَّن في عميلك فقط — لا يُرسَل شيء أبداً، وأنت وحدك من يراه. الرسائل وسجلّات المكالمات تبقى بعد إعادة التحميل حتى تمسحها.",
        "en": "Inject fake local messages and call logs into a DM or group DM at any date/time, or trigger a genuine incoming call ring (Discord's own ring screen and ringtone). Purely visual and stored only in your client — nothing is ever sent, and only you can see them. Messages and call logs persist across reloads until you clear them."
    }
});
