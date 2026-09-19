/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/*
 * Stereo transmission requires patching Discord's own `discord_voice.node`: the
 * native module downmixes to mono and caps the Opus bitrate regardless of the
 * `channels: 2` we set through setTransportOptions, so the JS layer alone cannot
 * deliver stereo.
 *
 * SECURITY — read before changing anything here.
 *
 * This downloads a compiled native module and executes it inside Discord. That is
 * only acceptable because the exact bytes are pinned and verified:
 *
 *   1. PINNED RELEASE ASSETS, addressed by immutable asset id — never `latest`.
 *      Following a moving tag hands whoever controls the repository native code
 *      execution on every user's machine, retroactively.
 *   2. SHA-256 VERIFIED before the file is ever used, on download AND on every
 *      cached load. A mismatch deletes the file and aborts — it never executes.
 *   3. UPSTREAM SOURCE. Loukious/DiscordVoicePatcher is the original project whose
 *      `patcher.cpp` and `patcher.ini` are public and readable. A downstream fork
 *      previously used here shipped a `patcher.node` with a different hash that
 *      could not be reproduced from readable source.
 *
 * To update: bump both asset ids AND both hashes together, taking the digests from
 * the GitHub releases API. Never relax the check to make an update "work".
 *
 * STATIC AUDIT of the pinned release `62de190` (2026-09-19), done without executing
 * anything. patcher.node 54e725ce…592f (322560 B), patcher.ini 22582efb…bc91 (8585 B).
 *
 *   - Imports KERNEL32 only, plus the delay-loaded `node.exe` N-API. No
 *     ws2_32/wininet/winhttp/urlmon/dnsapi (no network), no shell32/CreateProcess/
 *     WinExec (cannot spawn), no advapi32/crypt32 (no registry or credentials). The
 *     import set is identical to the previously audited `d849d17`.
 *   - Its only patcher-specific OS calls — GetModuleHandleW, K32GetModuleInformation,
 *     VirtualProtect, FlushInstructionCache, GetCurrentProcess — are exactly those in
 *     the published patcher.cpp. Every GetProcAddress call site resolves a CRT/
 *     delay-load name; no syscall instructions, no PEB walking, no call leaves .text.
 *   - No URLs, IP literals or base64 blobs; the only path is the CI PDB path.
 *   - PROVENANCE, stronger than before: both assets were uploaded by
 *     `github-actions[bot]` and are **byte-identical to the CI artifact** of run
 *     34152714356, which checked out commit 62de190 and compiled the public
 *     patcher.cpp with node-gyp on windows-2022.
 *   - The ini only locates and edits bytes inside the hard-coded discord_voice.node
 *     (the parser knows 11 keys; every section here uses only those). Each edit is a
 *     small change to an existing instruction — channel count 1→2, bitrate
 *     constants 32000→384000, jcc→jmp, `ret` on the high-pass/downmix/throw paths,
 *     `mov rax,1; ret` on an "is config ok" check. None introduces new code.
 *     Because writing bytes into .text IS code execution, the ini is hash-pinned
 *     exactly like the binary.
 *
 * 🔴 Why the pin moved from d849d17: the author re-uploaded d849d17's ini by hand on
 * 2026-08-11 (our pinned asset id went 404, so fresh installs got no stereo), and
 * Discord's voice module grew 14.7 → 22.1 MB, where the March patterns resolve only
 * 6/17 on Stable 9258 — the stereo-critical ones among the missing. 62de190 resolves
 * 17/17 on Stable 9258 and Canary 1185 (offline scan of the module files).
 *
 * What this does NOT establish: we have not reproduced the build ourselves. The
 * evidence is strong, not conclusive; the stronger answer is building from source.
 */

import { DATA_DIR } from "@main/utils/constants";
import { downloadToFile } from "@main/utils/http";
import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { spawn, spawnSync } from "child_process";
import { createHash } from "crypto";
import { app, dialog, IpcMainInvokeEvent, shell } from "electron";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "fs";
import { homedir } from "os";
import { basename, join } from "path";

