/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "أبقِ شكل ملفّك بعد انتهاء النيترو — اللافتة والألوان وإطار الصورة ولوحة الاسم ومؤثّر الملفّ تُلتقط وأنت مشترك، ثمّ تُعرض لك في عميلك أنت. لا يُرسَل شيء إلى ديسكورد.",
        "en": "Keep your Nitro profile look after the subscription ends — banner, colours, avatar decoration, nameplate and profile effect are captured while you have them and shown back in your own client. Nothing is sent to Discord."
    },
    "options": {
        "autoCapture": {
            "ar": "حدِّث اللقطة تلقائياً ما دام اشتراكك قائماً.",
            "en": "Keep the snapshot fresh automatically while your subscription is active."
        }
    }
});
