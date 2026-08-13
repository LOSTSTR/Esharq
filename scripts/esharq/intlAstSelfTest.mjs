/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * اختبار جسر بنى ICU — **البرهان لا الشرح**.
 *
 *   pnpm testIntlAst
 *
 * الجسر (`intlAst.mjs`) يقف بين شجرة ديسكورد ونصٍّ نترجمه. وخطؤه صامت
 * بطبعه: شجرةٌ تخرج بشكل قريب من الصحيح تُعرَض عند المستخدم ناقصةً بلا
 * خطأ في أي سجلّ. فالاختبار هنا **دورة مغلقة على بيانات حقيقية**:
 *
 *   شجرة ديسكورد ⇒ نصّ ⇒ شجرة  ويجب أن تُطابق الأصل حرفاً بحرف.
 *
 * والمرجع `coverage/discord-icu.json` مأخوذ من عميل حيّ ومحفوظ في
 * المستودع، فالبرهان يُعاد **بلا ديسكورد يعمل** وفي أي جهاز.
 *
 * 🔴 وضوابط سالبة بجانبه: ما **يجب أن يُرفَض**. اختبارٌ لا يفشل على الخطأ
 * لا يُثبت شيئاً — وقد سبق أن أعطتنا بوّابة خضراء ثقةً في كودٍ منهار.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { astToSource, sourceToAst, structureOf, validateTranslation } from "./intlAst.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const PLUGIN = join(ROOT, "src", "esharqplugins", "DiscordArabicizer");
const CORPUS = join(PLUGIN, "coverage", "discord-icu.json");
const SNAPSHOT = join(PLUGIN, "coverage", "discord-keys.json");

let failed = 0;
function check(label, ok, detail) {
    if (!ok) failed++;
    console.log(`  ${ok ? "✔" : "✖"} ${label}${detail === undefined ? "" : ` — ${detail}`}`);
}

// ── الدورة على المرجع الحيّ ────────────────────────────────────────────

console.log("── دورة كاملة على أشجار ديسكورد الحقيقية ──");

if (!existsSync(CORPUS)) {
    check("مرجع البنى موجود", false, `مفقود: ${CORPUS} — شغّل \`pnpm intl:harvest --accept\``);
} else {
    const corpus = JSON.parse(readFileSync(CORPUS, "utf8"));
    const entries = Object.entries(corpus);

    let ok = 0;
    const broken = [];
    for (const [key, tree] of entries) {
        try {
            const source = astToSource(tree);
            const back = sourceToAst(source);
            if (JSON.stringify(back) === JSON.stringify(tree)) ok++;
            else broken.push(`${key}: ${source.slice(0, 60)}`);
        } catch (error) {
            broken.push(`${key}: ${error.message}`);
        }
    }

    check(`الأشجار المركّبة تعود كما هي (${ok}/${entries.length})`, broken.length === 0, broken[0]);
    // مرجعٌ فرغ يجعل السطر أعلاه ينجح على لا شيء — وهو أسوأ من الفشل.
    check("المرجع ليس فارغاً", entries.length > 1000, `${entries.length} شجرة`);
}

// ── الدورة على اللقطة النصّية ──────────────────────────────────────────

console.log("── دورة على نصوص اللقطة ──");

if (!existsSync(SNAPSHOT)) {
    check("اللقطة موجودة", false, SNAPSHOT);
} else {
    const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
    const texts = Object.entries(snapshot.messages);

    let ok = 0;
    const broken = [];
    for (const [key, text] of texts) {
        try {
            if (astToSource(sourceToAst(text)) === text) ok++;
            else broken.push(`${key}: ${JSON.stringify(text.slice(0, 60))}`);
        } catch (error) {
            broken.push(`${key}: ${error.message}`);
        }
    }

    check(`كل نصّ يُقرأ ويُعاد كما هو (${ok}/${texts.length})`, broken.length === 0, broken[0]);
}

// ── ضوابط موجبة: ما يجب أن يُقرأ صحيحاً ────────────────────────────────

