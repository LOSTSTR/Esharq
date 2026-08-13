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
 * **تطابق أسماء المتغيّرات بين الإنجليزية والعربية.** ترجمة تُسقط متغيّراً
 * أو تُعيد تسميته تُنتج نصّاً ناقصاً عند المستخدم **ولا يشتكي شيء** —
 * المفتاح موجود والقيمة «صالحة». فتُرفَض هنا وتُحصى، لا تُشحن.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

/** أسماء المتغيّرات داخل نصّ بصيغة `{name}`. */
function placeholdersOf(text) {
    return [...text.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map(match => match[1]);
}

/** نصّ ⇒ شجرة أجزاء: نصوص حرفية و`[1,"اسم"]`. */
function toParts(text) {
    const parts = [];
    let last = 0;

    for (const match of text.matchAll(/\{([A-Za-z0-9_]+)\}/g)) {
        if (match.index > last) parts.push(text.slice(last, match.index));
        parts.push([1, match[1]]);
        last = match.index + match[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));

    return parts.length === 0 ? [""] : parts;
}

const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
const dictionary = readDictionary(PLUGIN);

const table = {};
let matched = 0;
let missing = 0;
const rejected = [];

for (const [key, english] of Object.entries(snapshot.messages)) {
    const arabic = dictionary.get(english);
    if (arabic === undefined) { missing++; continue; }

    const wanted = placeholdersOf(english).sort().join(",");
    const got = placeholdersOf(arabic).sort().join(",");

    if (wanted !== got) {
        // 🔴 نصّ ناقص عند المستخدم بلا شكوى من أحد — يُرفَض ويُحصى.
        rejected.push({ key, en: english, ar: arabic, wanted, got });
        continue;
    }

    table[key] = toParts(arabic);
    matched++;
}

// 🔴 فحص الشكل قبل الكتابة: الجدول يُستورَد في `arabicLocale.ts` بتحويل عبر
// `unknown` (لأن JSON المستورَد لا يُستنتَج صفوفاً ثنائية)، والتحويل يُسكِت
// المُترجِم — فلو خرج جزءٌ بشكل آخر لمرّ إلى ديسكورد بلا اعتراض من أحد.
for (const [key, parts] of Object.entries(table)) {
    for (const part of parts) {
        if (typeof part === "string") continue;
        const ok = Array.isArray(part) && part.length === 2 && part[0] === 1 && typeof part[1] === "string";
        if (!ok) {
            console.error(`✖ جزء بشكل غير متوقّع في ${key}: ${JSON.stringify(part)}`);
            process.exit(1);
        }
    }
}

writeFileSync(OUT, JSON.stringify(table), "utf8");

const total = Object.keys(snapshot.messages).length;
console.log(`مفاتيح اللقطة        : ${total}`);
console.log(`مُصرَّف إلى العربية    : ${matched} (${((matched / total) * 100).toFixed(1)}%)`);
console.log(`بلا ترجمة            : ${missing}`);
console.log(`مرفوض (متغيّرات)      : ${rejected.length}`);
console.log(`الحجم                : ${(readFileSync(OUT).length / 1024).toFixed(0)}KB`);
console.log(`المخرج               : ${OUT}`);

for (const item of rejected.slice(0, 5)) {
    console.log(`  ✖ ${item.key}: يريد [${item.wanted}] ووجد [${item.got}]`);
}

if (rejected.length > 0) {
    writeFileSync(join(PLUGIN, "coverage", "placeholder-mismatch.json"),
        JSON.stringify(rejected, null, 2), "utf8");
}
