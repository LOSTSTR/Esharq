/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * مُدقِّق دفعات التعريب — **يمسك الأخطاء الصامتة**.
 *
 *   node scripts/esharq/intlLint.mjs
 *
 * كل خلل هنا مشترك في صفة واحدة: **لا يشتكي منه شيء وقت التشغيل**. الملفّ
 * يُقرأ، والبناء ينجح، والمستخدم يرى إنجليزيةً أو نصّاً ناقصاً بلا سبب ظاهر.
 *
 * 1. **مفتاح إنجليزي ليس في اللقطة** — حرفٌ واحد زائد في النصّ المصدر يجعل
 *    الترجمة لا تطابق شيئاً **أبداً**. أخطر خلل في كتابة الدفعات يدوياً.
 * 2. **اختلال المتغيّرات** — `{name}` سقط أو أُعيدت تسميته ⇒ نصّ ناقص عند
 *    المستخدم. (البنّاء يرفضه أيضاً، لكن الرفض بعد الترجمة إهدار.)
 * 3. **قيمة فارغة** — سطر لم يُملأ.
 * 4. **تكرار بين الدفعات** — نصّ واحد في ملفّين: الأخير يغلب صامتاً.
 * 5. **قيمة بلا حرف عربي** — قد تكون مقصودة (اسم منتج/لعبة/رمز) فتُعرَض
 *    للمراجعة ولا تُفشِل، وقد تكون سطراً نُسخ ولم يُترجم.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { readDictionaryBatches, readKeepEnglish } from "./intlDictionary.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const PLUGIN = join(ROOT, "src", "esharqplugins", "DiscordArabicizer");
const SNAPSHOT = join(PLUGIN, "coverage", "discord-keys.json");

if (!existsSync(SNAPSHOT)) {
    console.error("✖ لا لقطة مفاتيح — شغّل `pnpm intl:harvest` أوّلاً");
    process.exit(2);
}

const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
const known = new Set(Object.values(snapshot.messages));

const placeholders = text => [...text.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(m => m[1]).sort().join(",");
const hasArabic = text => /[؀-ۿ]/.test(text);

const batches = readDictionaryBatches(PLUGIN);
const keepEnglish = readKeepEnglish(PLUGIN);
const seen = new Map();

const errors = [];
const notes = [];
let entries = 0;

for (const { name, entries: table } of batches) {
    for (const [english, arabic] of Object.entries(table)) {
        entries++;

        const where = `${name} › ${JSON.stringify(english.slice(0, 60))}`;

        if (seen.has(english)) errors.push(`تكرار: ${where} — موجود سلفاً في ${seen.get(english)}`);
        else seen.set(english, name);

        if (typeof arabic !== "string" || arabic.length === 0) {
            errors.push(`قيمة فارغة: ${where}`);
            continue;
        }

        if (!known.has(english)) errors.push(`ليس في اللقطة: ${where}`);

        // اسمٌ عُرِّب: خطأ يبدو صحيحاً على الشاشة، فلا يكشفه إلّا فحص كهذا.
        if (keepEnglish.has(english)) errors.push(`اسم لا يُعرَّب: ${where} ⇒ ${JSON.stringify(arabic)}`);

        const want = placeholders(english);
        const got = placeholders(arabic);
        if (want !== got) errors.push(`متغيّرات: ${where} — يريد [${want}] ووجد [${got}]`);

        if (!hasArabic(arabic)) notes.push(`بلا حرف عربي: ${where} ⇒ ${JSON.stringify(arabic)}`);
    }
}

console.log(`الدفعات   : ${batches.length}`);
console.log(`المداخل   : ${entries}`);
console.log(`أخطاء     : ${errors.length}`);
console.log(`للمراجعة  : ${notes.length}`);

for (const line of errors.slice(0, 40)) console.log(`  ✖ ${line}`);
if (errors.length > 40) console.log(`  … و${errors.length - 40} غيرها`);
for (const line of notes.slice(0, 15)) console.log(`  · ${line}`);
if (notes.length > 15) console.log(`  … و${notes.length - 15} غيرها`);

process.exit(errors.length === 0 ? 0 : 1);
