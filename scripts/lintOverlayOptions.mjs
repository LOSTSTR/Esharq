#!/usr/bin/env node
/*
 * يفحص انحراف غلاف الترجمة عن مصادر الإضافات.
 *
 * السبب: `resolvePluginOption` في `src/utils/i18n/index.ts` يُطابق **باسم
 * خاصّية الخيار**، ويرجع إلى الإنجليزية بصمت إن غاب المفتاح. فحين يُضيف
 * upstream خياراً أو يُعيد تسميته، يظهر إنجليزياً بلا خطأ ولا تحذير — وهو
 * ما حدث فعلاً في ShowMeYourName: ثلاثة مفاتيح أُعيدت تسميتها فصارت
 * ترجمتها ميتة، وثمانية خيارات جديدة بلا ترجمة، والبوّابة خضراء.
 *
 * `lintIntl` لا يغطّي هذا: هو يفحص علامات `#{intl::}` وحدها.
 *
 * يُبلّغ اتجاهين:
 *   ناقص — خيار **ظاهر** في المصدر بلا مدخل في الغلاف  ⇒ يُعرَض إنجليزياً
 *   ميت  — مدخل في الغلاف بلا خيار يقابله في المصدر    ⇒ ترجمة لا تُقرأ أبداً
 *
 * «ظاهر» = له وصف غير فارغ وليس `hidden: true`. غيره لا يراه المستخدم
 * أصلاً، والمطالبة بترجمته ضجيج.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const OVERLAY_DIR = join("src", "i18n", "plugins");
const PLUGIN_ROOTS = ["src/plugins", "src/equicordplugins", "src/esharqplugins", "src/userplugins"];

const slug = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** خيارات المصدر: المستوى الأول داخل `definePluginSettings({` مع حالة العرض. */
function sourceOptions(file) {
    const lines = readFileSync(file, "utf8").split("\n");
    const start = lines.findIndex(l => /definePluginSettings\(\{\s*$/.test(l));
    if (start < 0) return null;

    const options = new Map();
    let depth = 1;
    let current = null;

    for (let i = start + 1; i < lines.length && depth > 0; i++) {
        const line = lines[i];

        if (depth === 1) {
            const key = line.match(/^ {4}([A-Za-z_$][\w$]*): \{$/);
            if (key) {
                current = key[1];
                options.set(current, { described: false, hidden: false });
            }
        } else if (current && depth === 2) {
            const desc = line.match(/^ {8}description:\s*(.+)$/);
            // وصف فارغ ("" أو '') لا يُعرَض، فلا يُطالَب بترجمة
            if (desc && !/^["'`]{2}\s*,?\s*$/.test(desc[1])) options.get(current).described = true;
            if (/^ {8}hidden:\s*true\b/.test(line)) options.get(current).hidden = true;
        }

        for (const ch of line) {
            if (ch === "{") depth++;
            else if (ch === "}") depth--;
        }
        if (depth === 1) current = null;
    }
    return options;
}

/** مفاتيح كتلة `"options"` في ملفّ الغلاف. */
function overlayOptions(file) {
    const lines = readFileSync(file, "utf8").split("\n");
    const start = lines.findIndex(l => l.trim() === '"options": {');
    if (start < 0) return null;

    const keys = new Set();
    for (let i = start + 1; i < lines.length; i++) {
        if (/^ {4}\}/.test(lines[i])) break;
        const key = lines[i].match(/^ {8}"([^"]+)": \{$/);
        if (key) keys.add(key[1]);
    }
    return keys;
}

const sources = new Map();
for (const root of PLUGIN_ROOTS) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const index = ["index.tsx", "index.ts"]
            .map(name => join(root, entry.name, name))
            .find(existsSync);
        if (index) sources.set(slug(entry.name), index);
    }
}

let errors = 0;
for (const file of readdirSync(OVERLAY_DIR)) {
    if (!file.endsWith(".ts")) continue;

    const name = file.replace(/\.ts$/, "");
    const overlay = overlayOptions(join(OVERLAY_DIR, file));
    if (!overlay?.size) continue;

    const source = sources.get(slug(name));
    if (!source) continue;

    const options = sourceOptions(source);
    if (!options?.size) continue;

    const missing = [...options]
        .filter(([key, state]) => state.described && !state.hidden && !overlay.has(key))
        .map(([key]) => key);
    const dead = [...overlay].filter(key => !options.has(key));

    if (missing.length) {
        errors += missing.length;
        console.error(`${name}: ${missing.length} خياراً ظاهراً بلا ترجمة (سيُعرَض إنجليزياً) — ${missing.join(", ")}`);
    }
    if (dead.length) {
        errors += dead.length;
        console.error(`${name}: ${dead.length} مدخلاً في الغلاف بلا خيار يقابله (ترجمة لا تُقرأ) — ${dead.join(", ")}`);
    }
}

console.log(`\noverlay lint: ${errors} error(s)`);
process.exit(errors ? 1 : 0);
