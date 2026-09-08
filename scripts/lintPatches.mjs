#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const VERBOSE = process.env.LINT_PATCHES_VERBOSE === "1" || process.argv.includes("--verbose");

const tracked = execFileSync("git", ["ls-files", "src"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    // 🔴 كان يستثني `src/esharqplugins` — أي أنّ رقع إشراق الـ29 لم تُفحص قطّ،
    // وهي وحدها التي لا مصدر إصلاحٍ لها أعلى المنبع.
    .filter(p => /^src\/(plugins|equicordplugins|esharqplugins)\/.*\.(ts|tsx)$/.test(p))
    .map(p => p.replace(/\//g, sep));

/**
 * ثلاث رقعٍ كانت تحمل معرّفاً مُصغَّراً قبل أن تُصلَح القاعدة، فظهرت دفعةً
 * واحدة يوم عملت. لا تُخمَّن لها بدائل — تثبيتُ مُحدِّد webpack بالحدس ممنوع
 * في هذا المشروع، والصواب أن يُقرأ المُحدِّد من حزمةٍ حيّة أوّلاً.
 *
 * 🔴 الحجر **لا يُعطّل القاعدة**: أيّ ظهورٍ جديد يُفشل البوّابة. والمفتاح هو
 * الملفّ ونصُّ المطابقة لا رقم السطر، فلا يسقط الحجر بمجرّد إزاحة سطر — ولا
 * يُغطّي مخالفةً أخرى في الملفّ نفسه.
 *
 * حين تُصلَح واحدة، يُحذف سطرها من هنا.
 */
const KNOWN_MINIFIED = new Set([
    // لنا. `\i\._\.dispatch` و`d\.set` — لا مصدر إصلاحٍ أعلى المنبع (الإضافة إشراقية).
    "src/esharqplugins/fakeDeafen/index.tsx::_\\.d",
    "src/esharqplugins/fakeDeafen/index.tsx::d\\.s",
    // موروثة من Vencord، تُصلَح أعلى المنبع لا هنا.
    "src/plugins/openInApp/index.ts::t\\.m"
]);

let errors = 0;
let warnings = 0;

function fail(at, rule, msg) {
    console.error(`${at}: ERROR ${rule} ${msg}`);
    errors++;
}
function warn(at, rule, msg) {
    if (VERBOSE) console.warn(`${at}: WARN  ${rule} ${msg}`);
    warnings++;
}

for (const rel of tracked) {
    const text = readFileSync(join(ROOT, rel), "utf8");
    if (!text.includes("match:") && !text.includes("find:")) continue;

    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const at = `${rel.replace(/\\/g, "/")}:${i + 1}`;

        const matchM = line.match(/\bmatch\s*:\s*\/((?:\\.|[^/\\\n])+)\/[gimsuy]*/);
        if (matchM) {
            const src = matchM[1];
            const unbounded = src.match(/\.[+*]\??/);
            if (unbounded) warn(at, "P002", `unbounded ${unbounded[0]} in match`);
            // 🔴 القاعدة القديمة كانت `/\b[a-z]\.[a-z]\b/` و**لم تكن تعمل قطّ**:
            // تطلب نقطةً غير مهروبة، بينما الوصول الحقيقيّ داخل تعبيرٍ نمطيّ
            // يُكتب `d\.set` دائماً. فمرّت 720 رقعة بصفر أخطاء، وليس ذلك دليل
            // صحّة. الجديدة تشترط النقطة المهروبة، وتستثني `\i\.` وهي الصيغة
            // السليمة، عبر نظرةٍ خلفية سالبة. اختُبرت على سبع حالات حقيقية.
            const minified = src.match(/(?<!\\)\b[a-z_]\\\.[a-z_]/);
            if (minified) {
                const key = `${rel.replace(/\\/g, "/")}::${minified[0]}`;
                if (KNOWN_MINIFIED.has(key)) warn(at, "P001", `known hardcoded minified var "${minified[0]}" — quarantined, needs a live bundle to fix`);
                else fail(at, "P001", `hardcoded minified var "${minified[0]}", use \\i.\\i`);
            }
        }

        const findM = line.match(/\bfind\s*:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/(?:\\.|[^/\\\n])+\/[gimsuy]*)/);
        if (findM) {
            const window = lines.slice(i, i + 12).join("\n");
            if (/\b(replacement|match)\s*:/.test(window)) {
                const v = findM[1];
                if (v === '""' || v === "''" || v === "``") {
                    fail(at, "P003", "find is empty");
                } else if (v.startsWith("/")) {
                    const src = v.slice(1, v.lastIndexOf("/"));
                    if (/\\i/.test(src) && !/[A-Za-z]{3,}/.test(src) && !src.includes("#{intl::")) {
                        warn(at, "P004", "find regex has no string anchor");
                    }
                }
            }
        }

        const replaceM = line.match(/\breplace\s*:\s*(["'`])((?:\\.|(?!\1).)*)\1/);
        if (replaceM && /\btry\s*\{[\s\S]*?\}\s*catch\b/.test(replaceM[2])) {
            warn(at, "P005", "replace uses try/catch, fix the match instead");
        }
    }
}

const tail = warnings && !VERBOSE ? " (run with --verbose to list)" : "";
console.log(`\npatch lint: ${errors} error(s), ${warnings} warning(s)${tail}`);
process.exit(errors > 0 ? 1 : 0);
