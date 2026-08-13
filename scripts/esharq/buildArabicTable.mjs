/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Esharq contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * بناء جدول الرسائل العربية المُصرَّف — **الوصل بين الحصاد وقاموسنا**.
 *
 *   node scripts/esharq/buildArabicTable.mjs
 *
 * المدخلان: لقطة مفاتيح ديسكورد الحيّة (`مفتاح مُجزَّأ → إنجليزي`) وقاموسنا
 * (`إنجليزي → عربي`). المخرج: **`مفتاح مُجزَّأ → شجرة أجزاء عربية`** — نفس
 * الشكل الذي ينتظره محرّك ديسكورد بالضبط.
 *
 * ## لماذا شجرة أجزاء لا نصّ
 *
 * رُصد من حزمة رسائل حقيقية أن القيمة **مصفوفة**: نصوص حرفية و`[1,"اسم"]`
 * لمواضع الإدراج. فنُخرج نفس الشكل ⇒ **التنسيق والتعدّد يعملان بلا كود
 * منّا**، ويتولّى مُنسِّق ديسكورد الإدراج.
 *
 * ## 🔴 الفحص الذي لا يُتنازَل عنه
 *
 * **تطابق البنية بين الإنجليزية والعربية**: المتغيّرات وأنواعها، وأسماء
 * الوسوم، وأطراف الاختيار. ترجمة تُسقط متغيّراً أو تُعيد تسميته تُنتج نصّاً
 * ناقصاً عند المستخدم **ولا يشتكي شيء** — المفتاح موجود والقيمة «صالحة».
 * فتُرفَض هنا وتُحصى، لا تُشحن.
 *
 * 🔑 **وصيغ الجمع مستثناة من التطابق قصداً**: الإنجليزية فرعان
 * (`one`/`other`) والعربية ستّة (`zero` … `other`). اشتراط تطابقها يرفض كل
 * ترجمة عربية صحيحة — وهذا بالضبط ما يجعل «12 صديقاً مشتركاً» تُصاغ صياغةً
 * عربية سليمة **يختارها مُنسِّق ديسكورد** بلا سطر كود عندنا.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { astToSource, NODE, sourceToAst, validateTranslation } from "./intlAst.mjs";
import { readDictionary } from "./intlDictionary.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const PLUGIN = join(ROOT, "src", "esharqplugins", "DiscordArabicizer");
const SNAPSHOT = join(PLUGIN, "coverage", "discord-keys.json");

// 🔴 يُكتب **مباشرةً في الملف المشحون** الذي تستورده `arabicLocale.ts`، لا في
// نسخة وسيطة تُنقل يدوياً: نسخة وسيطة تعني أن إعادة البناء تترك الجدول
// المشحون قديماً **بلا شكوى من أحد** — يعمل البناء، ويشحن المستخدم القديم.
// والبادئة `_` شرط لا تسمية: مُولِّد السجلّ يستورد كل مدخل في مجلد الإضافات،
// فملف بيانات بلا بادئة يُسجَّل إضافةً اسمها `undefined` ويُسقط صفحة الإضافات.
const OUT = join(ROOT, "src", "plugins", "_core", "_arabicMessages.json");

if (!existsSync(SNAPSHOT)) {
    console.error("✖ لا لقطة مفاتيح — شغّل `pnpm intl:harvest` أوّلاً");
    process.exit(2);
}

const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
const dictionary = readDictionary(PLUGIN);

const table = {};
let matched = 0;
let missing = 0;
let withStructure = 0;
const rejected = [];

for (const [key, english] of Object.entries(snapshot.messages)) {
    const arabic = dictionary.get(english);
    if (arabic === undefined) { missing++; continue; }

    const problem = validateTranslation(english, arabic);
    if (problem !== null) {
        // 🔴 نصّ ناقص عند المستخدم بلا شكوى من أحد — يُرفَض ويُحصى.
        rejected.push({ key, en: english, ar: arabic, problem });
        continue;
    }

    const parts = sourceToAst(arabic);
    table[key] = parts;
    matched++;
    if (parts.some(part => Array.isArray(part) && part[0] !== NODE.ARGUMENT)) withStructure++;
}

// 🔴 فحص قبل الكتابة: الجدول يُستورَد في `arabicLocale.ts` بتحويل عبر
// `unknown` (لأن JSON المستورَد لا يُستنتَج صفوفاً)، والتحويل يُسكِت المُترجِم
// — فلو خرجت شجرةٌ بشكل آخر لمرّت إلى ديسكورد بلا اعتراض من أحد.
//
// والمِحكّ **دورة كاملة لا قائمة أشكال مسموحة**: تسلسلُ ما بنيناه يجب أن
// يُعيد نصّ الترجمة حرفاً بحرف. قائمة الأشكال تنسى نوعاً يُضاف لاحقاً؛
// والدورة تكشف أي انحراف مهما كان نوعه.
for (const [key, parts] of Object.entries(table)) {
    const arabic = dictionary.get(snapshot.messages[key]);
    let again;
    try {
        again = astToSource(parts);
    } catch (error) {
        console.error(`✖ شجرة لا تُسلسَل في ${key}: ${error.message}`);
        process.exit(1);
    }
    if (again !== arabic) {
        console.error(`✖ دورة غير مغلقة في ${key}:\n    ترجمة: ${JSON.stringify(arabic)}\n    عائد : ${JSON.stringify(again)}`);
        process.exit(1);
    }
}

writeFileSync(OUT, JSON.stringify(table), "utf8");

const total = Object.keys(snapshot.messages).length;
console.log(`مفاتيح اللقطة        : ${total}`);
console.log(`مُصرَّف إلى العربية    : ${matched} (${((matched / total) * 100).toFixed(1)}%)`);
console.log(`  منها ذات بنى ICU   : ${withStructure} (جمع · وسوم · تواريخ)`);
console.log(`بلا ترجمة            : ${missing}`);
console.log(`مرفوض (بنية)         : ${rejected.length}`);
console.log(`الحجم                : ${(readFileSync(OUT).length / 1024).toFixed(0)}KB`);
console.log(`المخرج               : ${OUT}`);

for (const item of rejected.slice(0, 5)) {
    console.log(`  ✖ ${item.key}: ${item.problem}`);
}

if (rejected.length > 0) {
    writeFileSync(join(PLUGIN, "coverage", "placeholder-mismatch.json"),
        JSON.stringify(rejected, null, 2), "utf8");
}
