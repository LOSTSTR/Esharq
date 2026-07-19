#!/usr/bin/env node
/**
 * Discord webhook notifier — Esharq
 *
 * Security model:
 *   - Webhook URLs come ONLY from GitHub Actions secrets (env vars).
 *   - URLs are validated against the Discord webhook pattern before use.
 *   - Secret values are never logged, printed, or included in error messages.
 *   - All user-supplied text (commit messages, author names) is sanitised
 *     to a maximum length and stripped of control characters.
 *   - HTTP requests have a hard 10-second timeout.
 *   - Script exits 0 on missing/unconfigured secrets (graceful skip).
 *
 * What it announces (per PUSH, scanning the WHOLE pushed range):
 *   - New plugin index files added      → WEBHOOK_PLUGINS
 *   - Plugin index files deleted        → WEBHOOK_UPDATES  (حذف · Removed)
 *   - feat / fix / perf / sync commits  → WEBHOOK_UPDATES  (grouped per category)
 *   - docs / test commits are ignored (not user-facing)
 *
 * Bilingual detail: put these trailers in the commit body and they are used
 * verbatim as the Arabic / English lines of the announcement —
 *   notify-ar: شرح عربي مفصّل لما تغيّر ولماذا
 *   notify-en: detailed English explanation of what changed and why
 *
 * Commits we cannot amend (upstream merges) get their Arabic from
 * .github/notify-overrides.json, keyed by sha prefix. Anything still missing an
 * Arabic line is announced in English only AND warned about in the run log.
 *
 * New-plugin announcements take both languages from src/i18n/plugins/<Name>.ts,
 * falling back to the plugin's own `description` for English.
 *
 * DRY_RUN=1 prints the messages instead of posting (local preview).
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import https from "https";

// ─── Security: URL validation ─────────────────────────────────────────────────

const DISCORD_WEBHOOK_RE =
    /^https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d{17,20}\/[\w-]{60,90}$/;

function assertWebhookUrl(url, label) {
    if (!DISCORD_WEBHOOK_RE.test(url)) {
        // Do NOT print the URL — it may contain the secret token
        console.error(`[discord-notify] ${label} is not a valid Discord webhook URL. Aborting.`);
        process.exit(1);
    }
}

// ─── Security: text sanitisation ─────────────────────────────────────────────

function sanitise(text, maxLen = 1000) {
    return String(text ?? "")
        .replace(/[\x00-\x1F\x7F]/g, " ") // strip control characters
        .replace(/`/g, "'")                       // neutralise Discord code fences
        .trim()
        .slice(0, maxLen);
}

// ─── Reading JS string literals out of source ────────────────────────────────
// A literal is: opening quote, then escapes or any char that is not the closing
// quote, then the matching quote. The previous `["']([^"']+)["']` stopped at the
// first quote of EITHER kind, so any description containing an apostrophe was cut
// short — SmartBidi announced "…renders when it" instead of "…when it's mixed with
// numbers, links, mentions or code…", and SilentDelete announced a single character.
const STRING_LITERAL = String.raw`(["'])((?:\\.|(?!\1)[^\\])*)\1`;

function unescapeLiteral(s) {
    return s.replace(/\\n/g, " ").replace(/\\(.)/g, "$1");
}

// keyPattern must not contain a capturing group — STRING_LITERAL's backreference
// relies on the quote being group 1.
function readString(src, keyPattern) {
    const m = src.match(new RegExp(keyPattern + String.raw`\s*` + STRING_LITERAL));
    return m ? unescapeLiteral(m[2]) : "";
}

// `description: t("عربي", "English")` — the inline bilingual form. Plugins using it
// carry both languages in the source itself and deliberately have no overlay file,
// so reading only the plain-string form left them announced in English or not at all.
// Groups: 2 = Arabic, 4 = English (the second literal backreferences group 3).
const DESC_T_CALL =
    /\bdescription:\s*t\(\s*(["'])((?:\\.|(?!\1)[^\\])*)\1\s*,\s*(["'])((?:\\.|(?!\3)[^\\])*)\3/;

// ─── HTTP helper with timeout ─────────────────────────────────────────────────

function postWebhook(url, payload) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const u = new URL(url);
        const req = https.request(
            {
                hostname: u.hostname,
                path: u.pathname + u.search,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(body),
                    "User-Agent": "Esharq-Notifier/1.0",
                },
            },
            res => {
                let data = "";
                res.on("data", d => (data += d));
                res.on("end", () => {
                    console.log(`  → HTTP ${res.statusCode}`);
                    resolve(res.statusCode);
                });
            }
        );

        // Hard timeout — prevents hanging runners
        req.setTimeout(10_000, () => {
            req.destroy(new Error("Request timed out after 10s"));
        });

        req.on("error", err => {
            console.error(`  → Request error: ${err.message}`);
            reject(err);
        });

        req.write(body);
        req.end();
    });
}

// ─── Git helpers ──────────────────────────────────────────────────────────────

function run(cmd) {
    return execSync(cmd, { encoding: "utf8" }).trim();
}

// Shared by BOTH webhooks (plugins + updates) — the EA webhook avatar.
const ICON_URL =
    "https://raw.githubusercontent.com/LOSTSTR/Esharq/main/.github/assets/notify-icon.png";

// The Esharq emoji that heads every announcement. Keep this ID stable.
const ICON = "<:esharqcloud:1521840260831641681>";

// ─── Manual translations for commits we cannot amend ─────────────────────────
// Upstream (Equicord) commits are English-only and never carry a notify-ar trailer,
// so their announcement would arrive half-blank. Rather than let the script invent
// Arabic, the translation is written by hand here and pushed together with the merge:
//
//   { "51cc856": { "ar": "…", "en": "…" } }        // key = any unambiguous sha prefix
//
// Precedence per commit: notify-ar/notify-en trailer → this file → subject (EN only).
const OVERRIDES_PATH = ".github/notify-overrides.json";
let overrides = {};
if (existsSync(OVERRIDES_PATH)) {
    try {
        overrides = JSON.parse(readFileSync(OVERRIDES_PATH, "utf8"));
    } catch (e) {
        console.error(`[discord-notify] ${OVERRIDES_PATH} is not valid JSON — ignoring it (${e.message}).`);
    }
}

function overrideFor(sha) {
    if (!sha) return null;
    const key = Object.keys(overrides).find(k => sha.startsWith(k));
    return key ? overrides[key] : null;
}

// ─── Pushed range ─────────────────────────────────────────────────────────────
// Scan the WHOLE pushed range, not just the last commit — otherwise a push that bundles
// several commits only ever inspects the final one (which is how a whole batch of fixes
// went unannounced when the last commit happened to be a docs change).
const rangeBaseRaw = (process.env.RANGE_BASE ?? "").trim();
const rangeBase = rangeBaseRaw && !/^0+$/.test(rangeBaseRaw) ? rangeBaseRaw : "HEAD~1";

function gitInRange(buildCmd) {
    for (const base of [rangeBase, "HEAD~1"]) {
        try {
            return run(buildCmd(base));
        } catch { /* base missing from a shallow clone, or first commit — try fallback */ }
    }
    return "";
}

