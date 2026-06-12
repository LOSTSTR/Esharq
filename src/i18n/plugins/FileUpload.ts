/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يرفع الملفات إلى خدمات الاستضافة مثل Zipline وNest وS3 وWebDAV",
        "en": "Upload files to hosting services like Zipline, Nest, S3, and WebDAV"
    },
    "options": {
        "encryptingHostKey": {
            "ar": "مفتاح API لخدمة Encrypting.host",
            "en": "Encrypting.host API key"
        },
        "encryptingHostUrlStyle": {
            "ar": "نمط رابط Encrypting.host",
            "en": "Encrypting.host URL style"
        },
        "encryptingHostDomains": {
            "ar": "قائمة نطاقات Encrypting.host بصيغة JSON",
            "en": "Encrypting.host domains JSON list"
        },
        "encryptingHostTitle": {
            "ar": "عنوان البطاقة في Encrypting.host (اختياري)",
            "en": "Optional Encrypting.host embed title"
        },
        "encryptingHostColor": {
            "ar": "لون البطاقة في Encrypting.host (اختياري)",
            "en": "Optional Encrypting.host embed color"
        },
        "encryptingHostFakelink": {
            "ar": "رابط وهمي لـ Encrypting.host (اختياري)",
            "en": "Optional Encrypting.host fake link"
        }
    }
});