import { patchVoiceModuleFile } from "./diskPatcher";
import { applyStereoPatch, isDiskPatchedVoiceNode, revertStereoPatch, type StereoPatterns, stereoTargets, sweepStereo } from "./stereoPatch";

const PRELOAD_WORLD_ID = 999;

/**
 * Pinned to Loukious/DiscordVoicePatcher release `62de190` (2026-09-07). Both assets
 * come from the same release — never mix a binary and an ini from different ones.
 */
const PINNED_RELEASE = "62de190";
const PINNED_ASSETS = {
    node: {
        id: 549229316,
        sha256: "54e725ceadbf03d9024533c91eaed31276351d6b4bc6694bbeef1b393043592f",
        size: 322560,
    },
    ini: {
        id: 549229317,
        sha256: "22582efb5af5dff51343f6f3ca382b3a819b32d4e73e47dedb829cd5db53bc91",
        size: 8585,
    },
} as const;

const ASSET_URL = (id: number) => `https://api.github.com/repos/Loukious/DiscordVoicePatcher/releases/assets/${id}`;

// 🔴 مجلّدٌ لكلّ إصدارٍ مثبَّت: المستقرّ وكناري يتشاركان DATA_DIR، فتحديثُ أحدهما كان
// يحذف patcher.node الذي يحمّله الآخر (EPERM) فيسقط الستيريو فيه.
const CACHE_DIR = join(DATA_DIR, "plugins", "MicPro", PINNED_RELEASE);
const NODE_PATH = join(CACHE_DIR, "patcher.node");
const INI_PATH = join(CACHE_DIR, "patcher.ini");

type PinnedAsset = typeof PINNED_ASSETS[keyof typeof PINNED_ASSETS];

let assetsPromise: Promise<void> | null = null;