const addedFiles = gitInRange(b => `git diff --name-only --diff-filter=A ${b} HEAD`)
    .split("\n").filter(Boolean);
const deletedFiles = gitInRange(b => `git diff --name-only --diff-filter=D ${b} HEAD`)
    .split("\n").filter(Boolean);

const PLUGIN_INDEX_RE =
    /^src\/(equicordplugins|userplugins)\/(?!_core\/)([^/]+)\/index\.(tsx?|jsx?)$/;

const newPluginFiles = addedFiles.filter(f => PLUGIN_INDEX_RE.test(f));
const deletedPluginFiles = deletedFiles.filter(f => PLUGIN_INDEX_RE.test(f));

// ─── Commit parsing ───────────────────────────────────────────────────────────

const FS = ""; // field separator
const RS = ""; // record separator

function getCommits() {
    const raw = gitInRange(b => `git log --no-merges --pretty=format:%H${FS}%s${FS}%b${RS} ${b}..HEAD`);
    return raw
        .split(RS)
        .map(r => r.trim())
        .filter(Boolean)
        .map(rec => {
            const [sha, subject, body] = rec.split(FS);
            return {
                sha: (sha ?? "").trim(),
                subject: sanitise(subject, 256),
                // Keep the body's NEWLINES — sanitise() strips \x00-\x1F, which includes
                // \n, and that would flatten the message into one line so the multiline
                // `notify-ar:` / `notify-en:` trailers could never match. Each extracted
                // trailer value is sanitised individually in parseCommit().
                body: String(body ?? "").replace(/\r/g, "").slice(0, 4000),
            };
        })
        .reverse(); // oldest first, so announcements read chronologically
}

