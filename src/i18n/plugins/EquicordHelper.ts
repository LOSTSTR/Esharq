/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "يُستخدم لتقديم الدعم وإصلاح الأعطال الناجمة عن ديسكورد وميزات متنوعة أخرى.",
        "en": "Used to provide support and fix issues caused by Discord and various other features."
    },
    "options": {
        "hideVoiceIndicatorForMutedChannels": {
            "ar": "إخفاء مؤشّر الصوت في قائمة الخوادم عندما تكون القنوات النشطة مكتومة فقط",
            "en": "Hide voice indicator in server list when only active channels are muted"
        },
        "noMirroredCamera": {
            "ar": "يمنع عكس صورة الكاميرا على شاشتك",
            "en": "Prevent the camera image from being mirrored on your screen."
        },
        "removeActivitySection": {
            "ar": "إزالة قسم النشاط فوق قائمة الأعضاء",
            "en": "Remove the activity section above the member list."
        },
        "showYourOwnActivityButtons": {
            "ar": "يُظهر أزرار نشاطك الخاصة التي يخفيها ديسكورد لأسباب غير معروفة",
            "en": "Show your own activity buttons that Discord hides for unknown reasons."
        },
        "refreshSlashCommands": {
            "ar": "تحديث أوامر Slash لإظهار الأوامر المضافة حديثاً دون إعادة تشغيل العميل.",
            "en": "Refresh slash commands to show newly added commands without restarting the client."
        },
        "forceRoleIcon": {
            "ar": "إجبار عرض أيقونات الرتب بجانب الرسائل في الوضع المضغوط",
            "en": "Force role icons to appear next to messages in compact mode."
        },
        "accountStandingButton": {
            "ar": "إظهار زر حالة الحساب في شريط الرأس",
            "en": "Show the account standing button in the header bar."
        },
        "restoreFileDownloadButton": {
            "ar": "استعادة زر التنزيل في الركن العلوي الأيمن من الملفات",
            "en": "Restore the download button in the top-right corner of files."
        },
        "noBulletPoints": {
            "ar": "منع كتابة نقاط القوائم بصيغة Markdown",
            "en": "Prevent writing bullet points in Markdown format."
        },
        "noModalAnimation": {
            "ar": "إزالة الحركة التي تستغرق 300 مللي ثانية عند فتح أو إغلاق النوافذ المنبثقة",
            "en": "Remove the 300ms animation when opening or closing modal windows."
        },
        "disableAdoptTagPrompt": {
            "ar": "تعطيل مطالبة تبني الشارات",
            "en": "Disable the adopt tag prompt."
        },
        "jsonGateway": {
            "ar": "إجبار استخدام JSON عند إعادة الاتصال بالبوابة",
            "en": "Force JSON usage when reconnecting to the gateway."
        }
    }
});
