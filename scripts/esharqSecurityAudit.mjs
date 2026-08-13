/*
 * Esharq — static security audit for bundled plugins.
 *
 * Scans src/userplugins (our ports and originals) for the three classes of abuse
 * that matter for a client mod distributed to other people:
 *
 *   1. Account-token access   — anything that can read the raw Discord token.
 *   2. Backdoors / RCE        — dynamic code execution, native bridges, shells.
 *   3. Undeclared egress      — network calls to hosts outside the allowlist.
 *
 * Static only: this NEVER executes plugin code. It reads sources as text.
 *
 * Exit code 1 on any ERROR-severity finding, so CI blocks the push.
 * Run: node scripts/esharqSecurityAudit.mjs [--json]
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src/esharqplugins", "src/userplugins"];
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

// ── Hosts a plugin is allowed to reference ────────────────────────────────────
// Every entry is here because a specific adopted plugin needs it for its stated
// purpose. Adding a host means accepting that user data can reach it, so a new
// entry must name the plugin and the kind of contact:
//
//   api    — the client sends requests here automatically or on an action.
//   upload — user files are transmitted here (must be disclaimed in the plugin).
//   link   — only ever opened in the user's browser; no data leaves the client
//            except what the user chooses by clicking.
const ALLOWED_HOSTS = new Map([
    ["discord.com", ["api", "Discord itself"]],
    ["discordapp.com", ["api", "Discord itself"]],
    ["discordapp.net", ["api", "Discord CDN"]],
    ["cdn.discordapp.com", ["api", "Discord CDN"]],
    ["media.discordapp.net", ["api", "Discord CDN"]],
    ["api.groq.com", ["api", "SummarizeAI / TsundereTalk — user's own API key"]],
    ["api.dictionaryapi.dev", ["api", "Define"]],
    ["en.wikipedia.org", ["api", "WikiLookup"]],
    ["lrclib.net", ["api", "LyricsStatus"]],
    ["api.mail.tm", ["api", "TempMail"]],
    ["mail.tm", ["api", "TempMail"]],
    ["api.soundcloud.com", ["api", "SoundcloudRichPresence"]],
    ["api-v2.soundcloud.com", ["api", "SoundcloudRichPresence"]],
    ["soundcloud.com", ["link", "SoundcloudRichPresence — track page"]],
    ["dns.mullvad.net", ["api", "SecureDNS — the plugin's entire purpose"]],
    ["rdap.org", ["api", "OSINTToolkit — user-initiated lookup"]],
    ["freeipapi.com", ["api", "OSINTToolkit — user-initiated lookup"]],
    ["raw.githubusercontent.com", ["api", "StaffDetector sounds / badge assets"]],
    ["github.com", ["link", "repository links"]],
    ["api.github.com", ["api", "Updater — release metadata; MicPro — pinned, hash-verified stereo patcher"]],
    ["catbox.moe", ["upload", "BigFileUploadEnhanced — disclaimed"]],
    ["litterbox.catbox.moe", ["upload", "BigFileUploadEnhanced — disclaimed"]],
    ["gofile.io", ["upload", "BigFileUploadEnhanced — disclaimed"]],
    ["file.fast", ["upload", "BigFileUploadEnhanced — disclaimed"]],
    ["embeds.video", ["link", "BigFileUploadEnhanced — playback page for an upload"]],
    ["esharq.org", ["api", "Esharq site / badge studio"]],
    ["ko-fi.com", ["link", "donation link"]],
    ["discohook.org", ["link", "EmbedBuilder — opens the embed in a web editor"]],
    ["www.google.com", ["link", "MetadataViewer — reverse image search"]],
    ["lens.google.com", ["link", "MetadataViewer / OSINTToolkit — reverse image search"]],
    ["www.openstreetmap.org", ["link", "MetadataViewer — plots EXIF GPS coordinates"]],
    // OSINTToolkit opens these in the browser on an explicit click. They are listed
    // individually so that adding a new destination is a visible, reviewed change.
    ["cloudsint.net", ["link", "OSINTToolkit — user-initiated"]],
    ["deadeye.cc", ["link", "OSINTToolkit — user-initiated"]],
    ["epieos.com", ["link", "OSINTToolkit — user-initiated"]],
    ["indicia.app", ["link", "OSINTToolkit — user-initiated"]],
    ["osintframework.com", ["link", "OSINTToolkit — user-initiated"]],
    ["pikaosint.pages.dev", ["link", "OSINTToolkit — user-initiated"]],
    ["see-know.eu", ["link", "OSINTToolkit — user-initiated"]],
    ["socialeye.net", ["link", "OSINTToolkit — user-initiated"]],
    ["start.me", ["link", "OSINTToolkit — user-initiated"]],
    ["usersearch.org", ["link", "OSINTToolkit — user-initiated"]],
    ["whatsmyname.app", ["link", "OSINTToolkit — user-initiated"]],
    ["www.osintx.io", ["link", "OSINTToolkit — user-initiated"]],
    ["www.proximityosint.com", ["link", "OSINTToolkit — user-initiated"]],
    ["www.snapmail.in", ["link", "OSINTToolkit — temporary email, user-initiated"]],
]);

// Not contact with a host at all: XML namespaces, licence boilerplate and the
// documentation placeholder used in settings descriptions.
const NON_CONTACT_HOSTS = new Set(["www.w3.org", "www.gnu.org", "example.com"]);

// ── Reviewed exceptions ───────────────────────────────────────────────────────
// A finding listed here is still reported, loudly, but does not fail the build.
// This exists so that an accepted risk is written down and re-read on every run,
// instead of being silently removed by loosening a rule. Keys are `file:rule`.
//
// Each entry must state WHAT makes it safe, in terms a reviewer can re-verify.
const REVIEWED_EXCEPTIONS = new Map([
    ["src/esharqplugins/MicPro/native.ts:native-exec",
        "Stereo needs Discord's own discord_voice.node patched in memory (it downmixes to "
        + "mono and caps Opus bitrate, overriding channels:2). The patcher is pinned to "
        + "immutable release asset ids from the upstream project, SHA-256 verified before "
        + "download is accepted AND again immediately before execution, and only fetched "
        + "when the user has actually enabled stereo. Never change this to a moving tag."],
]);

// ── Rules ─────────────────────────────────────────────────────────────────────
// `test` runs per line. Keep patterns narrow: a noisy auditor gets ignored.
const RULES = [
    {
        id: "token-read",
        severity: "error",
        why: "Reads the raw account token — the credential itself.",
        patterns: [
            /localStorage\s*\.\s*(?:getItem\s*\(\s*["'`]token["'`]|token\b)/,
            /\bgetToken\s*\(\s*\)/,
            /webpackChunkdiscord_app/,
        ],
    },
    {
        id: "dynamic-code",
        severity: "error",
        why: "Executes code built at runtime — a backdoor primitive.",
        patterns: [
            /\beval\s*\(/,
            /new\s+Function\s*\(/,
            /\bimport\s*\(\s*(?!["'`.@])/, // dynamic import of a computed specifier
        ],
    },
    {
        id: "native-exec",
        severity: "error",
        why: "Shells out or loads native code from the renderer.",
        patterns: [
            /child_process/,
            /\brequire\s*\(\s*["'`](?:child_process|fs|net|dgram)["'`]\s*\)/,
            /\.node["'`]/,
            /powershell|cmd\.exe|\/bin\/sh\b/i,
        ],
    },
    {
        id: "network-primitive",
        severity: "info", // hosts are judged separately; this is for the inventory
        why: "Performs network I/O.",
        patterns: [
            /\bfetch\s*\(/,
            /XMLHttpRequest/,
            /new\s+WebSocket\s*\(/,
            /\bnavigator\s*\.\s*sendBeacon\s*\(/,
        ],
    },
    {
        id: "obfuscation",
        severity: "warn",
        why: "Encoded payload — hides intent from review.",
        patterns: [
            /\batob\s*\(/,
            /String\.fromCharCode\s*\(\s*(?:\d+\s*,\s*){8,}/,
            /\\x[0-9a-f]{2}(?:\\x[0-9a-f]{2}){12,}/i,
        ],
    },
];

// Matches absolute URLs in source text.
const URL_RE = /https?:\/\/([a-z0-9.-]+\.[a-z]{2,})(?:[/:?#][^\s"'`)]*)?/gi;

function walk(dir, out = []) {
    let entries;
    try { entries = readdirSync(dir); } catch { return out; }
    for (const entry of entries) {
        const full = join(dir, entry);
        let st;
        try { st = statSync(full); } catch { continue; }
        if (st.isDirectory()) walk(full, out);
        else if (SOURCE_EXT.test(entry)) out.push(full);
    }
    return out;
}

function pluginOf(file) {
    const rel = relative(ROOT, file).split(sep);
    // `rel` is path segments, not a string — findIndex, not a regex search.
    const i = rel.findIndex(segment => segment === "esharqplugins" || segment === "userplugins");
    return i >= 0 && rel[i + 1] ? rel[i + 1] : rel.join("/");
}

/**
 * Strips line comments so a commented-out example is not reported as live code.
 * The `[^:]` guard keeps `https://…` intact — otherwise every URL in the codebase
 * would be swallowed as a comment and the egress scan would silently find nothing.
 */
