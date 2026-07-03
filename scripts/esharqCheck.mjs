/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// esharqCheck — quality gate for the Esharq layer (src/userplugins + i18n overlays).
//
// 1. DiscordArabicizer dictionary validation (HARD FAIL):
//    - malformed entry lines: every entry MUST be a single `"key": "value",` line
//      (enforced format — the collision tooling and this checker both assume it)
//    - duplicate keys AFTER the engine's normalize() (curly → straight quotes),
//      which `no-dupe-keys` cannot see
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

// Same normalization as the DiscordArabicizer engine (index.tsx normalize()).
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

// ── result ───────────────────────────────────────────────────────────────────
console.log("──────────────────────────────────");
console.log(`esharqCheck: ${errors} error(s), ${warnings} warning(s)`);
if (errors > 0) process.exit(1);
