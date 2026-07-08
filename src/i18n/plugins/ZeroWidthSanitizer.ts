/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يزيل المحارف الخفيّة صفرية العرض من رسائلك الصادرة لمنع البصمة والتتبّع — مضبوط في إشراق ليحافظ على محارف وصل العربية وثنائي الاتجاه (RTL) فلا يكسر تنسيق كتابتك العربية.",
        "en": "Removes invisible zero-width characters from messages to prevent fingerprinting and tracking"
    },
    "options": {
        "sanitizeOutgoing": { "ar": "تنظيف الرسائل الصادرة (قبل الإرسال)." },
        "sanitizeEdits": { "ar": "تنظيف الرسائل المعدّلة أيضاً." },
        "showToastOnDetection": { "ar": "إظهار تنبيه عند رصد محارف خفيّة." },
        "verboseLogs": { "ar": "إظهار سجلّات تفصيلية في الكونسول." }
    }
});
