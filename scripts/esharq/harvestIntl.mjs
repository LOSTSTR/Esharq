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
 *
 * 🔑 **الشجرة تُسلسَل هنا لا في الصفحة** (`intlAst.mjs`)، فتدخل اللقطة
 * أيضاً المفاتيحُ ذات البنى (جمع · تنسيق نصّ · تواريخ) التي كانت تُسقَط.
 * ويُحفظ معها **مرجع الأشجار الخام** `discord-icu.json` ليكون الاختبار
 * الذاتي قادراً على البرهنة بلا عميل حيّ.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { attachToDiscord } from "./cdp.mjs";
import { astToSource } from "./intlAst.mjs";
import { readDictionary } from "./intlDictionary.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const SNAPSHOT_DIR = join(ROOT, "src", "esharqplugins", "DiscordArabicizer", "coverage");
const SNAPSHOT = join(SNAPSHOT_DIR, "discord-keys.json");
const MISSING = join(SNAPSHOT_DIR, "untranslated.json");
const CORPUS = join(SNAPSHOT_DIR, "discord-icu.json");

const accept = process.argv.includes("--accept");

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

// ── الشجرة ⇒ نصّ مصدر ──────────────────────────────────────────────────
// 🔴 ما لا يُسلسَل **يُحصى ويُسمّى** ولا يُبتلع: بنية جديدة يضيفها ديسكورد
// تظهر هنا رقماً يُلاحَظ، لا نقصاً صامتاً في التغطية يُكتشف بعد شهور.
const messages = {};
const icu = {};
const unsupported = [];

for (const [key, value] of Object.entries(harvest.messages)) {
    let source;
    try {
        source = astToSource(value);
    } catch (error) {
        unsupported.push({ key, reason: error.message });
        continue;
    }
    if (source.length === 0) continue;

    messages[key] = source;
    // الأشجار المركّبة وحدها تدخل المرجع: البسيطة يُعيد بناءها المُحلِّل
    // من نصّها، فحفظها تكرارٌ يُضخّم الملفّ بلا فائدة.
    if (typeof value !== "string" && value.some(part => typeof part !== "string"
        && !(Array.isArray(part) && part[0] === 1))) {
        icu[key] = value;
    }
}

// 🔴 القاموس من المصدر المشترك لا من قراءة محلّية: كانت هنا نسخة تقرأ
// `translations.ts` وحده فتُسقط دفعات `dictionary/*.json` كلّها — فأعلن
// التقرير تغطيةً أقلّ من الحقيقة بآلاف المفاتيح، ولا شيء يكشف ذلك إلّا
// مقارنة رقمه برقم الطابور.
const dictionary = readDictionary(join(ROOT, "src", "esharqplugins", "DiscordArabicizer"));
const keys = Object.keys(messages);

const translated = [];
const untranslated = [];
for (const key of keys) {
    (dictionary.has(messages[key]) ? translated : untranslated).push(key);
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
        && previous.messages[key] !== messages[key]);

// ── التقرير ────────────────────────────────────────────────────────────
const percent = keys.length === 0 ? 0 : (translated.length / keys.length) * 100;

console.log(`جداول الرسائل المقروءة : ${harvest.tables}`);
console.log(`مفاتيح ديسكورد الحيّة   : ${keys.length}`);
console.log(`  منها ذات بنى ICU     : ${Object.keys(icu).length} (جمع · تنسيق نصّ · تواريخ)`);
console.log(`مُنسِّقات برمجية (تُتخطّى) : ${harvest.callables ?? 0}`);
console.log(`قاموسنا                : ${dictionary.size} مدخلاً`);
console.log(`مُعرَّب                  : ${translated.length} (${percent.toFixed(1)}%)`);
console.log(`باقٍ                    : ${untranslated.length}`);

if (unsupported.length > 0) {
    console.log(`\n⚠️ بنى لم تُفهَم: ${unsupported.length} — بنيةٌ جديدة عند ديسكورد تحتاج تعليم \`intlAst.mjs\``);
    for (const item of unsupported.slice(0, 5)) console.log(`    ✖ ${item.key}: ${item.reason}`);
}

if (previous !== null) {
    console.log(`\nمنذ آخر لقطة (${previous.takenAt}):`);
    console.log(`  نصوص جديدة أضافها ديسكورد : ${added.length}`);
    console.log(`  نصوص تغيّرت صياغتها        : ${changed.length}`);
    for (const key of added.slice(0, 5)) console.log(`    + ${messages[key].slice(0, 70)}`);
    for (const key of changed.slice(0, 5)) console.log(`    ~ ${messages[key].slice(0, 70)}`);
}

mkdirSync(SNAPSHOT_DIR, { recursive: true });
writeFileSync(MISSING, JSON.stringify({
    takenAt: new Date().toISOString(),
    total: keys.length,
    translated: translated.length,
    untranslated: untranslated.map(key => ({ key, en: messages[key] }))
}, null, 2), "utf8");
console.log(`\nطابور العمل: ${MISSING}`);

if (accept || previous === null) {
    writeFileSync(SNAPSHOT, JSON.stringify({
        takenAt: new Date().toISOString(),
        build: harvest.tables,
        messages
    }), "utf8");
    // 🔴 المرجع الخام يُكتب **مع اللقطة لا قبلها**: مرجعٌ من حصادٍ ولقطةٌ من
    // آخر يجعل الاختبار الذاتي يبرهن على شيء لا يُشحَن.
    writeFileSync(CORPUS, JSON.stringify(icu), "utf8");
    console.log(`اللقطة المرجعية حُفظت: ${SNAPSHOT}`);
    console.log(`مرجع البنى حُفظ      : ${CORPUS} (${Object.keys(icu).length} شجرة)`);
} else if (added.length > 0 || changed.length > 0) {
    // 🔴 لا تُعتمَد اللقطة تلقائياً: اعتمادها يمحو «الجديد» قبل أن يُترجَم،
    // فيصير المحرس يخدع نفسه. الاعتماد **قرار مُعلَن** بـ--accept.
    console.log("\n⚠️ هناك جديد لم يُترجَم — اللقطة لم تُحدَّث. بعد الترجمة: --accept");
    process.exit(1);
}
