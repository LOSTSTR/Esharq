/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// esharqCheck — quality gate for the Esharq layer (src/userplugins + i18n overlays).
//
// 1. Arabic dictionary validation (HARD FAIL). The dictionary is no longer read
//    at runtime — buildArabicTable.mjs parses it line by line to compile the
//    shipped table, so a malformed line is silently skipped and its translation
//    never ships. That parser is what these rules protect:
//    - malformed entry lines: every entry MUST be a single `"key": "value",` line
//    - duplicate keys after normalizing curly quotes to straight ones, which
//      `no-dupe-keys` cannot see — two entries differing only by quote shape are
//      one English string, and the second silently wins
//    - empty Arabic values
//    - {placeholder} tokens present in the Arabic value but absent from the
//      English key (they would render literally, untranslated)
// 2. i18n coverage report for userplugins (WARN ONLY): a plugin counts as
//    localized if it has an overlay in src/i18n/plugins/ or uses inline t()
//    from @utils/esharqI18n. Warnings don't fail the build — some plugins are
//    legitimately English-only (e.g. pure-CSS with an overlay-less alias).
//
// Run: node scripts/esharqCheck.mjs   (exit 1 on hard errors)

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const DICT = join(ROOT, "src/userplugins/DiscordArabicizer/translations.ts");
const USERPLUGINS = join(ROOT, "src/userplugins");
const OVERLAYS = join(ROOT, "src/i18n/plugins");

let errors = 0;
let warnings = 0;
const err = m => { errors++; console.error(`  ✖ ${m}`); };
const warn = m => { warnings++; console.warn(`  ⚠ ${m}`); };

// Curly quotes normalized to straight ones: Discord writes both shapes for the
// same string, so two entries differing only by quote shape are a duplicate.
const normalize = s => s.replace(/[‘’‛]/g, "'").replace(/[“”]/g, '"');
const placeholders = s => (s.match(/\{[^{}]+\}/g) ?? []).sort();

// ── 1. dictionary ────────────────────────────────────────────────────────────
console.log("── DiscordArabicizer dictionary ──");
const src = readFileSync(DICT, "utf8");
const entryRe = /^\s*("(?:[^"\\]|\\.)*")\s*:\s*("(?:[^"\\]|\\.)*"),?\s*$/;
const seen = new Map(); // normalized key -> first line number
let entries = 0;

src.split("\n").forEach((line, i) => {
    const n = i + 1;
    const trimmed = line.trim();
    // lines that begin like an entry must fully parse as one
    if (!trimmed.startsWith('"')) return;
    const m = line.match(entryRe);
    if (!m) {
        err(`translations.ts:${n} malformed entry line (won't be picked up cleanly): ${trimmed.slice(0, 80)}`);
        return;
    }
    let key, value;
    try {
        key = JSON.parse(m[1]);
        value = JSON.parse(m[2]);
    } catch {
        err(`translations.ts:${n} unparsable JSON string literals`);
        return;
    }
    entries++;

    const norm = normalize(key);
    if (seen.has(norm)) err(`translations.ts:${n} duplicate key after normalize (first at line ${seen.get(norm)}): ${key.slice(0, 60)}`);
    else seen.set(norm, n);

    if (value.trim() === "") err(`translations.ts:${n} empty Arabic value for: ${key.slice(0, 60)}`);

    const keyPh = new Set(placeholders(key));
    for (const ph of placeholders(value)) {
        if (!keyPh.has(ph)) err(`translations.ts:${n} placeholder ${ph} in Arabic value but not in the English key: ${key.slice(0, 60)}`);
    }
});
console.log(`  ${entries} entries parsed, ${seen.size} unique normalized keys`);

// ── 2. userplugins i18n coverage (warn only) ─────────────────────────────────
console.log("── userplugins i18n coverage ──");
let overlaySet;
try {
    overlaySet = new Set(readdirSync(OVERLAYS).filter(f => f.endsWith(".ts")).map(f => f.slice(0, -3)));
} catch {
    overlaySet = new Set();
}

const readAll = dir => {
    let out = "";
    for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) out += readAll(p);
        else if (/\.(tsx?|jsx?)$/.test(f)) out += readFileSync(p, "utf8");
    }
    return out;
};

let covered = 0, uncovered = [];
for (const dir of readdirSync(USERPLUGINS)) {
    if (dir.startsWith("_") || dir.startsWith(".")) continue;
    const p = join(USERPLUGINS, dir);
    if (!statSync(p).isDirectory()) continue;

    const code = readAll(p);
    // every string literal handed to `name:` (a plugin may define name in a source array too)
    const names = [...code.matchAll(/name\s*:\s*"([^"]+)"/g)].map(m => m[1]);
    const hasOverlay = names.some(n => overlaySet.has(n));
    const usesInlineT = code.includes("esharqI18n");

    if (hasOverlay || usesInlineT) covered++;
    else uncovered.push(dir);
}
console.log(`  ${covered} plugins localized (overlay or inline t)`);
for (const dir of uncovered) warn(`src/userplugins/${dir} has no i18n overlay and no inline t() — Arabic users see English only`);

// ── 3. plugin directories contain only plugins (HARD FAIL) ───────────────────
//
// The registry generator imports every entry of these directories and keys it by
// `module.name`. A data file dropped beside a plugin therefore registers as
// `undefined`, and the plugins page dies on `a.name.localeCompare(b.name)` —
// taking the whole client down with it. That actually shipped once: an Arabic
// message table sat in plugins/_core. A plugin is a directory or a .ts/.tsx
// file; anything else belongs elsewhere, or must be prefixed with `_` to be
// skipped by both the generator and this check.
console.log("── plugin directories ──");
const PLUGIN_DIRS = [
    "src/plugins/_api", "src/plugins/_core", "src/plugins",
    "src/equicordplugins/_api", "src/equicordplugins/_core", "src/equicordplugins",
    "src/userplugins"
];
let strays = 0;
for (const rel of PLUGIN_DIRS) {
    const dir = join(ROOT, rel);
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
        const name = entry.name;
        if (name.startsWith("_") || name.startsWith(".") || name === "index.ts") continue;
        if (entry.isDirectory() || /\.tsx?$/.test(name)) continue;
        strays++;
        err(`${rel}/${name} is neither a plugin directory nor a .ts/.tsx file — it would register as a plugin named "undefined"`);
    }
}
if (strays === 0) console.log(`  ${PLUGIN_DIRS.length} directories hold plugins only`);

// ── result ───────────────────────────────────────────────────────────────────
console.log("──────────────────────────────────");
console.log(`esharqCheck: ${errors} error(s), ${warnings} warning(s)`);
if (errors > 0) process.exit(1);
