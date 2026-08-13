/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    ARABIC_TABLE_GLOBAL, type ArabicMessageTable, installArabicTable,
    MESSAGE_LOADER_ANCHOR, MESSAGE_LOADER_PATTERN,
    MESSAGE_LOADER_REPLACEMENT } from "@utils/esharqLocale";
import definePlugin from "@utils/types";

// 🔴 البادئة `_` ليست تجميلاً: مُولِّد سجلّ الإضافات يستورد **كل مدخل** في
// هذا المجلد ويُسجّله بـ`module.name`. وبلا البادئة سُجّل هذا الجدول إضافةً
// اسمها `undefined`، فانهارت صفحة الإضافات ومعها العميل.
import arabicMessages from "./_arabicMessages.json";

// 🔴 **وقت الاستيراد لا وقت `start()`** — وهذا فرقٌ قِيس على عميل حيّ لا نُظِّر
// فيه: ديسكورد يُحمّل اللغة المحفوظة أثناء إقلاعه، وذلك يقع **قبل** تشغيل
// الإضافات. فحين كان التثبيت في `start()` وجد المحمّلُ الكائنَ العام غائباً،
// فأعطى ديسكورد `{}` وخزّنها في `messages.ar` **إلى الأبد** — 53 محمّلاً كلّها
// فارغة، واللغة «عربية» والواجهة إنجليزية بلا خطأ في أي سجلّ.
//
// والاستيراد مبكّر **بالضرورة لا بالحظّ**: فينكورد يقرأ `patches` من كائن
// الإضافة، فلا بدّ أن تُستورَد الوحدة قبل أن تُطبَّق أي رقعة، ومن ثمّ قبل أن
// تُنفَّذ أي وحدة رسائل مرقوعة.
//
// 🔴 التحويل عبر `unknown` ضرورة لا تساهل: JSON المستورَد تُستنتَج أجزاؤه
// مصفوفاتٍ (`(string|number)[]`) لا صفوفاً ثنائية، وما دامت في الجدول رسالة
// **كلّها مواضع إدراج بلا نصّ** («{commandName}{commandText}») فلا تداخل بين
// النوعين ويرفض المُترجِم التحويل المباشر. والشكل مضمون من مُولِّدنا نفسه:
// `buildArabicTable.mjs` يفحص كل جزء قبل الكتابة ويفشل على أي شكل آخر.
installArabicTable(arabicMessages as unknown as ArabicMessageTable);

/**
 * تعريب إشراق — يجعل **العربية لغةً يعرفها ديسكورد** ويمدّه بجدولها.
 *
 * لا يلفّ دالّة واحدة ولا يترجم عند العرض: محرّك ديسكورد نفسه يعرض
 * العربية ⇒ **صفر تكلفة تشغيل، وبلا وميض إنجليزي**.
 *
 * 🔴 **العربية لا تظهر في قائمة لغات ديسكورد**: مكانها صفحة اللغة عندنا،
 * ومنها وحدها تُفعَّل. ولا تبديل تلقائي لأحد.
 */
export default definePlugin({
    name: "EsharqArabicLocale",
    description:
        "يجعل العربية لغةً أصيلة في ديسكورد بجدول رسائل مُصرَّف — بلا غلاف وبلا تكلفة تشغيل. " +
        "Makes Arabic a native Discord locale via a compiled message table — no wrapper, no runtime cost.",
    authors: [{ name: "LOSTSTR", id: 0n }],
    required: true,

    patches: [
        // 🔴 **جدول لغات ديسكورد لا يُمَسّ** — قرار المالك: العربية إضافتنا،
        // فمكانها صفحة «الأدوات ← اللغة» عندنا لا قائمة لغات ديسكورد الرسمية.
        // ولذلك لا نقلب `enabled:false → true` هناك؛ يبقى المُدخل مُعطَّلاً في
        // قائمته، ونحن نضبط اللغة من صفحتنا مباشرةً.
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

    /** للتشخيص: كم مفتاحاً حمَّلنا فعلاً. */
    get tableSize() {
        const table = (globalThis as Record<string, unknown>)[ARABIC_TABLE_GLOBAL];
        return table === null || typeof table !== "object" ? 0 : Object.keys(table).length;
    }
});