// Categories, in the order they appear in the announcement.
const CATEGORIES = [
    ["update", "تحديث جديد · Update"],
    ["fix", "إصلاح · Fix"],
    ["improve", "تحسين · Improvement"],
    ["sync", "مزامنة · Sync"],
    ["removed", "حذف · Removed"],
];

const TYPE_CATEGORY = {
    feat: "update",
    fix: "fix",
    perf: "improve",
    refactor: "improve",
    chore: "improve",
    style: "improve",
    ci: "improve",
    build: "improve",
};

// Not user-facing — never announced.
const IGNORED_TYPES = new Set(["docs", "test"]);

function parseCommit(c) {
    const m = c.subject.match(/^(\w+)(?:\(([^)]*)\))?!?:\s*([\s\S]+)$/);
    const type = (m?.[1] ?? "").toLowerCase();
    const scope = sanitise(m?.[2] ?? "", 60);
    const title = sanitise(m?.[3] ?? c.subject, 300);

    if (IGNORED_TYPES.has(type)) return null;

    const isSync = type === "sync" || /merge upstream/i.test(c.subject);
    const category = isSync ? "sync" : TYPE_CATEGORY[type];
    if (!category) return null; // unrecognised prefix — don't guess

    // Bilingual detail: commit trailers first, then the hand-written overrides file,
    // then the subject. Only the last one is English-only.
    const ov = overrideFor(c.sha) ?? {};
    const ar = sanitise((c.body.match(/^notify-ar:\s*(.+)$/mi) ?? [])[1] ?? ov.ar ?? "", 600);
    const en = sanitise((c.body.match(/^notify-en:\s*(.+)$/mi) ?? [])[1] ?? ov.en ?? "", 600);

    if (!ar) console.warn(`  ⚠ ${c.sha.slice(0, 7)} "${c.subject.slice(0, 60)}" has no Arabic — add a notify-ar trailer or an entry in ${OVERRIDES_PATH}`);

    return { sha: c.sha, category, scope, ar, en: en || title };
}

// ─── Plugin metadata (for new-plugin announcements) ──────────────────────────

