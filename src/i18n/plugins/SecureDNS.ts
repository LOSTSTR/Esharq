/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يحلّ مضيفات تطبيق ديسكورد عبر DNS آمن (DNS over HTTPS) باستخدام خوادم Mullvad العامة. ⚠️ يستخدم وحدة native؛ وخيار «Rewrite fetch URLs» التجريبي قد يكسر HTTPS — اتركه مُطفأً ما لم تفهمه.",
        "en": "Resolve client application hosts through a secure DNS over HTTPS via Mullvad's public resolvers. ⚠️ Uses a native module; the experimental 'Rewrite fetch URLs' option can break HTTPS — keep it off unless you understand it."
    },
    "options": {
        "dnsProfile": {
            "ar": "اختر ملفّ DNS الآمن المُستخدَم (أساسي، حظر إعلانات، عائلي…).",
            "en": "Choose which secure DNS profile to use."
        },
        "resolverMode": {
            "ar": "اختر كيف يحلّ DNS الآمن أسماء المضيفات.",
            "en": "Choose how secure DNS should resolve hostnames."
        },
        "trackedDomains": {
            "ar": "النطاقات المراد تحليلها، نطاق واحد في كل سطر.",
            "en": "Domains to resolve, one per line."
        },
        "preferIPv6": {
            "ar": "تفضيل إجابات IPv6 عندما يُرجعها المحلّل.",
            "en": "Prefer IPv6 answers when the resolver returns them."
        },
        "rewriteFetch": {
            "ar": "إعادة كتابة روابط fetch إلى عناوين IP المُحلّلة. تجريبيّ وقد يكسر HTTPS.",
            "en": "Rewrite fetch URLs to resolved IPs. This is experimental and can break HTTPS."
        },
        "preloadOnStart": {
            "ar": "تحميل إجابات DNS للنطاقات المتتبَّعة مسبقاً عند البدء.",
            "en": "Preload DNS answers for tracked domains on startup."
        },
        "cacheMinutes": {
            "ar": "مدّة بقاء إجابات DNS في الذاكرة المؤقتة.",
            "en": "How long DNS answers stay cached."
        },
        "requestTimeoutMs": {
            "ar": "مدّة الانتظار قبل انتهاء مهلة طلب DNS.",
            "en": "How long to wait before a DNS request times out."
        },
        "enableLogging": {
            "ar": "تفعيل التسجيل المُفصّل.",
            "en": "Enable detailed logging."
        },
        "showNotifications": {
            "ar": "إظهار تنبيهات منبثقة عند تغيّر حالة DNS.",
            "en": "Show toast notifications for DNS status changes."
        },
        "autoStart": {
            "ar": "تشغيل المحلّل عند تحميل الإضافة.",
            "en": "Start the resolver when the plugin loads."
        },
        "logLevel": {
            "ar": "اختر مستوى التسجيل.",
            "en": "Choose the logging level."
        }
    }
});
