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
 */

import { DATA_DIR } from "@main/utils/constants";
import { downloadToFile } from "@main/utils/http";
import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { createHash } from "crypto";
import { IpcMainInvokeEvent } from "electron";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync } from "fs";
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