function extractPluginInfo(filePath) {
    if (!existsSync(filePath)) return null;
    const src = readFileSync(filePath, "utf8");
    // Anchor on definePlugin( so we don't grab a settings option's name/description.
    const defIdx = src.search(/definePlugin\s*\(/);
    const defSrc = defIdx >= 0 ? src.slice(defIdx) : src;
    const name = sanitise(readString(defSrc, String.raw`\bname:`), 80);
    const dirName = (filePath.match(/\/(equicordplugins|userplugins)\/([^/]+)\//) ?? [])[2] ?? filePath;
    const resolvedName = name || sanitise(dirName, 80);

    // Two sanctioned description forms: inline t("ar", "en"), or a plain English string
    // paired with an overlay file. Try the inline form first — it already has both.
    const inline = defSrc.match(DESC_T_CALL);
    let descAr = inline ? sanitise(unescapeLiteral(inline[2]), 300) : "";
    let descEn = inline
        ? sanitise(unescapeLiteral(inline[4]), 300)
        : sanitise(readString(defSrc, String.raw`\bdescription:`), 300);

    const overlayPath = `src/i18n/plugins/${resolvedName}.ts`;
    if (existsSync(overlayPath)) {
        const overlay = readFileSync(overlayPath, "utf8");
        const block = (overlay.match(/["']?description["']?\s*:\s*\{([^}]*)\}/) ?? [])[1] ?? "";
        descAr = sanitise(readString(block, String.raw`["']?ar["']?\s*:`), 300);
        // The overlay's English is the reviewed counterpart of the Arabic line — prefer it
        // so the two languages can never drift apart in an announcement.
        const overlayEn = sanitise(readString(block, String.raw`["']?en["']?\s*:`), 300);
        if (overlayEn) descEn = overlayEn;
    }

    if (!descAr) console.warn(`  ⚠ ${resolvedName}: no Arabic description (missing src/i18n/plugins/${resolvedName}.ts) — announcement will be English-only`);

    return { name: resolvedName, descriptionEn: descEn || "No description yet.", descriptionAr: descAr };
}

// ─── Message building ─────────────────────────────────────────────────────────
// Plain Discord markdown (no embed) → no coloured border and no auto GitHub card.
// Layout per entry: bold name, then the Arabic line, then the English line.

const LIMIT = 1900;

// Arabic lines almost always embed Latin tokens (plugin names, "commit", API names).
// Without an explicit base direction Discord renders those lines scrambled for EVERY
// reader. U+2067 (RLI) … U+2069 (PDI) forces an isolated RTL context so each Latin run
// becomes a correctly-placed LTR island. These are U+20xx, so sanitise() (which only
// strips \x00-\x1F and \x7F) leaves them intact.
const RLI = "⁧";
const PDI = "⁩";
const rtl = text => `${RLI}${text}${PDI}`;

function entryBlock(name, ar, en) {
    const lines = [];
    if (name) lines.push(`**\`${name}\`**`);
    if (ar) lines.push(`> ${rtl(ar)}`);
    if (en) lines.push(`> ${en}`);
    return lines.join("\n");
}

// Pack entries under a header into as few messages as possible.
function pack(header, entries) {
    const messages = [];
    let current = header;
    for (const entry of entries) {
        const candidate = `${current}\n\n${entry}`;
        if (candidate.length > LIMIT) {
            messages.push(current);
            current = `${header}\n\n${entry}`;
        } else {
            current = candidate;
        }
    }
    if (current !== header) messages.push(current);
    return messages;
}

function buildPluginMessages(infos) {
    const entries = infos.map(i => entryBlock(i.name, i.descriptionAr, i.descriptionEn));
    return pack(`## ${ICON} إضافة جديدة · New Plugin`, entries);
}

function buildUpdateMessages(parsed, removedNames) {
    const messages = [];

    for (const [key, label] of CATEGORIES) {
        let entries = [];

        if (key === "removed") {
            entries = removedNames.map(r => entryBlock(r.name, r.ar, r.en));
        } else {
            entries = parsed
                .filter(p => p.category === key)
                .map(p => entryBlock(p.scope, p.ar, p.en));
        }

        if (entries.length) messages.push(...pack(`## ${ICON} ${label}`, entries));
    }

    return messages;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const DRY_RUN = process.env.DRY_RUN === "1";
const WEBHOOK_PLUGINS = process.env.WEBHOOK_PLUGINS ?? "";
const WEBHOOK_UPDATES = process.env.WEBHOOK_UPDATES ?? "";

if (!DRY_RUN) {
    // Graceful skip — secrets not yet configured
    if (!WEBHOOK_PLUGINS || !WEBHOOK_UPDATES) {
        console.log("[discord-notify] Secrets not configured — skipping.");
        process.exit(0);
    }
    // Validate URLs before ANY use
    assertWebhookUrl(WEBHOOK_PLUGINS, "WEBHOOK_PLUGINS");
    assertWebhookUrl(WEBHOOK_UPDATES, "WEBHOOK_UPDATES");
}

async function send(url, content, kind) {
    if (DRY_RUN) {
        console.log(`\n───────── ${kind} ─────────\n${content}`);
        return;
    }
    try {
        await postWebhook(url, { username: "Esharq", avatar_url: ICON_URL, content });
    } catch (e) {
        console.error(`  ${kind} webhook failed: ${e.message}`);
    }
}

async function main() {
    let sent = false;

    // 1. New plugins — one message listing them all (chunked only if needed).
    const infos = [];
    for (const file of newPluginFiles) {
        console.log(`🆕 New plugin: ${file}`);
        const info = extractPluginInfo(file);
        if (!info) { console.warn(`  ⚠ Could not read metadata from ${file}`); continue; }
        infos.push(info);
    }
    if (infos.length) {
        for (const content of buildPluginMessages(infos)) await send(WEBHOOK_PLUGINS, content, "PLUGINS");
        sent = true;
    }

    // 2. Removed plugins — name them and carry the reason from the deleting commit.
    const commits = getCommits();
    const parsed = commits.map(parseCommit).filter(Boolean);

    // A commit that removes a plugin is announced under "حذف · Removed"; remember its sha
    // so the very same text isn't repeated under its conventional-commit category too.
    const removedShas = new Set();

    const removedNames = deletedPluginFiles.map(f => {
        // Folder name is the fallback, but announce the real plugin name when we can get
        // it — the folder often differs (e.g. folder "laisse" held the plugin "Leash").
        let name = (f.match(/\/(equicordplugins|userplugins)\/([^/]+)\//) ?? [])[2] ?? f;
        // Reason: the in-range commit that deleted this file, if it carries trailers.
        let ar = "", en = "";
        try {
            const sha = run(`git log --diff-filter=D --format=%H -1 HEAD -- "${f}"`).trim();
            if (sha) {
                removedShas.add(sha);
                try {
                    // The file still exists in that commit's PARENT — read its real name.
                    // Use ~1, not ^: on Windows shells ^ is an escape character and gets
                    // swallowed, so the lookup would hit the deleting commit itself.
                    const before = run(`git show ${sha}~1:"${f}"`);
                    const defIdx = before.search(/definePlugin\s*\(/);
                    const defSrc = defIdx >= 0 ? before.slice(defIdx) : before;
                    const real = readString(defSrc, String.raw`\bname:`);
                    if (real) name = real;
                } catch { /* first commit, or file unreadable — keep the folder name */ }
                // Newlines preserved here too, for the same trailer-matching reason.
                const body = String(run(`git log -1 --pretty=%b ${sha}`)).replace(/\r/g, "").slice(0, 4000);
                const ov = overrideFor(sha) ?? {};
                ar = sanitise((body.match(/^notify-ar:\s*(.+)$/mi) ?? [])[1] ?? ov.ar ?? "", 600);
                en = sanitise((body.match(/^notify-en:\s*(.+)$/mi) ?? [])[1] ?? ov.en ?? "", 600);
                if (!en) en = sanitise(run(`git log -1 --pretty=%s ${sha}`), 300);
                if (!ar) console.warn(`  ⚠ removal ${sha.slice(0, 7)} has no Arabic — add an entry in ${OVERRIDES_PATH}`);
            }
        } catch { /* ignore — fall back to the bare name */ }
        return { name: sanitise(name, 80), ar, en };
    });

    // 3. Updates — grouped by category across the WHOLE push.
    if (process.env.SKIP_UPDATE !== "1") {
        const messages = buildUpdateMessages(parsed.filter(p => !removedShas.has(p.sha)), removedNames);
        for (const content of messages) {
            console.log(`🔧 Update message (${content.length} chars)`);
            await send(WEBHOOK_UPDATES, content, "UPDATES");
        }
        if (messages.length) sent = true;
    }

    if (!sent) console.log("ℹ No notification triggered for this push.");
}

main().catch(err => {
    // Log the error type/message but NOT any URL or secret
    console.error(`[discord-notify] Fatal: ${err.message}`);
    process.exit(1);
});