console.log("── ما يجب أن يُقرأ ──");

const cases = [
    ["نصّ عارٍ", "Hello there", ["Hello there"]],
    ["متغيّر", "Hi {name}!", ["Hi ", [1, "name"], "!"]],
    ["رقم", "Sent {count, number} ago", ["Sent ", [2, "count"], " ago"]],
    ["تاريخ بصيغة فيها شرطة", "{createdAt, date, M/d}", [[3, "createdAt", "M/d"]]],
    ["وقت بصيغة مزدوجة النقطتين", "{duration, time, ::Hms}", [[4, "duration", "::Hms"]]],
    ["وسم بلا وسيط", "<$b>bold</$b>", [[8, "$b", ["bold"]]]],
    ["وسم بوسيط متغيّر", "<$link={url}>go</$link>", [[8, "$link", ["go"], [[1, "url"]]]]],
    ["وسم بوسيط نصّي", "<$link=https://a.b/c>go</$link>", [[8, "$link", ["go"], ["https://a.b/c"]]]],
    ["وسم داخل وسم", "<$b><$i>x</$i></$b>", [[8, "$b", [[8, "$i", ["x"]]]]]],
    ["اختيار", "{on, select, true {yes} other {no}}",
        [[5, "on", { true: ["yes"], other: ["no"] }]]],
    ["جمع مع #", "{n, plural, one {# day} other {# days}}",
        [[6, "n", { one: [[7], " day"], other: [[7], " days"] }, 0, "cardinal"]]],
    ["جمع بحالات مضبوطة", "{n, plural, =0 {none} other {some}}",
        [[6, "n", { "=0": ["none"], other: ["some"] }, 0, "cardinal"]]],
    ["جمع عربي بستّ صيغ",
        "{n, plural, zero {لا أصدقاء} one {صديق} two {صديقان} few {# أصدقاء} many {# صديقاً} other {# صديق}}",
        [[6, "n", {
            zero: ["لا أصدقاء"], one: ["صديق"], two: ["صديقان"],
            few: [[7], " أصدقاء"], many: [[7], " صديقاً"], other: [[7], " صديق"]
        }, 0, "cardinal"]]],
    ["ترتيبيّ", "{n, selectordinal, other {#th}}",
        [[6, "n", { other: [[7], "th"] }, 0, "ordinal"]]],
    ["إزاحة", "{n, plural, offset:1 other {#}}",
        [[6, "n", { other: [[7]] }, 1, "cardinal"]]]
];

for (const [label, source, tree] of cases) {
    let got;
    try { got = sourceToAst(source); } catch (error) { got = `خطأ: ${error.message}`; }
    check(label, JSON.stringify(got) === JSON.stringify(tree), JSON.stringify(got));
}

// ── 🔴 المحارف الحرفية: أخطر ما في الصيغة ──────────────────────────────

console.log("── نصوص تحمل محارف الصيغة حرفيّاً ──");

// كلّها **موجودة في اللقطة فعلاً**، وأي هروب دائم يُغيّر مفاتيحها فيُسقط
// ترجمتها صامتةً. الاختبار يُثبّت أنها تبقى كما هي.
for (const literal of [
    "Sent < 1 minute ago",
    "< 1H LEFT",
    "<1 day ago",
    "Appends ¯\\_(ツ)_/¯ to your message.",
    " more recent avatar uploads}",
    "Use # to mention a channel",
    "A > B > C"
]) {
    const tree = sourceToAst(literal);
    check(JSON.stringify(literal),
        JSON.stringify(tree) === JSON.stringify([literal]) && astToSource(tree) === literal,
        JSON.stringify(tree));
}

// وهروبٌ **يُكتب حين يلزم**: نصّ يشبه بنيةً يجب أن ينجو بالهروب.
for (const [label, literal] of [
    ["نصّ يشبه وسماً", "<$b>not a tag</$b>"],
    ["نصّ يشبه متغيّراً", "{name} is literal"],
    ["شرطة قبل قوس", "\\{ literally"]
]) {
    const escaped = astToSource([literal]);
    check(label, JSON.stringify(sourceToAst(escaped)) === JSON.stringify([literal]), escaped);
}

