/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Blurring is switched on by the `vc-dnl-active` class that index.ts puts on
 * <body> from Discord's own streaming state. It used to be decided here in CSS
 * with `body:has(div.{sidebar} > section div.{actionButtons} > button:nth-child(2).{buttonActive})`,
 * which guessed at the share-screen button by its position and mangled class
 * names — so any layout change made it match while nothing was being shared,
 * and everything stayed blurred.
 */

/**
 * 🔴 **لا بحثَ في وحدات الويبباك هنا. البتّة.**
 *
 * كانت الأصناف تُقرأ بـ`findByProps` مرّةً في `start()`، وقِيس حيّاً أنّ ذلك
 * فشل فشلاً تامّاً وصامتاً:
 *
 *  ① `findByProps("messageContent", …)` تُرجع **صفر وحدة** — ديسكورد لم يعد
 *    يكشف هذه الأصناف خاصّيّاتٍ عُليا أصلاً.
 *  ② `embedWrapper` **لم يعد له وجود** في ديسكورد الحاليّ، لا وحدةً ولا صنفاً.
 *  ③ وحتى `findCssClasses("messageContent")` تُرجع الوحدة **الخطأ**: أربع
 *    وحدات تحمل الاسم، والأولى (`messageContent__44492`) تصيب **صفر عنصر**
 *    بينما المستعملة فعلاً هي `messageContent_c19a55`.
 *
 * فكانت الورقة المحقونة تحمل تسعة محدِّداتٍ لا تصيب شيئاً، والإضافة مُفعَّلة
 * تظنّ أنّها تعمل. وهذه إضافةُ **خصوصية**: من يشارك شاشته يظنّ رسائله مموّهة
 * وهي مكشوفة للجميع. الصمت هنا أسوأ من العطل.
 *
 * ⇒ المحدِّد صار على **السمة** لا على صنفٍ مُحلَّل: `[class*="messageContent_"]`
 * يصيب أيّ نسخةٍ من الصنف مهما تغيّرت بصمتها. وقِيس على الصفحة الحيّة: عشرة
 * عناصر بالضبط من أصل ٥٨٨٠ — دقيقٌ لا يلتهم الواجهة.
 *
 * ⚠️ والزيادة هنا أأمن من النقص: لو طابق المحدِّد نوعاً آخر من محتوى الرسائل
 * فغايته أن يُموّه أكثر ممّا يلزم — وذلك مقبولٌ في إضافةٍ غايتها الستر، بينما
 * النقص يكشف ما وُعد المستخدم بستره.
 */
const STYLE: string = `body.vc-dnl-active [class*="messageContent_"] {
filter: blur(12px);
}

body.vc-dnl-active [class*="visualMediaItemContainer_"],
body.vc-dnl-active [class*="attachment_"],
body.vc-dnl-active [class*="embedFull_"] {
filter: blur(50px) brightness(0.1);
}

body.vc-dnl-active.vc-dnl-show-messages [class*="messageContent_"],
body.vc-dnl-active.vc-dnl-show-messages [class*="visualMediaItemContainer_"],
body.vc-dnl-active.vc-dnl-show-messages [class*="attachment_"],
body.vc-dnl-active.vc-dnl-show-messages [class*="embedFull_"] {
filter: none !important;
}

body.vc-dnl-active.vc-dnl-hover-to-view [class*="messageContent_"]:hover,
body.vc-dnl-active.vc-dnl-hover-to-view [class*="visualMediaItemContainer_"]:hover,
body.vc-dnl-active.vc-dnl-hover-to-view [class*="attachment_"]:hover,
body.vc-dnl-active.vc-dnl-hover-to-view [class*="embedFull_"]:hover {
filter: none !important;
}`;

export function getStyle(): string {
    return STYLE;
}
