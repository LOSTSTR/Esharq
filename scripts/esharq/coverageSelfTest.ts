/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * اختبار حساب التغطية — على **اللقطة الحقيقية** لا على بيانات مُختلَقة.
 *
 *   pnpm testCoverage
 *
 * ## لماذا يُثبَّت هذا الفحص
 *
 * الرقم الذي تعرضه لوحة الكاشف يبدو صحيحاً دائماً: خانة تمتلئ برقم كبير.
 * وخطأ واحد في المقارنة — مفتاح يُعدّ مُعرَّباً لأن قيمته `undefined`، أو
 * مفاتيح تضيع بين الطرفين — يُنتج تغطية **مُبالَغاً فيها** ولا يشتكي شيء،
 * فيُقال «عُرِّب 80%» وهو لم يُعرَّب.
 *
 * 🔴 **بلا أرقام مُثبَّتة**: التأكيد على **الثوابت** (المجموع محفوظ ·
 * العضوية · الضوابط السالبة)، لا على 5852 و16632 — تلك تتغيّر مع كل إعادة
 * بناء للجدول، فتثبيتها يجعل الاختبار يفشل عند نجاحنا لا عند خطئنا.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { computeCoverage } from "../../src/userplugins/DiscordArabicizer/coverageCompare";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SNAPSHOT = join(ROOT, "src/userplugins/DiscordArabicizer/coverage/discord-keys.json");
const TABLE = join(ROOT, "src/plugins/_core/_arabicMessages.json");

const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as { messages: Record<string, string>; };
const arabic = JSON.parse(readFileSync(TABLE, "utf8")) as Record<string, unknown>;

const live = new Map(Object.entries(snapshot.messages));
const report = computeCoverage(live, arabic);
const missing = Object.keys(report.untranslated).length;

let failed = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failed++;
    console.log(`  ${ok ? "✔" : "✖"} ${label}${detail === undefined ? "" : ` — ${detail}`}`);
}

console.log("── حساب التغطية على اللقطة ──");
check("قُرئت اللقطة والجدول", live.size > 0 && Object.keys(arabic).length > 0, `${live.size} مفتاحاً · ${Object.keys(arabic).length} مُترجَماً`);

// الجدول مبنيّ من اللقطة نفسها ⇒ كل مفتاح فيه موجود فيها، فالمُعرَّب = حجمه.
check("المُعرَّب = حجم الجدول المشحون", report.translated === Object.keys(arabic).length, `${report.translated}`);
check("المجموع محفوظ — لا مفتاح ضاع ولا تكرّر", report.translated + missing === report.liveKeys, `${report.translated}+${missing}=${report.liveKeys}`);
check("كل مفتاح في طابور العمل غائب فعلاً عن الجدول", Object.keys(report.untranslated).every(key => arabic[key] === undefined));
check("كل نصّ في الطابور غير فارغ", Object.values(report.untranslated).every(text => text.length > 0));

console.log("── ضوابط سالبة — اختبار لا يفشل أبداً ليس اختباراً ──");
const empty = computeCoverage(live, {});
check("جدول فارغ ⇒ صفر مُعرَّب وكلّه طابور", empty.translated === 0 && Object.keys(empty.untranslated).length === live.size);

const full = computeCoverage(live, Object.fromEntries([...live.keys()].map(key => [key, ["x"]])));
check("جدول كامل ⇒ صفر باقٍ", full.translated === live.size && Object.keys(full.untranslated).length === 0);

const none = computeCoverage(new Map(), arabic);
check("لا مفاتيح حيّة ⇒ أصفار", none.liveKeys === 0 && none.translated === 0);

// 🔴 الفخّ الحقيقي: `in` أو truthiness تعدّ هذا مُعرَّباً، والصواب أنه ليس كذلك.
const sneaky = computeCoverage(new Map([["abcdef", "Hello"]]), { abcdef: undefined });
check("قيمة undefined لا تُحسَب تعريباً", sneaky.translated === 0 && sneaky.untranslated.abcdef === "Hello");

console.log(failed === 0 ? "\ncoverage self-test: 0 error(s)" : `\ncoverage self-test: ${failed} error(s)`);
process.exit(failed === 0 ? 0 : 1);