function stripComment(line) {
    return line.replace(/(^|[^:])\/\/.*$/, "$1").replace(/\/\*.*?\*\//g, "");
}

const findings = [];
const hostUse = new Map(); // host -> Set(plugin)

/**
 * Blanks out /* … *\/ blocks while preserving line count, so multi-line licence
 * headers and commented-out code cannot produce findings — and reported line
 * numbers still match the real file.
 */
function stripBlockComments(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "));
}

const files = SCAN_DIRS.flatMap(d => walk(join(ROOT, d)));

for (const file of files) {
    const text = stripBlockComments(readFileSync(file, "utf8"));
    const lines = text.split(/\r?\n/);
    const plugin = pluginOf(file);

    lines.forEach((raw, idx) => {
        const line = stripComment(raw);
        if (!line.trim()) return;

        for (const rule of RULES) {
            if (rule.patterns.some(p => p.test(line))) {
                findings.push({
                    plugin,
                    file: relative(ROOT, file).replace(/\\/g, "/"),
                    line: idx + 1,
                    rule: rule.id,
                    severity: rule.severity,
                    why: rule.why,
                    code: raw.trim().slice(0, 160),
                });
            }
        }

        // xmlns="http://www.w3.org/2000/svg" is a namespace identifier, never fetched.
        if (/xmlns|xlink/.test(line)) return;

        for (const m of line.matchAll(URL_RE)) {
            const host = m[1].toLowerCase();
            if (NON_CONTACT_HOSTS.has(host)) continue;
            if (!hostUse.has(host)) hostUse.set(host, new Set());
            hostUse.get(host).add(plugin);
        }
    });
}

// A host is allowed if it is listed, or is a subdomain of a listed host.
function isAllowed(host) {
    if (ALLOWED_HOSTS.has(host)) return true;
    for (const allowed of ALLOWED_HOSTS.keys()) {
        if (host.endsWith(`.${allowed}`)) return true;
    }
    return false;
}

const unknownHosts = [...hostUse.entries()]
    .filter(([host]) => !isAllowed(host))
    .sort(([a], [b]) => a.localeCompare(b));

// A native.ts next to a plugin is a main-process bridge — always worth naming.
const nativeBridges = files
    .filter(f => /(?:^|[\\/])(?:native|index\.native)\.tsx?$/.test(f))
    .map(f => ({ plugin: pluginOf(f), file: relative(ROOT, f).replace(/\\/g, "/") }));

if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ findings, unknownHosts, nativeBridges }, null, 2));
} else {
    const keyOf = f => `${f.file}:${f.rule}`;
    const bySeverity = s => findings.filter(f => f.severity === s && !REVIEWED_EXCEPTIONS.has(keyOf(f)));
    const errors = bySeverity("error");
    const warns = bySeverity("warn");
    const net = findings.filter(f => f.severity === "info");
    const excepted = findings.filter(f => REVIEWED_EXCEPTIONS.has(keyOf(f)));

    console.log("── Esharq security audit ──");
    console.log(`  ${files.length} source files across ${new Set(files.map(pluginOf)).size} plugins`);

    console.log(`\n── Token access / backdoors / native exec ──`);
    if (errors.length === 0) {
        console.log("  none");
    } else {
        for (const f of errors) console.log(`  ERROR ${f.plugin} — ${f.rule} — ${f.file}:${f.line}\n        ${f.code}`);
    }

    if (excepted.length > 0) {
        console.log(`\n── Reviewed exceptions (accepted risk, re-read these) ──`);
        const seen = new Set();
        for (const f of excepted) {
            const key = keyOf(f);
            if (seen.has(key)) continue;
            seen.add(key);
            console.log(`  ${f.plugin} — ${f.rule} — ${f.file}`);
            console.log(`    ${REVIEWED_EXCEPTIONS.get(key)}`);
        }
    }

    console.log(`\n── Obfuscation ──`);
    if (warns.length === 0) console.log("  none");
    else for (const f of warns) console.log(`  WARN  ${f.plugin} — ${f.file}:${f.line}\n        ${f.code}`);

    console.log(`\n── Native (main-process) bridges ──`);
    if (nativeBridges.length === 0) console.log("  none");
    else for (const n of nativeBridges) console.log(`  ${n.plugin} — ${n.file}`);

    console.log(`\n── Network egress ──`);
    console.log(`  ${net.length} call sites; ${hostUse.size} distinct hosts referenced`);

    const kindOf = host => {
        if (ALLOWED_HOSTS.has(host)) return ALLOWED_HOSTS.get(host)[0];
        for (const [allowed, meta] of ALLOWED_HOSTS) {
            if (host.endsWith(`.${allowed}`)) return meta[0];
        }
        return null;
    };
    for (const kind of ["api", "upload", "link"]) {
        const hosts = [...hostUse.keys()].filter(h => kindOf(h) === kind).sort();
        if (hosts.length) console.log(`  ${kind.padEnd(6)} (${hosts.length}): ${hosts.join(", ")}`);
    }

    if (unknownHosts.length === 0) {
        console.log("  every referenced host is declared with a reason");
    } else {
        for (const [host, plugins] of unknownHosts) {
            console.log(`  UNLISTED ${host}  <- ${[...plugins].join(", ")}`);
        }
    }

    const failed = errors.length + unknownHosts.length;
    console.log(`\n──────────────────────────`);
    console.log(`securityAudit: ${errors.length} error(s), ${unknownHosts.length} unlisted host(s), ${warns.length} warning(s)`);
    if (failed > 0) process.exit(1);
}
