/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    ARABIC_TABLE_GLOBAL, type ArabicMessageTable,
ENABLE_ARABIC_PATTERN, ENABLE_ARABIC_REPLACEMENT,
    installArabicTable, LANGUAGE_TABLE_ANCHOR, MESSAGE_LOADER_ANCHOR,
    MESSAGE_LOADER_PATTERN, MESSAGE_LOADER_REPLACEMENT } from "@utils/esharqLocale";
import definePlugin from "@utils/types";

// 🔴 البادئة `_` ليست تجميلاً: مُولِّد سجلّ الإضافات يستورد **كل مدخل** في
// هذا المجلد ويُسجّله بـ`module.name`. وبلا البادئة سُجّل هذا الجدول إضافةً
// اسمها `undefined`، فانهارت صفحة الإضافات ومعها العميل.
import arabicMessages from "./_arabicMessages.json";

/**
 * تعريب إشراق — يجعل **العربية لغةً يعرفها ديسكورد** ويمدّه بجدولها.
 *
 * لا يلفّ دالّة واحدة ولا يترجم عند العرض: محرّك ديسكورد نفسه يعرض
 * العربية ⇒ **صفر تكلفة تشغيل، وبلا وميض إنجليزي**.
 *
 * 🔴 **الإتاحة ليست التفعيل**: العربية تظهر في قائمة لغات ديسكورد،
 * والمستخدم يختارها. لا تبديل تلقائي لأحد.
 */
export default definePlugin({
    name: "EsharqArabicLocale",
    description:
        "يجعل العربية لغةً أصيلة في ديسكورد بجدول رسائل مُصرَّف — بلا غلاف وبلا تكلفة تشغيل. " +
        "Makes Arabic a native Discord locale via a compiled message table — no wrapper, no runtime cost.",
    authors: [{ name: "LOSTSTR", id: 0n }],
    required: true,

    patches: [
        {
            // إتاحة العربية: ديسكورد يعرفها ويعطّلها، والتفاوض يُرشّح
            // المُعطَّلة فتسقط. جدولان — أحدهما بحقول إضافية — لذلك النمط
            // يقبل ما بينهما ولا يُثبّت ترتيباً.
            find: LANGUAGE_TABLE_ANCHOR,
            all: true,
            replacement: {
                match: ENABLE_ARABIC_PATTERN,
                replace: ENABLE_ARABIC_REPLACEMENT
            }
        },
        {
            // محمّل الرسائل: نُلحق `ar` يُرجع جدولنا من الذاكرة بلا شبكة.
            // المرساة **نهاية الخريطة** لا بدايتها (البداية تطابق جزءاً
            // فقط)، والاسم المُصغَّر يُلتقط بمرجع خلفي لا يُثبَّت.
            find: MESSAGE_LOADER_ANCHOR,
            all: true,
            noWarn: true,
            replacement: {
                match: MESSAGE_LOADER_PATTERN,
                replace: MESSAGE_LOADER_REPLACEMENT
            }
        }
    ],

    start() {
        // يُثبَّت قبل أن يطلب ديسكورد أي حزمة رسائل: الكود المُعدَّل يقرأ
        // الجدول من الكائن العام عند تحميل اللغة، فغيابه يعني جدولاً فارغاً
        // وسقوطاً صامتاً إلى الإنجليزية.
        installArabicTable(arabicMessages as ArabicMessageTable);
    },

    /** للتشخيص: كم مفتاحاً حمَّلنا فعلاً. */
    get tableSize() {
        const table = (globalThis as Record<string, unknown>)[ARABIC_TABLE_GLOBAL];
        return table === null || typeof table !== "object" ? 0 : Object.keys(table).length;
    }
});
