/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "تجاوز حد رفع Discord برفع الملفات إلى خادم خارجي وإرسال الرابط في الدردشة، هذه النسخة أسرع ولا تستخدم تعديل DOM. ⚠️ تُرفع ملفّاتك إلى مضيفين خارجيين (Catbox/GoFile/Litterbox) — استخدمها على مسؤوليتك التامّة",
        "en": "Bypass Discord's upload limit by uploading files to an external server and sharing the link in chat. Faster and uses no DOM manipulation. ⚠️ Your files are uploaded to third-party hosts (Catbox/GoFile/Litterbox) — use at your own responsibility."
    },
    "options": {
        "uploader": {
            "ar": "خدمة الرفع",
            "en": "Upload service"
        },
        "autoSend": {
            "ar": "إرسال الرابط تلقائياً (أو نسخه وإدراجه في صندوق الدردشة)",
            "en": "Auto-send the link (or copy and insert it into the chat box)"
        },
        "confirmBeforeUpload": {
            "ar": "طلب تأكيد قبل الرفع",
            "en": "Request confirmation before uploading"
        },
        "showDestinationPreview": {
            "ar": "عرض خادم الوجهة والرابط في حوار التأكيد",
            "en": "Show destination host and URL in the confirmation dialog"
        },
        "wrapVideoEmbeds": {
            "ar": "اختياري: تغليف روابط الفيديو الكبيرة بـ embeds.video لتشغيل أفضل (يضيف إعادة توجيه من طرف ثالث)",
            "en": "Optional: wrap large video links with embeds.video for better playback (adds a third-party redirect)"
        },
        "renderImagePreviews": {
            "ar": "عرض معاينات الصور المضمّنة لروابط Catbox/Litter/GoFile حتى لو لم يضمّنها Discord",
            "en": "Show inline image previews for Catbox/Litter/GoFile links even if Discord does not embed them"
        },
        "litterboxTime": {
            "ar": "مدة الاحتفاظ في Litterbox",
            "en": "Retention duration in Litterbox"
        },
        "customName": {
            "ar": "اسم الرافع المخصص (للعرض فقط)",
            "en": "Custom uploader name (display only)"
        },
        "customRequestUrl": {
            "ar": "رابط طلب الرافع المخصص (ShareX: RequestURL)",
            "en": "Custom uploader request URL (ShareX: RequestURL)"
        },
        "customFileFormName": {
            "ar": "اسم نموذج ملف الرافع المخصص (ShareX: FileFormName)",
            "en": "Custom uploader file form name (ShareX: FileFormName)"
        },
        "customResponseType": {
            "ar": "نوع استجابة الرافع المخصص (ShareX: ResponseType)",
            "en": "Custom uploader response type (ShareX: ResponseType)"
        },
        "customUrlPath": {
            "ar": "مسار رابط الرافع المخصص (ShareX: URL). للـ JSON استخدم نقطة مثل data.url؛ للنص يُتجاهل.",
            "en": "Custom uploader URL path (ShareX: URL). For JSON use dot notation like data.url; ignored for Text."
        },
        "config": {
            "ar": "إعدادات الرافع",
            "en": "Uploader settings."
        }
    }
});
