/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "درع خصوصية شامل: يحجب تتبّع ديسكورد وSentry وبصمة المتصفح، ويمنع الروابط بالبروتوكولات الخطرة وتعداد الأجهزة وطلبات الإشعارات، ويُخفي عنوان IP في الاتصالات — دون إرسال أي بيان عنك (يحجب فقط، ويستعيد كل شيء عند الإيقاف).",
        "en": "Adds WebCord privacy hardening with network, permission, and WebRTC protections."
    },
    "options": {
        "blockTelemetry": { "ar": "حجب نقاط تتبّع ديسكورد." },
        "blockSentry": { "ar": "حجب طلبات تقارير الأعطال (Sentry)." },
        "blockFingerprinting": { "ar": "حجب نقاط بصمة المتصفح المعروفة." },
        "webRtcIcePolicy": { "ar": "كيف تكشف اتصالات WebRTC مسارات الشبكة (relay = إخفاء IP الحقيقي)." },
        "allowDeviceEnumeration": { "ar": "السماح لديسكورد بسرد أجهزة الوسائط (مصدر بصمة)." },
        "blockNotifications": { "ar": "حجب طلبات إذن الإشعارات." },
        "blockUnsafeExternalProtocols": { "ar": "حجب فتح الروابط بالبروتوكولات الخطرة (javascript:/file:…)." },
        "hideDownloadNag": { "ar": "إخفاء تنبيهات تنزيل تطبيق سطح المكتب." },
        "logBlockedRequests": { "ar": "تسجيل الطلبات المحجوبة في الكونسول." }
    }
});
