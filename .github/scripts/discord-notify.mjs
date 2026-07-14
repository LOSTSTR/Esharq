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
 * Triggers:
 *   - New plugin index file added  → WEBHOOK_PLUGINS  (green embed)
 *   - fix / sync / chore commit   → WEBHOOK_UPDATES  (orange embed)
 *   - feat without new plugin      → WEBHOOK_UPDATES  (blue embed)
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
const ICON_URL  =
    "https://raw.githubusercontent.com/LOSTSTR/Esharq/main/.github/assets/notify-icon.png";

// Sanitise all user-controlled fields
const commitMsg    = sanitise(run("git log -1 --pretty=%B"), 2000);

const msgLines = commitMsg.split("\n").filter(Boolean);
const msgTitle = sanitise(msgLines[0] ?? "", 256);

// ─── Detect new plugin files ──────────────────────────────────────────────────

const NEW_PLUGIN_RE =
    /^src\/(equicordplugins|userplugins)\/(?!_core\/)([^/]+)\/index\.(tsx?|jsx?)$/;

// Scan the WHOLE pushed range, not just the last commit — otherwise a push that bundles
// several commits (e.g. many plugins + a trailing lint fix) only ever inspects the final
// commit and misses every plugin added earlier in the push. RANGE_BASE is github.event.before
// on push, or a manual since_sha on workflow_dispatch (catch-up). Falls back to HEAD~1.
const rangeBaseRaw = (process.env.RANGE_BASE ?? "").trim();
const rangeBase = rangeBaseRaw && !/^0+$/.test(rangeBaseRaw) ? rangeBaseRaw : "HEAD~1";

let addedFiles = [];
for (const base of [rangeBase, "HEAD~1"]) {
    try {
        addedFiles = run(`git diff --name-only --diff-filter=A ${base} HEAD`)
            .split("\n")
            .filter(Boolean);
        break; // succeeded — stop (don't fall back)
    } catch { /* base not in clone (shallow) or first commit — try the fallback */ }
}

const newPluginFiles = addedFiles.filter(f => NEW_PLUGIN_RE.test(f));

// ─── Detect commit type ───────────────────────────────────────────────────────