// ── ضوابط سالبة: ما يجب أن يُرفَض ──────────────────────────────────────

console.log("── ما يجب أن يُرفَض ──");

for (const [label, source] of [
    ["وسم بلا إغلاق", "<$b>x"],
    ["وسم مُغلق باسم آخر", "<$b>x</$i>"],
    ["وسم إغلاق بلا فتح", "x</$b>"],
    ["نوع متغيّر مجهول", "{n, colour, x {y}}"],
    ["صيغة بلا فروع", "{n, plural, }"]
]) {
    let threw = false;
    try { sourceToAst(source); } catch { threw = true; }
    check(label, threw);
}

// 🔴 قوسٌ غير مغلق **لا يُرفَض عند التحليل، وهذا مقصود**: `{` وحدها محرف
// نصّيّ مشروع (رُصد في اللقطة)، فرفضها يمنع نصوصاً صحيحة. والخطأ الحقيقي —
// مترجمٌ نسي القوس فسقط المتغيّر — يُمسَك في موضعه الصحيح: **مقابلة الترجمة
// بأصلها**، حيث يظهر المتغيّر في الإنجليزية ويغيب في العربية.
check("قوس غير مغلق يبقى نصّاً",
    JSON.stringify(sourceToAst("{name")) === JSON.stringify(["{name"]));
check("وسقوط المتغيّر يُمسَك بالمقابلة",
    validateTranslation("Hi {name}", "أهلاً {name") !== null);

// ── فحص الترجمة ────────────────────────────────────────────────────────

console.log("── فحص الترجمة مقابل أصلها ──");

const english = "You have {count, plural, one {# friend} other {# friends}} in <$b>{guild}</$b>";

check("ترجمة عربية بستّ صيغ تُقبَل",
    validateTranslation(english,
        "لديك {count, plural, zero {لا أصدقاء} one {صديق واحد} two {صديقان} few {# أصدقاء} many {# صديقاً} other {# صديق}} في <$b>{guild}</$b>") === null);

check("متغيّر ساقط يُرفَض",
    validateTranslation(english,
        "لديك {count, plural, other {# صديق}} في <$b>هنا</$b>") !== null);

check("وسم ساقط يُرفَض",
    validateTranslation(english,
        "لديك {count, plural, other {# صديق}} في {guild}") !== null);

check("صيغة جمع مجهولة تُرفَض",
    validateTranslation(english,
        "لديك {count, plural, kthir {# صديق} other {# صديق}} في <$b>{guild}</$b>") !== null);

check("جمع بلا فرع other يُرفَض",
    validateTranslation(english,
        "لديك {count, plural, one {# صديق}} في <$b>{guild}</$b>") !== null);

// 🔴 طرف اختيار ساقط: قيمةٌ كاملة تختفي من الواجهة، ولا يظهر ذلك إلّا حين
// تقع تلك الحالة بعينها عند مستخدم بعينه.
const select = "It is {state, select, true {on} false {off} other {unknown}}";
check("طرف اختيار ساقط يُرفَض",
    validateTranslation(select, "هي {state, select, true {مُفعَّل} other {غير معروف}}") !== null);

check("البصمة تتجاهل صيغ الجمع وحدها",
    structureOf(sourceToAst("{n, plural, one {a} other {b}}"))
    === structureOf(sourceToAst("{n, plural, zero {ا} two {ب} other {ج}}")));

check("البصمة لا تتجاهل اسم المتغيّر",
    structureOf(sourceToAst("{n, plural, other {a}}"))
    !== structureOf(sourceToAst("{m, plural, other {a}}")));

console.log(failed === 0 ? "\nintlAst self-test: 0 error(s)" : `\nintlAst self-test: ${failed} error(s)`);
process.exit(failed === 0 ? 0 : 1);
