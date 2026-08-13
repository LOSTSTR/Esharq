/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * طابور التعريب — **يُخرج الدفعة التالية جاهزة للملء**.
 *
 *   node scripts/esharq/intlQueue.mjs --count 400 --out src/.../dictionary/007.json
 *
 * لا ملفّ حالة ولا عدّاد يُحفَظ: **الطابور نفسه هو الحالة**. ما تُرجم خرج
 * منه، فتشغيلٌ جديد يُعطي التالي دائماً — والاستئناف بعد أسبوع كالاستئناف
 * بعد دقيقة.
 *
 * ## الترتيب ليس اعتباطياً
 *
 * الأولوية لما **يراه المستخدم أكثر**: عدد المفاتيح التي تتشارك النصّ
 * نفسه أوّلاً (نصّ يظهر في عشرة مواضع يستحقّ الترجمة قبل نصّ يتيم)، ثم
 * الأقصر فالأطول، ثم أبجدياً لثبات الترتيب بين التشغيلات.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { readDictionary, readKeepEnglish } from "./intlDictionary.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const PLUGIN = join(ROOT, "src", "esharqplugins", "DiscordArabicizer");
const SNAPSHOT = join(PLUGIN, "coverage", "discord-keys.json");

const args = process.argv.slice(2);
const valueOf = (flag, fallback) => {
    const at = args.indexOf(flag);
    return at === -1 ? fallback : args[at + 1];
};

const count = Number(valueOf("--count", "400"));
const out = valueOf("--out", null);

if (!existsSync(SNAPSHOT)) {
    console.error("✖ لا لقطة مفاتيح — شغّل `pnpm intl:harvest` أوّلاً");
    process.exit(2);
}

const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
const dictionary = readDictionary(PLUGIN);
const keepEnglish = readKeepEnglish(PLUGIN);

/** نصّ إنجليزي ← كم مفتاحاً يستعمله. */
const frequency = new Map();
for (const english of Object.values(snapshot.messages)) {
    // ما لا يُعرَّب لا يدخل الطابور أصلاً، وإلّا عاد يُعرَض كل دفعة فيُترجَم سهواً.
    if (dictionary.has(english) || keepEnglish.has(english)) continue;
    frequency.set(english, (frequency.get(english) ?? 0) + 1);
}

const words = text => text.trim().split(/\s+/).filter(Boolean).length;

const remaining = [...frequency.keys()].sort((a, b) => {
    const byUse = frequency.get(b) - frequency.get(a);
    if (byUse !== 0) return byUse;
    const byLength = words(a) - words(b);
    if (byLength !== 0) return byLength;
    return a < b ? -1 : a > b ? 1 : 0;
});

const total = Object.keys(snapshot.messages).length;
const values = Object.values(snapshot.messages);
const done = values.filter(e => dictionary.has(e)).length;
const kept = values.filter(e => !dictionary.has(e) && keepEnglish.has(e)).length;

console.log(`مفاتيح اللقطة   : ${total}`);
console.log(`مُغطّى            : ${done} (${((done / total) * 100).toFixed(1)}%)`);
console.log(`يبقى إنجليزياً    : ${kept} (أسماء لا تُعرَّب)`);
console.log(`نصوص باقية      : ${remaining.length}`);

const batch = remaining.slice(0, count);
if (batch.length === 0) {
    console.log("✔ لا شيء باقٍ — الطابور فارغ");
    process.exit(0);
}

const payload = {};
for (const english of batch) payload[english] = "";

if (out === null) {
    console.log(JSON.stringify(payload, null, 1));
} else {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(payload, null, 1), "utf8");
    console.log(`الدفعة          : ${batch.length} نصّاً ⇒ ${out}`);
    console.log(`تغطية الدفعة    : ${batch.reduce((sum, e) => sum + frequency.get(e), 0)} مفتاحاً`);
}
