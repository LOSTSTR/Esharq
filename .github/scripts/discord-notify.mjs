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

const REPO_URL = "https://github.com/LOSTSTR/Esharq";
// Shared by BOTH webhooks (plugins + updates) — avatar + embed thumbnail.
const ICON_URL  =
    "https://raw.githubusercontent.com/LOSTSTR/Esharq/main/.github/assets/notify-icon.png";

const commitHash   = run("git log -1 --pretty=%H").slice(0, 7);
const commitTime   = run("git log -1 --pretty=%aI");
const commitUrl    = `${REPO_URL}/commit/${commitHash}`;

// Sanitise all user-controlled fields
const commitAuthor = sanitise(run("git log -1 --pretty=%an"), 80);
const commitMsg    = sanitise(run("git log -1 --pretty=%B"), 2000);

const msgLines = commitMsg.split("\n").filter(Boolean);
const msgTitle = sanitise(msgLines[0] ?? "", 256);
const msgBody  = sanitise(msgLines.slice(1).join("\n").trim(), 500);

// ─── Detect new plugin files ──────────────────────────────────────────────────

const NEW_PLUGIN_RE =
    /^src\/(equicordplugins|userplugins)\/(?!_core\/)([^/]+)\/index\.(tsx?|jsx?)$/;

let addedFiles = [];
try {
    addedFiles = run("git diff --name-only --diff-filter=A HEAD~1 HEAD")
        .split("\n")
        .filter(Boolean);
} catch { /* first commit or shallow clone */ }

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
    const name = sanitise((src.match(/\bname:\s*["']([^"']+)["']/) ?? [])[1] ?? "", 80);
    const descEn = sanitise((src.match(/\bdescription:\s*["']([^"']+)["']/) ?? [])[1] ?? "", 300);
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

// ─── Embed builders ───────────────────────────────────────────────────────────

// دعوة المتابعة (أصلية — تحفّز متابعة قناة الإعلانات).
const FOLLOW_NEW = "🔔 **تابِع القناة (Follow)** لتصلك كل إضافة جديدة فور صدورها.";
const FOLLOW_UPDATE = "🔔 **تابِع القناة (Follow)** لتصلك تحديثات إشراق أوّلاً بأوّل.";

function pluginEmbed(info) {
    const desc = info.descriptionAr
        ? `${info.descriptionAr}\n${info.descriptionEn}`
        : info.descriptionEn;
    return {
        title: "✨ إضافة جديدة · New plugin",
        description: `**${info.name}**\n${desc}\n\n${FOLLOW_NEW}`,
        color: 5763719,
        thumbnail: { url: ICON_URL },
        fields: [
            { name: "🔑 Commit", value: `[\`${commitHash}\`](${commitUrl})`, inline: true },
        ],
        footer: { text: `Esharq · بواسطة ${commitAuthor}`, icon_url: ICON_URL },
        timestamp: commitTime,
    };
}

function updateEmbed() {
    const isFixType = isFix || isSync;
    return {
        title: isFixType ? "🔧 إصلاح · Fix" : "✨ تحديث جديد · Update",
        description:
            `**${msgTitle}**\n` +
            (msgBody ? `${msgBody}\n` : "") +
            `\n${FOLLOW_UPDATE}`,
        color: isFixType ? 16705372 : 3447003,
        thumbnail: { url: ICON_URL },
        fields: [
            { name: "🔑 Commit", value: `[\`${commitHash}\`](${commitUrl})`, inline: true },
        ],
        footer: { text: `Esharq · بواسطة ${commitAuthor}`, icon_url: ICON_URL },
        timestamp: commitTime,
    };
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

    // 1. New plugin(s) detected
    for (const file of newPluginFiles) {
        console.log(`🆕 New plugin: ${file}`);
        const info = extractPluginInfo(file);
        if (!info) { console.warn(`  ⚠ Could not read metadata from ${file}`); continue; }

        try {
            await postWebhook(WEBHOOK_PLUGINS, {
                username: "Esharq",
                avatar_url: ICON_URL,
                embeds: [pluginEmbed(info)],
            });
        } catch (e) {
            console.error(`  Plugin webhook failed: ${e.message}`);
        }
        sent = true;
    }

    // 2. Fix / update commit
    if (isUpdate) {
        console.log(`🔧 Update commit: ${msgTitle}`);
        try {
            await postWebhook(WEBHOOK_UPDATES, {
                username: "Esharq",
                avatar_url: ICON_URL,
                embeds: [updateEmbed()],
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
