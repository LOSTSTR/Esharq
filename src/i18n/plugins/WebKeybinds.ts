/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

// 🔴 حُدِّث مع دمج upstream: أعاد الالتزام `72cc4d111` زرّي الرجوع والتقدّم
// وحسّن دعم macOS، وأعاد صياغة الوصف — فصار وصفنا القديم يعدّ اختصارات لم
// تعد القائمة كلّها، ويُغفل Equibop، ويقول «يعمل بالكامل» بلا استثناء المتصفّح.
//
// و`en` هنا **نسخة حرفية من وصف المصدر بعد الدمج**: تركُها قديمةً يجعل
// الغلاف يطمس نصّ upstream الجديد في الوضع الإنجليزي بلا أن يشتكي شيء.
export default definePluginI18n({
    "description": {
        "ar": "يُعيد اختصارات لوحة المفاتيح المفقودة في نسخة ديسكورد على الويب. ولا يعمل بالكامل إلّا على Vesktop/Equibop/Legcord، لا داخل متصفّحك",
        "en": "Re-adds keybinds missing in the web version of Discord. Only works fully on Vesktop/Equibop/Legcord, not inside your browser"
    }
});
