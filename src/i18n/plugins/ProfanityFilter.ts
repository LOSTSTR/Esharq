/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": { "ar": "يزيل بصرامة كلمات يحدّدها المستخدم من رسائلك الصادرة (كلمة كاملة فقط). يرسل :duck: إن أفرغ الترشيح الرسالة.", "en": "Strictly removes user-defined words from outgoing messages (whole-word only). Sends :duck: if filtering empties the message." },
    "options": {
        "enabled": { "ar": "ترشيح الرسائل الصادرة (Ctrl+Alt+P يبدّله في أي مكان)." },
        "words": { "ar": "الكلمات المراد ترشيحها، مفصولة بفواصل أو أسطر. كلمة كاملة بصرامة، غير حسّاس لحالة الأحرف." },
        "duckOnEmpty": { "ar": "إرسال :duck: عندما يُفرِغ الترشيح الرسالة. عند الإيقاف: الرسالة الفارغة لا تُرسَل شيئاً." }
    }
});
