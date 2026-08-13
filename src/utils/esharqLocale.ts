/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * تعريب إشراق — **على مستوى البيانات، بصفر تكلفة تشغيل**.
 *
 * الفكرة: لا نلفّ دوالّ `intl` ولا نترجم عند العرض. نجعل **العربية لغةً
 * يعرفها ديسكورد** ونمدّه بجدول رسائلها، فيعرضها محرّكه بنفسه.
 *
 * ⇒ صفر غلاف · صفر تكلفة على كل نصّ · بلا وميض إنجليزي · وبلا حاجة
 * لإعادة تشغيل. وهو ما يستبدل أسلوب `DiscordArabicizer` القديم.
 *
 * ## تعديلان لا أكثر — كلاهما مُثبَت على عميل حيّ
 *
 * 1. **إتاحة العربية**: ديسكورد يعرفها ويعطّلها
 *    (`{"englishName":"Arabic","code":"ar","enabled":false}`) والتفاوض
 *    يُرشّح `filter(e => e.enabled)` فتسقط. نقلب `false → true`.
 *    (طُبِّق حيّاً على **وحدتين** — جدولان، أحدهما بحقل إضافي.)
 *
 * 2. **محمّل الرسائل**: لكل نطاق رسائل خريطة `لغة → حزمة كسولة`. نُلحق
 *    مدخل `ar` يُرجع جدولنا **من الذاكرة بلا شبكة**.
 *    (طُبِّق حيّاً على **55 موضعاً** من 57 مطابقة.)
 *
 * 🔴 **الإتاحة ليست التفعيل**: لا نبدّل لغة أحد. تظهر العربية في قائمة
 * ديسكورد، والمستخدم يختارها. لا `setLocale` تلقائي في أي مسار.
 *
 * ## دروس مدفوعة الثمن — مثبَّتة في الأنماط أدناه
 *
 * - **لا تُثبَّت أسماء webpack المُصغَّرة**: أوّل نسخة ثبّتت `n.` فمرّت على
 *   حزمة الويب (صادف أن الـ31 كلّها `n`) و**عدّلت صفراً على سطح المكتب**.
 *   الآن الاسم يُلتقط بمرجع خلفي `\2`.
 * - **المرساة نهاية الخريطة لا بدايتها**: البداية طابقت 24 من 31 فقط
 *   (أسماء مختلفة)، والنهاية (مدخل `en-US` ثم الإغلاق) طابقت 31 من 31.
 * - **الحمولة تُصدَّر على `default`** — مرصود من حزمة رسائل حقيقية، فلا
 *   يُرجع المحمّل الجدول عارياً.
 */

/** الاسم العام الذي يُثبَّت عليه الجدول قبل تنفيذ أي وحدة رسائل. */
export const ARABIC_TABLE_GLOBAL = "__esharqArabicMessages";

/** رمز لغة ديسكورد للعربية. */
export const ARABIC_LOCALE = "ar";

/**
 * (1) قلب العربية إلى مُفعَّلة في جدول اللغات.
 *
 * الحقول الاختيارية بين `code` و`enabled` تختلف بين الجدولين (أحدهما فيه
 * `postgresLang`)، فالنمط يقبل أي عدد منها بدل تثبيت ترتيب بعينه.
 */
export const ENABLE_ARABIC_PATTERN = /("code":"ar"(?:,"[A-Za-z]+":"[^"]*")*,"enabled":)false/g;
export const ENABLE_ARABIC_REPLACEMENT = "$1true";

/** المُحدِّد الذي يختار وحدات جدول اللغات. */
export const LANGUAGE_TABLE_ANCHOR = "\"englishName\":\"Arabic\"";

/**
 * (2) إلحاق مدخل `ar` بخرائط محمّلات الرسائل.
 *
 * `\2` مرجع خلفي لاسم معامل webpack المُصغَّر — يُلتقط ولا يُثبَّت.
 */
export const MESSAGE_LOADER_PATTERN =
    /("en-US":\(\)=>([A-Za-z_$][\w$]*)\.e\("\d+"\)\.then\(\2\.bind\(\2,\d+\)\))\}/g;

/**
 * الحمولة **مرآة حيّة** لا لقطة.
 *
 * 🔴 السبب مقيس لا مُفترَض: `??{}` كانت تُجمّد كائناً فارغاً إن سبق تحميلُ
 * اللغة تثبيتَ الجدول، وديسكورد يحفظ ما يُعطى في `messages.ar` فلا يسأل
 * مرّة أخرى — فتبقى الواجهة إنجليزية بلا خطأ في أي سجلّ. الوسيط يقرأ من
 * الكائن العام **عند كل استعلام**، فيصحّ الترتيب أو لا يصحّ ولا فرق.
 */
export const MESSAGE_LOADER_REPLACEMENT =
    `$1,${ARABIC_LOCALE}:()=>Promise.resolve({default:new Proxy({},{` +
    `get:(t,k)=>(globalThis.${ARABIC_TABLE_GLOBAL}||{})[k],` +
    `has:(t,k)=>k in (globalThis.${ARABIC_TABLE_GLOBAL}||{}),` +
    `ownKeys:()=>Reflect.ownKeys(globalThis.${ARABIC_TABLE_GLOBAL}||{}),` +
    `getOwnPropertyDescriptor:(t,k)=>({configurable:true,enumerable:true,` +
    `value:(globalThis.${ARABIC_TABLE_GLOBAL}||{})[k]})})})}`;

/** المُحدِّد الذي يختار وحدات محمّلات الرسائل. */
export const MESSAGE_LOADER_ANCHOR = "makeMessagesProxy";

/** جزء من رسالة: نصّ حرفيّ أو موضع إدراج `[1, "اسم"]`. */
export type MessagePart = string | readonly [1, string];

/** الجدول كما يفهمه ديسكورد: مفتاح مُجزَّأ ← شجرة أجزاء. */
export type ArabicMessageTable = Readonly<Record<string, readonly MessagePart[]>>;

/**
 * يُثبّت الجدول على الكائن العام **قبل** تنفيذ أي وحدة رسائل.
 * الكود المُعدَّل يقرأه من هناك، فوجوده مبكراً شرط لا رفاهية.
 */
export function installArabicTable(table: ArabicMessageTable): void {
    (globalThis as Record<string, unknown>)[ARABIC_TABLE_GLOBAL] = table;
}

/** هل الجدول مُثبَّت؟ يُستعمل في التشخيص لا في المسار الساخن. */
export function arabicTableSize(): number {
    const table = (globalThis as Record<string, unknown>)[ARABIC_TABLE_GLOBAL];
    return table === null || typeof table !== "object" ? 0 : Object.keys(table).length;
}