function sha256(path: string) {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** True only if the file exists and its bytes hash to exactly the pinned digest. */
function isVerified(path: string, asset: PinnedAsset) {
    if (!existsSync(path)) return false;
    try {
        return sha256(path) === asset.sha256;
    } catch {
        return false;
    }
}

async function ensureAsset(path: string, asset: PinnedAsset, label: string) {
    if (isVerified(path, asset)) return;

    // Anything already there failed verification — do not keep it around.
    if (existsSync(path)) unlinkSync(path);

    const tmp = `${path}.download`;
    try {
        await downloadToFile(ASSET_URL(asset.id), tmp, {
            headers: {
                // The REST asset endpoint returns the binary itself only with this Accept.
                Accept: "application/octet-stream",
                "User-Agent": VENCORD_USER_AGENT,
            },
        });

        const actual = sha256(tmp);
        if (actual !== asset.sha256) {
            throw new Error(`${label} failed integrity check: expected ${asset.sha256}, got ${actual}`);
        }

        renameSync(tmp, path);
    } finally {
        // Never leave an unverified partial file where a later run might trust it.
        if (existsSync(tmp)) unlinkSync(tmp);
    }
}

async function ensureAssets() {
    assetsPromise ??= (async () => {
        mkdirSync(CACHE_DIR, { recursive: true });
        // بقايا المجلّد القديم (قبل مجلّد الإصدار): تُحذف إن أمكن، ويُتجاهل الفشل لأنّ
        // عميلاً آخر يعمل بنسخةٍ أقدم قد يحملها الآن.
        for (const old of ["patcher.node", "patcher.ini", "release.json"]) {
            try { rmSync(join(CACHE_DIR, "..", old), { force: true }); } catch { /* مقفل ⇒ يبقى */ }
        }
        await ensureAsset(NODE_PATH, PINNED_ASSETS.node, "patcher.node");
        await ensureAsset(INI_PATH, PINNED_ASSETS.ini, "patcher.ini");
    })();

    try {
        await assetsPromise;
    } catch (err) {
        assetsPromise = null; // let a later attempt retry (e.g. after the network returns)
        throw err;
    }
}

/**
 * 🔴 One application per renderer process. discord_voice.node stays loaded (and
 * patched) for the life of the process, but a page reload starts a fresh JS session
 * that asks again. A second scan on already-patched bytes is NOT harmless: the
 * SetsBitrateBitrateValue patch overwrites a byte its own pattern requires and has
 * no `expected` guard, so the rescan skips the patched site and writes 5 bytes at
 * the *next* match — measured live (0x324fe6 on the first call, 0x635D60 on the
 * second). So the first result is remembered per OS process and returned again.
 */
/** What the patcher returns (patcher.cpp @62de190), tagged with where the bytes came from. */
export interface PatcherResult {
    assetSource: string;
    error?: string;
    /** Served from the per-process memo instead of scanning again. */
    cached?: boolean;
    /** revertPatches() called in a process that never applied anything. */
    notApplied?: boolean;
    /** Some sites could not be reverted — no rescan until Discord restarts. */
    partialRevert?: boolean;
    ok?: number;
    failed?: number;
    skipped?: number;
    patches_in_ini?: number;
    module_base?: string;
    tracked?: number;
    tracked_before?: number;
    tracked_after?: number;
    patches?: { name: string; status: string; rva?: string; tier?: string; }[];
}

const appliedByProcess = new Map<number, PatcherResult>();

function patcherCall(method: "applyPatches" | "revertPatches") {
    const args = method === "applyPatches" ? JSON.stringify(INI_PATH) : "";
    return `(() => {
        try {
            const requireFn = typeof globalThis.require === "function"
                ? globalThis.require
                : (() => {
                    const m = globalThis.process?.getBuiltinModule?.("module") ?? globalThis.process?.getBuiltinModule?.("node:module");
                    if (!m?.createRequire) throw new Error("No require available");
                    return m.createRequire(${JSON.stringify(NODE_PATH)});
                })();
            const patcher = requireFn(${JSON.stringify(NODE_PATH)});
            if (typeof patcher.${method} !== "function") throw new Error("${method} is not available in this patcher build");
            return patcher.${method}(${args});
        } catch (e) {
            return { error: e instanceof Error ? e.name + ": " + e.message : String(e) };
        }
    })();`;
}

function assertVerified() {
    // Re-verify immediately before executing: the cache lives in a user-writable
    // directory, so the check that matters is the one closest to the require().
    if (!isVerified(NODE_PATH, PINNED_ASSETS.node) || !isVerified(INI_PATH, PINNED_ASSETS.ini)) {
        throw new Error("MicPro voice assets failed verification and were not executed");
    }
}

/**
 * One chain of operations per renderer process: apply, revert and the state query
 * all queue on it, so a query never answers "not patched" while an apply that will
 * patch is still running (a page reload mid-download used to see exactly that).
 */
const opByProcess = new Map<number, Promise<unknown>>();
function queued<T>(pid: number, op: () => Promise<T>): Promise<T> {
    const previous = opByProcess.get(pid) ?? Promise.resolve();
    const next = previous.catch(() => { }).then(op);
    opByProcess.set(pid, next);
    const settle = () => { if (opByProcess.get(pid) === next) opByProcess.delete(pid); };
    next.then(settle, settle);
    return next;
}

/** A renderer process may one day reuse this OS pid; forget it when it dies. Registered once per window. */
const watchedSenders = new WeakSet<object>();
function forgetOnDeath(sender: IpcMainInvokeEvent["sender"], pid: number) {
    if (watchedSenders.has(sender)) return;
    watchedSenders.add(sender);
    const forget = () => { appliedByProcess.delete(pid); opByProcess.delete(pid); };
    sender.once("render-process-gone", forget);
    sender.once("destroyed", forget);
}

/**
 * هل الوحدة التي يُشغّلها ديسكورد هذا **مُرقَّعة على القرص**؟ 🔴 حينها لا يجوز الترقيع
 * في الذاكرة: المسح فوق ملفٍّ مُرقَّع يحلّ ٧ من ١٧ نمطاً، ثلاثٌ منها على مواضع
 * **أخرى** فيكتب في غير مكانه (قِيس ٢٠٢٦-٠٩-١٩).
 *
 * طبقتان: البصمة لما نعرفه (ستيريو إشراق الدائم، وحمولة 9243 التي يزرعها Stereo
 * Hub)؛ ثمّ الأنماط نفسها لما لا نعرفه — وحدةٌ أصليّة لا تحمل بايتات أيّ رقعة في
 * موضعها، فوجود واحدةٍ منها يعني أنّ أداةً ما رقّعتها. يُحفظ الناتج لكلّ (ملفّ،
 * حجم، وقت تعديل) لأنّ المسح نصف ثانية.
 */
const diskPatchScan = new Map<string, boolean>();
function runningVoiceNodeIsDiskPatched(): boolean {
    try {
        const modules = join(process.execPath, "..", "modules");
        const mod = readdirSync(modules).find(name => name.startsWith("discord_voice"));
        if (mod === undefined) return false;
        const node = join(modules, mod, "discord_voice", "discord_voice.node");
        if (!existsSync(node)) return false;
        if (isDiskPatchedVoiceNode(node)) return true;

        if (!isVerified(INI_PATH, PINNED_ASSETS.ini)) return false;
        const { size, mtimeMs } = statSync(node);
        const key = `${node}|${size}|${mtimeMs}`;
        let patched = diskPatchScan.get(key);
        if (patched === undefined) {
            const outcome = patchVoiceModuleFile(readFileSync(node), readFileSync(INI_PATH, "latin1"));
            patched = outcome.patches.some(p => p.status === "already_patched");
            diskPatchScan.set(key, patched);
        }
        return patched;
    } catch {
        return false;
    }
}

/**
 * الخطوة الأولى، بلا أيّ كتابة: فحص القرص ثمّ التنزيل والتحقّق. تُفصَل عن الترقيع كي
 * يُعيد المحرّك فحص «هل الصوت مشغول؟» **بعد** التنزيل مباشرةً — فمكالمةٌ تبدأ أثناء
 * تنزيلٍ أوّل كانت تُكتَب وحدتها وهي تعمل.
 */
export async function prepareStereo(_event: IpcMainInvokeEvent): Promise<{ ok: boolean; error?: string; }> {
    if (runningVoiceNodeIsDiskPatched()) return { ok: false, error: "DISK_PATCHED" };
    try {
        await ensureAssets();
        assertVerified();
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
}

export function applyPatches(_event: IpcMainInvokeEvent): Promise<PatcherResult> {
    const pid = _event.sender.getOSProcessId();
    return queued(pid, async () => {
        const previous = appliedByProcess.get(pid);
        if (previous) return { ...previous, cached: true };

        if (runningVoiceNodeIsDiskPatched()) return { assetSource: `pinned ${PINNED_RELEASE}`, error: "DISK_PATCHED" };
        await ensureAssets();
        assertVerified();

        const result = await _event.sender.executeJavaScriptInIsolatedWorld(PRELOAD_WORLD_ID, [{ code: patcherCall("applyPatches") }]);
        if (result == null) throw new Error("Isolated-world execution returned no result");

        const tagged: PatcherResult = { assetSource: `pinned ${PINNED_RELEASE}`, ...result };
        // Only a call that actually reached the module is remembered; an error (e.g.
        // discord_voice not loaded yet) leaves the door open for a later attempt.
        if (!result.error) {
            appliedByProcess.set(pid, tagged);
            forgetOnDeath(_event.sender, pid);
        }
        return tagged;
    });
}

/** هل هذه العمليّة مُرقَّعة الآن بفعلنا؟ — ينتظر أيّ عمليّةٍ جارية قبل أن يُجيب. */
export async function patchState(_event: IpcMainInvokeEvent): Promise<{ applied: boolean; result?: PatcherResult; }> {
    const pid = _event.sender.getOSProcessId();
    await (opByProcess.get(pid) ?? Promise.resolve()).catch(() => { });
    const result = appliedByProcess.get(pid);
    return result ? { applied: true, result } : { applied: false };
}

/**
 * Restores the original bytes of every patch this process applied. The patcher only
 * writes a site back when its current bytes are still exactly what it wrote, so it
 * never clobbers bytes changed by someone else.
 */
export function revertPatches(_event: IpcMainInvokeEvent): Promise<PatcherResult> {
    const pid = _event.sender.getOSProcessId();
    return queued(pid, async () => {
        const previous = appliedByProcess.get(pid);
        if (!previous) return { assetSource: `pinned ${PINNED_RELEASE}`, notApplied: true, ok: 0, failed: 0, skipped: 0 };

        assertVerified();
        const result = await _event.sender.executeJavaScriptInIsolatedWorld(PRELOAD_WORLD_ID, [{ code: patcherCall("revertPatches") }]);
        if (result == null) throw new Error("Isolated-world execution returned no result");

        if (!result.error && result.failed === 0) {
            // Nothing left patched ⇒ a later enable may scan again safely (the original
            // bytes are back, so the patterns match the same sites as the first time).
            appliedByProcess.delete(pid);
        } else if (!result.error) {
            // 🔴 Some sites are still ours: rescanning now would miss them and hit other
            // matches. Remember the process as partially reverted — patchState says so,
            // and applyPatches returns this instead of scanning — until Discord restarts.
            appliedByProcess.set(pid, { ...previous, partialRevert: true });
        }
        return { assetSource: `pinned ${PINNED_RELEASE}`, ...result };
    });
}


/* ─────────────────────────────────────────────────────────────────────────────
 * أدوات مختبر الصوت الخارجية — **تُثبَّت بقرار المستخدم وحده**.
 *
 * لا شيء هنا يُنزَّل مع إشراق ولا عند تثبيته: كل تنزيل يبدأ بضغطة زرّ صريحة
 * بعد تحذير مكتوب. والأدوات تبقى **كما يشحنها أصحابها** — لا نُعدّلها ولا
 * نُعيد كتابتها، فمن أراد قراءة مصدرها وجده كما هو.
 *
 * ما نُضيفه نحن هو ما ينقصها: **التثبيت على التزام بعينه والتحقّق بـSHA-256**
 * قبل أي استعمال. أداة Stereo Hub تُنزّل نفسها من فرع متحرّك بلا أي بصمة،
 * فنسخة إشراق تأخذ الملفّ من التزام مُجمَّد وتتحقّق من بايتاته.
 * ───────────────────────────────────────────────────────────────────────────── */

const TOOLS_DIR = join(DATA_DIR, "tools");
const TOOLS_STATE = join(TOOLS_DIR, "state.json");

/** ملفّ Stereo Hub مثبَّتاً على التزام `5e96ff0` (2026-07-01) ومُتحقَّقاً ببصمته. */
const STEREO_HUB = {
    commit: "5e96ff026df45151d90b309cdece9dc82ec2267b",
    sha256: "bdd071b20e69b1bf6d357eaa96b8cefe07e10437058d582decefa4deb4b12510",
    size: 66088,
    url: "https://raw.githubusercontent.com/ProdHallow/Discord-Stereo-Windows-MacOS-Linux/5e96ff026df45151d90b309cdece9dc82ec2267b/STEREO%20HUB/discord_stereo_hub.py",
    file: join(TOOLS_DIR, "stereo-hub", "discord_stereo_hub.py")
} as const;

interface ToolsState {
    /** مسار برنامج مغيّر الصوت كما حدّده المستخدم — نحن لا نُنزّله. */
    vcClientPath?: string;
}

function readToolsState(): ToolsState {
    try {
        return JSON.parse(readFileSync(TOOLS_STATE, "utf8")) as ToolsState;
    } catch {
        return {};
    }
}

function writeToolsState(state: ToolsState) {
    mkdirSync(TOOLS_DIR, { recursive: true });
    writeFileSync(TOOLS_STATE, JSON.stringify(state, null, 2));
}

/** أوّل أمر بايثون يعمل فعلاً. `py` مُشغّل ويندوز الرسمي و`python3` لبقيّة الأنظمة. */
function findPython(): string | null {
    for (const [cmd, args] of [["py", ["-3", "--version"]], ["python3", ["--version"]], ["python", ["--version"]]] as const) {
        try {
            const { status } = spawnSync(cmd, args, { timeout: 4000, windowsHide: true });
            if (status === 0) return cmd;
        } catch { /* المحاولة التالية */ }
    }
    return null;
}

/** كل مجلدات `discord_voice` لعملاء ديسكورد المثبَّتة على هذا الجهاز. */
function discordVoiceNodes(): string[] {
    const roots = process.platform === "win32"
        ? ["Discord", "DiscordCanary", "DiscordPTB", "DiscordDevelopment"].map(n => join(process.env.LOCALAPPDATA ?? "", n))
        : [join(homedir(), ".config")];

    const out: string[] = [];
    for (const root of roots) {
        if (!existsSync(root)) continue;
        try {
            for (const app of readdirSync(root)) {
                if (!app.startsWith("app-")) continue;
                const modules = join(root, app, "modules");
                if (!existsSync(modules)) continue;
                for (const mod of readdirSync(modules)) {
                    if (!mod.startsWith("discord_voice")) continue;
                    const node = join(modules, mod, "discord_voice", "discord_voice.node");
                    if (existsSync(node)) out.push(node);
                }
            }
        } catch { /* عميل لا نملك قراءته — نتخطّاه */ }
    }
    return out;
}

/**
 * هل وحدة صوت ديسكورد مُرقَّعة على القرص؟
 *
 * الجواب من **بصمة الملفّ نفسه** لا من وجود الأداة: المستخدم قد يحذف الأداة
 * ويبقى الترقيع، أو يُبقيها بلا ترقيع. والحالة التي تهمّ هي حال ديسكورد.
 */
export function voicePatchState(_event: IpcMainInvokeEvent) {
    const nodes = discordVoiceNodes();
    let patched = 0;
    // بصمة Stereo Hub وبصمات ستيريو إشراق الدائم معاً.
    for (const node of nodes) if (isDiskPatchedVoiceNode(node)) patched++;
    // `running`: وحدة الصوت التي يُشغّلها هذا الديسكورد نفسه — وهي وحدها ما يحكم «ستيريو
    // الجلسة». أمّا `patched` فيعدّ كلّ مجلّد app-* ولو كان بقيّةَ بناءٍ قديم.
    return { clients: nodes.length, patched, running: runningVoiceNodeIsDiskPatched() };
}

export function toolsStatus(_event: IpcMainInvokeEvent) {
    const state = readToolsState();
    const vcPath = state.vcClientPath;
    return {
        stereoHub: {
            installed: existsSync(STEREO_HUB.file) && sha256(STEREO_HUB.file) === STEREO_HUB.sha256,
            path: STEREO_HUB.file,
            python: findPython()
        },
        vcClient: {
            installed: vcPath !== undefined && existsSync(vcPath),
            path: vcPath ?? null
        }
    };
}

/** يُنزّل Stereo Hub كما يشحنه صاحبه، من التزام مُجمَّد، ولا يُقبل إلّا ببصمته. */
export async function installStereoHub(_event: IpcMainInvokeEvent) {
    mkdirSync(join(TOOLS_DIR, "stereo-hub"), { recursive: true });
    const tmp = `${STEREO_HUB.file}.download`;
    try {
        await downloadToFile(STEREO_HUB.url, tmp, { headers: { "User-Agent": VENCORD_USER_AGENT } });
        const actual = sha256(tmp);
        if (actual !== STEREO_HUB.sha256) {
            throw new Error(`Stereo Hub failed integrity check: expected ${STEREO_HUB.sha256}, got ${actual}`);
        }
        renameSync(tmp, STEREO_HUB.file);
    } finally {
        if (existsSync(tmp)) unlinkSync(tmp);
    }
    return { path: STEREO_HUB.file, python: findPython() };
}

export function openStereoHub(_event: IpcMainInvokeEvent) {
    if (!existsSync(STEREO_HUB.file) || sha256(STEREO_HUB.file) !== STEREO_HUB.sha256) {
        throw new Error("Stereo Hub is not installed or failed verification");
    }
    const python = findPython();
    if (python == null) throw new Error("No Python interpreter was found");

    const args = python === "py" ? ["-3", STEREO_HUB.file] : [STEREO_HUB.file];
    // مفتاح الأداة نفسها لإيقاف تحديثها الذاتي: بدونه تُنزّل ملفّها من فرع
    // متحرّك وتكتب فوق النسخة التي تحقّقنا من بصمتها — فيسقط التثبيت الذي
    // ضمنّاه. لا نُعدّل الأداة، نستعمل مفتاحها الموثّق.
    const child = spawn(python, args, {
        cwd: join(TOOLS_DIR, "stereo-hub"),
        detached: true,
        stdio: "ignore",
        env: { ...process.env, DISCORD_STEREO_SKIP_HUB_SELF_UPDATE: "1" }
    });
    child.unref();
    return { ok: true };
}

/**
 * إزالة كاملة: ملفّ الأداة **ومجلد بياناتها الذي تُنشئه لنفسها**
 * (`%LOCALAPPDATA%\DiscordStereoHubSimple`). إزالة الملفّ وحده تترك سجلّها
 * ونسخها الاحتياطية على الجهاز، فيظنّ المستخدم أنه نظّف وهو لم ينظّف.
 */
export function removeStereoHub(_event: IpcMainInvokeEvent) {
    rmSync(join(TOOLS_DIR, "stereo-hub"), { recursive: true, force: true });

    const own = process.platform === "win32"
        ? join(process.env.LOCALAPPDATA ?? "", "DiscordStereoHubSimple")
        : join(homedir(), ".local", "share", "DiscordStereoHubSimple");
    // نسخة ديسكورد الأصلية تعيش هنا أيضاً: نتركها إن كان ديسكورد مُرقَّعاً،
    // وإلّا لَحُذف طريق الرجوع الوحيد.
    const backups = join(own, "backups");
    if (existsSync(backups) && voicePatchState(_event).patched > 0) {
        return { ok: true, keptBackups: backups };
    }
    rmSync(own, { recursive: true, force: true });
    return { ok: true, keptBackups: null };
}

/** يفتح صفحة التنزيل الرسمية — التثبيت فعلُ المستخدم على جهازه، لا فعلُنا. */
export function openUrl(_event: IpcMainInvokeEvent, url: string) {
    if (!/^https:\/\//.test(url)) throw new Error("Only https links can be opened");
    shell.openExternal(url);
    return { ok: true };
}

/** يسأل المستخدم عن مكان برنامج مغيّر الصوت بعد أن يُثبّته بنفسه. */
export async function locateVcClient(_event: IpcMainInvokeEvent) {
    const result = await dialog.showOpenDialog({
        title: "VCClient",
        properties: ["openFile"],
        filters: process.platform === "win32" ? [{ name: "VCClient", extensions: ["exe", "bat"] }] : []
    });
    if (result.canceled || result.filePaths.length === 0) return { path: null };

    const path = result.filePaths[0];
    writeToolsState({ ...readToolsState(), vcClientPath: path });
    return { path };
}

export function openVcClient(_event: IpcMainInvokeEvent) {
    const path = readToolsState().vcClientPath;
    if (path === undefined || !existsSync(path)) throw new Error("VCClient was not found at the saved path");
    const child = spawn(path, [], { cwd: join(path, ".."), detached: true, stdio: "ignore" });
    child.unref();
    return { ok: true };
}

export function forgetVcClient(_event: IpcMainInvokeEvent) {
    const state = readToolsState();
    delete state.vcClientPath;
    writeToolsState(state);
    return { ok: true };
}


/* ── ترقيع الستيريو داخل العميل (المنطق في `stereoPatch.ts`) ─────────────────
 * لا يبدأ شيء منه إلّا بضغطة المستخدم، و`dryRun` يُظهر ما سيجري قبل أن يجري.
 * ───────────────────────────────────────────────────────────────────────── */

/** الأنماط المثبَّتة نصّاً — لا تُقرأ إلّا بعد التحقّق من بصمتها، كالثنائيّ تماماً. */
function verifiedPatterns(): StereoPatterns | null {
    if (!isVerified(INI_PATH, PINNED_ASSETS.ini)) return null;
    return { text: readFileSync(INI_PATH, "latin1"), release: PINNED_RELEASE };
}

/** اسم عمليّة العميل الذي يعمل إشراق داخله الآن — لمطابقة ما ينتظره العامل. */
const DISCORD_EXE_NAMES = new Set(["Discord", "DiscordCanary", "DiscordPTB", "DiscordDevelopment"]);
function ownProcessName(): string | null {
    const exe = basename(process.execPath, ".exe");
    return DISCORD_EXE_NAMES.has(exe) ? exe : null;
}

/** يكنس ما لم يعد يلزم أوّلاً، ثمّ يُبلغ حال كلّ عميل — فتظهر «أُزيل نهائياً» حين تتمّ الإزالة. */
export async function stereoStatus(_event: IpcMainInvokeEvent) {
    // 🔴 الكنس قد يفشل (ملفّ مقفل، مضادّ فيروسات) — لا يُسقط عرضَ العملاء وزرّ الإزالة معه.
    let sweep: Awaited<ReturnType<typeof sweepStereo>> | null = null;
    try { sweep = await sweepStereo(); } catch (e) { console.error("[MicPro] permanent stereo sweep failed", e); }
    return {
        targets: stereoTargets(verifiedPatterns()),
        sweep,
        // هل ينتظر عاملٌ خروجَ هذا العميل بالذات؟ عندها وحدها يُجدي زرّ «أعد التشغيل».
        canRestart: sweep?.pending === true && !!ownProcessName() && sweep.pendingProcesses.includes(ownProcessName()!)
    };
}

export async function stereoApply(_event: IpcMainInvokeEvent, key: string, dryRun: boolean) {
    // الأنماط نفسها التي يستعملها ستيريو الجلسة، ويُتحقَّق منها قبل القراءة مباشرةً.
    await ensureAssets();
    const patterns = verifiedPatterns();
    if (patterns == null) throw new Error("MicPro voice assets failed verification and were not used");
    return applyStereoPatch(key, dryRun, patterns);
}

export function stereoRevert(_event: IpcMainInvokeEvent, key: string, dryRun: boolean) {
    return revertStereoPatch(key, dryRun);
}

/** عند بدء MicPro: ما أُزيل في الجلسة السابقة يُمحى أثره وإن لم تُفتح الصفحة. */
export function stereoSweep(_event: IpcMainInvokeEvent) {
    return sweepStereo();
}

/**
 * «أعد تشغيل ديسكورد الآن» بعد جدولة التبديل: إغلاقٌ عاديّ (لا قتل)، والعامل الذي
 * ينتظر خروجه يُبدّل الملفّ ثمّ يفتحه من جديد. لا يُغلق شيئاً إن لم يكن عاملٌ ينتظر.
 */
export async function stereoRestartDiscord(_event: IpcMainInvokeEvent) {
    const sweep = await sweepStereo();
    const own = ownProcessName();
    // 🔴 لا يُغلَق عميلٌ لا ينتظر خروجَه عامل: لو انتظر العاملُ عميلاً آخر، إغلاق هذا
    // العميل يُطفئه بلا أن يُتمّ شيئاً ولا يُعيد فتحه أحد.
    if (!sweep.pending || own == null || !sweep.pendingProcesses.includes(own)) {
        return { ok: false, waitingFor: sweep.pendingProcesses };
    }
    setTimeout(() => app.quit(), 400);
    return { ok: true };
}
