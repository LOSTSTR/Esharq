/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * وصل دفعة مترجَمة بمفاتيحها.
 *
 *   node scripts/esharq/intlApply.mjs .work/intl/batch-001.json .work/intl/ar-001.txt 001
 *
 * ## لماذا لا تُكتب الترجمة في ملفّ المفاتيح مباشرةً
 *
 * لأن **إعادة كتابة النصّ الإنجليزي بيد بشر أو نموذج خطرٌ صامت**: فاصلة
 * عليا مائلة `’` تُكتب `'`، أو مسافة مزدوجة تُختصر ⇒ المفتاح لا يطابق شيئاً
 * أبداً، والبناء ينجح، والمستخدم يرى إنجليزيةً بلا سبب ظاهر. فالمفاتيح
 * تبقى كما خرجت من اللقطة **بلا لمس**، ولا يُكتب إلّا الترجمة.
 *
 * ## شكل ملفّ القيم
 *
 * سطر لكل مدخل: `رقم<جدولة>الإنجليزي<جدولة>الترجمة`.
 *
 * 🔴 **العمود الإنجليزي ليس تكراراً — هو الفحص.** الترقيم وحده لا يكفي: أوّل
 * دفعة كُتبت به قلبت سطرين متجاورين (`Jordan`/`Journal`) فصار «دفتر» اسم
 * دولة و«الأردن» اسم صفحة — والترقيم سليم والملفّ صحيح والخلل لا يظهر إلّا
 * لقارئ عربي ينظر إلى الشاشة. بوجود العمود يُقارَن كل سطر بمفتاحه فيسقط
 * الانزياح **عند البناء لا عند المستخدم**.
 *
 * `\n` في القيمة تعني سطراً جديداً (النصوص متعدّدة الأسطر موجودة).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const OUT_DIR = join(ROOT, "src", "esharqplugins", "DiscordArabicizer", "dictionary");

const [batchPath, valuesPath, name] = process.argv.slice(2);

if (batchPath === undefined || valuesPath === undefined || name === undefined) {
    console.error("الاستعمال: intlApply.mjs <ملف-المفاتيح> <ملف-القيم> <اسم-الدفعة>");
    process.exit(2);
}

const keys = Object.keys(JSON.parse(readFileSync(batchPath, "utf8")));

const lines = readFileSync(valuesPath, "utf8")
    .split(/\r?\n/)
    .filter(line => line.trim().length > 0);

const table = {};
const problems = [];

for (const line of lines) {
    const columns = line.split("\t");
    if (columns.length < 3) { problems.push(`أعمدة ناقصة: ${line.slice(0, 60)}`); continue; }

    const index = Number(columns[0]);
    const claimed = columns[1].replace(/\\n/g, "\n");
    const arabic = columns.slice(2).join("\t").replace(/\\n/g, "\n");

    if (!Number.isInteger(index) || index < 1 || index > keys.length) {
        problems.push(`رقم خارج المدى: ${line.slice(0, 60)}`);
        continue;
    }

    const english = keys[index - 1];

    if (claimed !== english) {
        problems.push(`انزياح عند ${index}: يخصّ ${JSON.stringify(english.slice(0, 40))} لا ${JSON.stringify(claimed.slice(0, 40))}`);
        continue;
    }
    if (english in table) problems.push(`رقم مكرّر: ${index}`);
    if (arabic.trim().length === 0) { problems.push(`قيمة فارغة عند ${index}`); continue; }

    table[english] = arabic;
}

if (problems.length > 0) {
    for (const problem of problems.slice(0, 20)) console.error(`  ✖ ${problem}`);
    console.error(`✖ ${problems.length} خللاً — لم يُكتب شيء`);
    process.exit(1);
}

const written = Object.keys(table).length;
if (written !== keys.length) {
    console.error(`✖ ${written} ترجمة مقابل ${keys.length} مفتاحاً — ناقص، لم يُكتب شيء`);
    const missing = keys.map((_, i) => i + 1).filter(i => !(keys[i - 1] in table));
    console.error(`  الأرقام الناقصة: ${missing.slice(0, 30).join(", ")}${missing.length > 30 ? " …" : ""}`);
    process.exit(1);
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const out = join(OUT_DIR, `${name}.json`);
writeFileSync(out, JSON.stringify(table, null, 1), "utf8");

console.log(`✔ ${written} مدخلاً ⇒ ${out}`);
