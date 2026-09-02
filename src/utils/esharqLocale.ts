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
    "getOwnPropertyDescriptor:(t,k)=>({configurable:true,enumerable:true," +
    `value:(globalThis.${ARABIC_TABLE_GLOBAL}||{})[k]})})})}`;

/** المُحدِّد الذي يختار وحدات محمّلات الرسائل. */
export const MESSAGE_LOADER_ANCHOR = "makeMessagesProxy";

/**
 * جزء من رسالة، بالأنواع التسعة التي يرقّمها ديسكورد.
 *
 * 🔴 النوع كان `string | [1, string]` وحده، وهو ما جعل **3,892 مفتاحاً**
 * خارج التعريب: كل ما فيه جمعٌ أو نصٌّ منسّق أو تاريخ. وتلك بالضبط النصوص
 * التي كانت الإضافة القديمة تُطاردها بطبقة تشغيل. توسيعُ النوع هنا مع
 * `intlAst.mjs` يجعل **مُنسِّق ديسكورد** يختار صيغة الجمع العربية ويُدرج
 * العدد — بلا سطر كود يعمل عند المستخدم.
 */
export type MessagePart =
    | string
    /** `{name}` — موضع إدراج. */
    | readonly [1, string]
    /** `{name, number}` — عدد مُنسَّق. */
    | readonly [2, string]
    /** `{name, date, style}` · `{name, time, style}`. */
    | readonly [3 | 4, string, string]
    /** `{name, select, …}` — تفريع على قيمة. */
    | readonly [5, string, MessageBranches]
    /** `{name, plural, …}` — تفريع على عدد، بإزاحة ونوع. */
    | readonly [6, string, MessageBranches, number, string]
    /** `#` — العدد داخل فرع الجمع. */
    | readonly [7]
    /** `<tag>…</tag>` بأبنائه، ووسيطه إن كان له وسيط. */
    | readonly [8, string, readonly MessagePart[]]
    | readonly [8, string, readonly MessagePart[], readonly MessagePart[]];

/** فروع الجمع أو الاختيار: اسم الفرع ← أجزاؤه. */
export type MessageBranches = Readonly<Record<string, readonly MessagePart[]>>;

/** الجدول كما يفهمه ديسكورد: مفتاح مُجزَّأ ← شجرة أجزاء. */
export type ArabicMessageTable = Readonly<Record<string, readonly MessagePart[]>>;

// 🔴 عزل ثنائي الاتجاه للجدول كلّه — نفس ما يفعله `t()` لسلاسل الإضافات
// (RLI U+2067 … PDI U+2069)، لكن لرسائل ديسكورد نفسه.
//
// ── لماذا يلزم ────────────────────────────────────────────────────────
// «ar» ليست في قائمة لغات ديسكورد، فلا يضبط لها اتجاه الصفحة RTL؛ تبقى
// الحاوية LTR. والنصّ العربيّ الخالص يُقرأ صحيحاً فيها، لكنّ الرسالة
// **المختلطة** (سعرٌ أو رقمٌ أو إنجليزيّ وسط العربيّ) يعيد خوارزم bidi
// ترتيبَها بصرياً فتنكسر. قِيس حيّاً على خطط نيترو: «تبدأ الخطط من
// {IDR 29,000} شهرياً…» تُعرَض «…شهرياً وألغِ متى شئت IDR تبدأ الخطط من
// 29,000». ولفُّ الرسالة بـ RLI…PDI يفرض RTL ويعزلها عن اتجاه الحاوية،
// فيُصلح كلّ الرسائل المختلطة دفعةً — لا رسالةً رسالة.
const RLI = String.fromCharCode(0x2067);
const PDI = String.fromCharCode(0x2069);
const HAS_ARABIC = /[؀-ۿ]/;

/** فحصٌ متدرّجٌ يلتقط العربيّ ولو كان داخل وسمٍ أو فرعِ جمع؛ يقصُر عند أوّل حرف. */
function hasArabic(node: unknown): boolean {
    if (typeof node === "string") return HAS_ARABIC.test(node);
    if (Array.isArray(node)) {
        for (const child of node) if (hasArabic(child)) return true;
        return false;
    }
    if (node && typeof node === "object") {
        for (const key of Object.keys(node)) if (hasArabic((node as Record<string, unknown>)[key])) return true;
    }
    return false;
}

/** يلفّ الرسالة بعازل RTL إن حوت عربياً — كـ`t()` تماماً. */
function isolateRtl(parts: readonly MessagePart[]): readonly MessagePart[] {
    return hasArabic(parts) ? [RLI, ...parts, PDI] : parts;
}

/**
 * يُثبّت الجدول على الكائن العام **قبل** تنفيذ أي وحدة رسائل.
 * الكود المُعدَّل يقرأه من هناك، فوجوده مبكراً شرط لا رفاهية.
 *
 * 🔴 يُعزَل كلّ نصٍّ عربيّ بـ RLI…PDI هنا (مرّةً عند التثبيت)، فلا تتشظّى
 * الرسائل المختلطة في حاوية ديسكورد اللاتينية. انظر التعليق أعلاه.
 */
export function installArabicTable(table: ArabicMessageTable): void {
    const isolated: Record<string, readonly MessagePart[]> = {};
    for (const key of Object.keys(table)) isolated[key] = isolateRtl(table[key]);
    (globalThis as Record<string, unknown>)[ARABIC_TABLE_GLOBAL] = isolated;
}

/** هل الجدول مُثبَّت؟ يُستعمل في التشخيص لا في المسار الساخن. */
export function arabicTableSize(): number {
    const table = (globalThis as Record<string, unknown>)[ARABIC_TABLE_GLOBAL];
    return table === null || typeof table !== "object" ? 0 : Object.keys(table).length;
}
