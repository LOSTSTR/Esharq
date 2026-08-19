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
 * STATIC AUDIT of the pinned patcher.node (2026-08-11, 619a2733…, 309760 bytes),
 * done by parsing the PE without executing it:
 *
 *   - Imports ONE dll, kernel32. No ws2_32/wininet/winhttp/urlmon/dnsapi, so it has
 *     no linked network capability at all; no shell32/CreateProcess/WinExec, so it
 *     cannot spawn anything; no advapi32/crypt32, so no registry or credential APIs.
 *   - The OS calls it does import — GetModuleHandleW, K32GetModuleInformation,
 *     VirtualProtect, FlushInstructionCache, GetCurrentProcess — are exactly the set
 *     the published patcher.cpp uses.
 *   - No URLs, no IP literals, no base64 blobs. Its strings are the documented result
 *     fields and error codes (`module_base`, `patches_in_ini`, `rva_out_of_bounds`,
 *     `already_patched`, `discord_voice.node not found in process`).
 *   - The embedded PDB path is `D:\a\DiscordVoicePatcher\DiscordVoicePatcher\build\
 *     Release\patcher.pdb` — the GitHub Actions Windows runner layout for that repo,
 *     matching the `build/Release/patcher.node` artifact its public
 *     .github/workflows/build-and-release.yml compiles with node-gyp and uploads.
 *
 * What that does NOT establish: the build is not reproducible, so the bytes cannot be
 * proven to come from that source; and LoadLibrary/GetProcAddress are present (as in
 * every MSVC binary), which is in principle a way to resolve APIs that are not
 * imported. The evidence is strong, not conclusive. If a stronger guarantee is ever
 * required, the answer is to build it ourselves from source, not to trust harder.
 */

import { DATA_DIR } from "@main/utils/constants";
import { downloadToFile } from "@main/utils/http";
import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { spawn, spawnSync } from "child_process";
import { createHash } from "crypto";
import { dialog, IpcMainInvokeEvent, shell } from "electron";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const PRELOAD_WORLD_ID = 999;

/** Pinned to Loukious/DiscordVoicePatcher release `d849d17` (2026-03-21). */
const PINNED_ASSETS = {
    node: {
        id: 378551934,
        sha256: "619a2733bb15d3828ed1616302f011b8e84999cad3da3339f08191e0aff9c0f9",
        size: 309760,
    },
    ini: {
        id: 380950707,
        sha256: "47f856bcadafb5ef565f5ebd8ea35314b196d550b8bb9790b12963f9dbe4dbea",
        size: 7050,
    },
} as const;

const ASSET_URL = (id: number) => `https://api.github.com/repos/Loukious/DiscordVoicePatcher/releases/assets/${id}`;

const CACHE_DIR = join(DATA_DIR, "plugins", "MicPro");
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

export async function applyPatches(_event: IpcMainInvokeEvent) {
    await ensureAssets();

    // Re-verify immediately before executing: the cache lives in a user-writable
    // directory, so the check that matters is the one closest to the require().
    if (!isVerified(NODE_PATH, PINNED_ASSETS.node) || !isVerified(INI_PATH, PINNED_ASSETS.ini)) {
        throw new Error("MicPro voice assets failed verification and were not executed");
    }

    const result = await _event.sender.executeJavaScriptInIsolatedWorld(PRELOAD_WORLD_ID, [{
        code: `(() => {
            try {
                const requireFn = typeof globalThis.require === "function"
                    ? globalThis.require
                    : (() => {
                        const m = globalThis.process?.getBuiltinModule?.("module") ?? globalThis.process?.getBuiltinModule?.("node:module");
                        if (!m?.createRequire) throw new Error("No require available");
                        return m.createRequire(${JSON.stringify(NODE_PATH)});
                    })();
                return requireFn(${JSON.stringify(NODE_PATH)}).applyPatches(${JSON.stringify(INI_PATH)});
            } catch (e) {
                return { error: e instanceof Error ? e.name + ": " + e.message : String(e) };
            }
        })();`
    }]);

    if (result == null) throw new Error("Isolated-world execution returned no result");
    return { assetSource: "pinned d849d17", ...result };
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

/**
 * بصمة وحدة الصوت التي يزرعها Stereo Hub (نسخة بناء 1.0.9243 وقد غُيّر فيها
 * 836 بايتاً). وجودها يعني أن ديسكورد مُرقَّع على القرص — فيتعارض مع ستيريو
 * MicPro الذي يُرقّع في الذاكرة.
 */
const STEREO_HUB_NODE_SHA256 = "dccda1f5770572523429abca88dcb3a5bbbca7b7703e119391ad3751fafb7a42";

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
    for (const node of nodes) {
        try {
            if (sha256(node) === STEREO_HUB_NODE_SHA256) patched++;
        } catch { /* ملفّ مقفل أثناء التشغيل — يُعدّ غير مُرقَّع */ }
    }
    return { clients: nodes.length, patched };
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