const isFix    = /^fix(\(|:)/i.test(msgTitle);
const isSync   = /^sync(\(|:)/i.test(msgTitle) || /merge upstream/i.test(msgTitle);
const isChore  = /^(chore|perf|refactor|style|ci|build)(\(|:)/i.test(msgTitle);
const isFeat   = /^feat(\(|:)/i.test(msgTitle);
const isUpdate = isFix || isSync || isChore || (isFeat && newPluginFiles.length === 0);

// ─── Extract plugin metadata from source ─────────────────────────────────────

function extractPluginInfo(filePath) {
    if (!existsSync(filePath)) return null;
    const src = readFileSync(filePath, "utf8");
    // Extract name/description from the definePlugin({...}) block SPECIFICALLY — anchoring on
    // definePlugin( avoids grabbing the first name:/description: in the file, which is often a
    // settings option's (that leaked "RTCPeerConnection" + English setting text into the embed).
    const defIdx = src.search(/definePlugin\s*\(/);
    const defSrc = defIdx >= 0 ? src.slice(defIdx) : src;
    const name = sanitise((defSrc.match(/\bname:\s*["']([^"']+)["']/) ?? [])[1] ?? "", 80);
    const descEn = sanitise((defSrc.match(/\bdescription:\s*["']([^"']+)["']/) ?? [])[1] ?? "", 300);
    const dirName = (filePath.match(/\/(equicordplugins|userplugins)\/([^/]+)\//) ?? [])[2] ?? filePath;
    const resolvedName = name || sanitise(dirName, 80);

    // Arabic description from the i18n overlay (src/i18n/plugins/<PluginName>.ts),
    // so every new-plugin notification carries both languages.
    let descAr = "";
    const overlayPath = `src/i18n/plugins/${resolvedName}.ts`;
    if (existsSync(overlayPath)) {
        const overlay = readFileSync(overlayPath, "utf8");
        const m = overlay.match(/description["']?\s*:\s*\{[^}]*?["']?ar["']?\s*:\s*["']([^"']+)["']/);
        if (m) descAr = sanitise(m[1], 300);
    }

    return {
        name: resolvedName,
        descriptionEn: descEn || "No description yet.",
        descriptionAr: descAr,
    };
}

// ─── Message builders (plain Discord markdown; NO embed) ──────────────────────
// A plain message (not an embed) → no colored border, no author, no footer timestamp, and
// with no links it never triggers Discord's auto GitHub card. Discord still shows the EA
// webhook avatar on its own. The cloud is the only icon; the plugin name is colored via an
// ANSI code block (rebane2001 generator style).

const CLOUD = "<:esharqcloud:1521840260831641681>";

// One plugin's block: bold name + Arabic then English description as blockquotes.
function pluginEntry(info) {
    const lines = [`**\`${info.name}\`**`, `> ${info.descriptionAr || info.descriptionEn}`];
    if (info.descriptionAr && info.descriptionEn) lines.push(`> ${info.descriptionEn}`);
    return lines.join("\n");
}

// Pack ALL new plugins into as few messages as possible (one when it fits): a single header +
// every plugin listed under it. Splits into extra messages only when the content would exceed
// Discord's 2000-char limit.
function buildPluginMessages(infos) {
    const header = `## ${CLOUD} إضافة جديدة · New Plugin`;
    const LIMIT = 1900;

    const messages = [];
    let current = header;
    for (const info of infos) {
        const entry = pluginEntry(info);
        const candidate = `${current}\n\n${entry}`;
        if (candidate.length > LIMIT) {
            messages.push(current);
            current = entry;
        } else {
            current = candidate;
        }
    }
    messages.push(current);
    return messages;
}

// Friendly bilingual update heading + clean message (conventional-commit prefix stripped).
function classifyUpdate() {
    const m = msgTitle.match(/^(\w+)(?:\([^)]*\))?!?:\s*([\s\S]+)$/);
    const type = (m?.[1] ?? "").toLowerCase();
    const clean = (m?.[2] ?? msgTitle).trim();
    if (isSync)          return { label: "مزامنة · Sync", clean };
    if (type === "fix")  return { label: "إصلاح · Fix", clean };
    if (type === "feat") return { label: "تحديث جديد · Update", clean };
    return { label: "تحديث · Update", clean };
}

function updateMessage() {
    const u = classifyUpdate();
    const lines = [
        `## ${CLOUD} ${u.label}`,
        `> ${u.clean}`,
    ];
    return lines.join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const WEBHOOK_PLUGINS = process.env.WEBHOOK_PLUGINS ?? "";
const WEBHOOK_UPDATES = process.env.WEBHOOK_UPDATES ?? "";

// Graceful skip — secrets not yet configured
if (!WEBHOOK_PLUGINS || !WEBHOOK_UPDATES) {
    console.log("[discord-notify] Secrets not configured — skipping.");
    process.exit(0);
}

// Validate URLs before ANY use (stops wrong values from reaching discord.com)
assertWebhookUrl(WEBHOOK_PLUGINS, "WEBHOOK_PLUGINS");
assertWebhookUrl(WEBHOOK_UPDATES, "WEBHOOK_UPDATES");

async function main() {
    let sent = false;

    // 1. New plugin(s) detected — collect all, then send as ONE message (chunked only if needed).
    const infos = [];
    for (const file of newPluginFiles) {
        console.log(`🆕 New plugin: ${file}`);
        const info = extractPluginInfo(file);
        if (!info) { console.warn(`  ⚠ Could not read metadata from ${file}`); continue; }
        infos.push(info);
    }
    if (infos.length) {
        for (const content of buildPluginMessages(infos)) {
            try {
                await postWebhook(WEBHOOK_PLUGINS, { username: "Esharq", avatar_url: ICON_URL, content });
            } catch (e) {
                console.error(`  Plugin webhook failed: ${e.message}`);
            }
        }
        sent = true;
    }

    // 2. Fix / update commit. Skipped on manual catch-up runs (SKIP_UPDATE=1) so a
    // back-fill of past plugins doesn't also re-post an unrelated "update" for HEAD.
    if (isUpdate && process.env.SKIP_UPDATE !== "1") {
        console.log(`🔧 Update commit: ${msgTitle}`);
        try {
            await postWebhook(WEBHOOK_UPDATES, {
                username: "Esharq",
                avatar_url: ICON_URL,
                content: updateMessage(),
            });
        } catch (e) {
            console.error(`  Updates webhook failed: ${e.message}`);
        }
        sent = true;
    }

    if (!sent) {
        console.log("ℹ No notification triggered for this commit type.");
    }
}

main().catch(err => {
    // Log the error type/message but NOT any URL or secret
    console.error(`[discord-notify] Fatal: ${err.message}`);
    process.exit(1);
});
