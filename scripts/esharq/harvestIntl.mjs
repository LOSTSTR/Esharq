/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Esharq contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * حصاد مفاتيح ديسكورد وتقرير التغطية — **ومحرس النصوص الجديدة**.
 *
 *   node scripts/esharq/harvestIntl.mjs            حصاد + تقرير
 *   node scripts/esharq/harvestIntl.mjs --accept   واعتماد اللقطة الجديدة
 *
 * يفعل ثلاثة أشياء:
 *
 * 1. **يحصد** جدول رسائل ديسكورد الحيّ من العميل (المُنفَّذ سلفاً فقط).
 * 2. **يقيس التغطية** مقابل قاموسنا: كم مفتاحاً مُعرَّب وكم باقٍ.
 * 3. 🔑 **يكشف الجديد**: يقارن باللقطة المحفوظة فيقول **ما أضافه ديسكورد
 *    منذ آخر مرّة** — وهو ما يجعل التعريب لا يتخلّف عن تحديثاته.
 *
 * لماذا لقطة على القرص: بدونها لا يوجد «جديد» أصلاً — فقط قائمة كبيرة
 * تُقرأ مرّة وتُنسى. اللقطة تحوّل التغطية من رقم إلى **طابور عمل يتحرّك**.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { attachToDiscord } from "./cdp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const SNAPSHOT_DIR = join(ROOT, "src", "esharqplugins", "DiscordArabicizer", "coverage");
const SNAPSHOT = join(SNAPSHOT_DIR, "discord-keys.json");
const MISSING = join(SNAPSHOT_DIR, "untranslated.json");

const accept = process.argv.includes("--accept");

/** قاموسنا: نصّ إنجليزي → عربي. نقرأه نصّياً فهو ملف TypeScript. */
function readDictionary() {
    const source = readFileSync(
        join(ROOT, "src", "esharqplugins", "DiscordArabicizer", "translations.ts"), "utf8");

    const dictionary = new Set();
    // "نصّ إنجليزي": "نصّ عربي"  — نأخذ المفتاح وحده.
    for (const match of source.matchAll(/"((?:[^"\\\n]|\\.)+)"\s*:\s*"/g)) {
        dictionary.add(match[1].replace(/\\"/g, "\"").replace(/\\\\/g, "\\"));
    }
    return dictionary;
}

const session = await attachToDiscord();
if (session === undefined) {
    console.error("✖ لم أجد نافذة ديسكورد فيها webpack — شغّله بـ --remote-debugging-port=9222");
    process.exit(2);
}

const raw = await session.evaluate(readFileSync(join(HERE, "harvest-page.js"), "utf8"));
session.close();

const harvest = JSON.parse(raw ?? "{}");
if (harvest.error !== undefined) {
    console.error(`✖ ${harvest.error}`);
    process.exit(1);
}

const dictionary = readDictionary();
const keys = Object.keys(harvest.messages);

const translated = [];
const untranslated = [];
for (const key of keys) {
    (dictionary.has(harvest.messages[key]) ? translated : untranslated).push(key);
}

// ── الجديد منذ آخر لقطة ────────────────────────────────────────────────
const previous = existsSync(SNAPSHOT)
    ? JSON.parse(readFileSync(SNAPSHOT, "utf8"))
    : null;

const added = previous === null
    ? []
    : keys.filter(key => previous.messages[key] === undefined);

const changed = previous === null
    ? []
    : keys.filter(key => previous.messages[key] !== undefined
        && previous.messages[key] !== harvest.messages[key]);

// ── التقرير ────────────────────────────────────────────────────────────
const percent = keys.length === 0 ? 0 : (translated.length / keys.length) * 100;

console.log(`جداول الرسائل المقروءة : ${harvest.tables}`);
console.log(`مفاتيح ديسكورد الحيّة   : ${keys.length}`);
console.log(`قاموسنا                : ${dictionary.size} مدخلاً`);
console.log(`مُعرَّب                  : ${translated.length} (${percent.toFixed(1)}%)`);
console.log(`باقٍ                    : ${untranslated.length}`);

if (previous !== null) {
    console.log(`\nمنذ آخر لقطة (${previous.takenAt}):`);
    console.log(`  نصوص جديدة أضافها ديسكورد : ${added.length}`);
    console.log(`  نصوص تغيّرت صياغتها        : ${changed.length}`);
    for (const key of added.slice(0, 5)) console.log(`    + ${harvest.messages[key].slice(0, 70)}`);
    for (const key of changed.slice(0, 5)) console.log(`    ~ ${harvest.messages[key].slice(0, 70)}`);
}

mkdirSync(SNAPSHOT_DIR, { recursive: true });
writeFileSync(MISSING, JSON.stringify({
    takenAt: new Date().toISOString(),
    total: keys.length,
    translated: translated.length,
    untranslated: untranslated.map(key => ({ key, en: harvest.messages[key] }))
}, null, 2), "utf8");
console.log(`\nطابور العمل: ${MISSING}`);

if (accept || previous === null) {
    writeFileSync(SNAPSHOT, JSON.stringify({
        takenAt: new Date().toISOString(),
        build: harvest.tables,
        messages: harvest.messages
    }), "utf8");
    console.log(`اللقطة المرجعية حُفظت: ${SNAPSHOT}`);
} else if (added.length > 0 || changed.length > 0) {
    // 🔴 لا تُعتمَد اللقطة تلقائياً: اعتمادها يمحو «الجديد» قبل أن يُترجَم،
    // فيصير المحرس يخدع نفسه. الاعتماد **قرار مُعلَن** بـ--accept.
    console.log("\n⚠️ هناك جديد لم يُترجَم — اللقطة لم تُحدَّث. بعد الترجمة: --accept");
    process.exit(1);
}
