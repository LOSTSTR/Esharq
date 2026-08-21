/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DATA_DIR } from "@main/utils/constants";
import { IpcEvents } from "@shared/IpcEvents";
import { ipcMain, shell } from "electron";
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";

export interface DataEntry {
    /** مفتاح ثابت — الواجهة تترجمه، فلا يُترجَم هنا. */
    key: string;
    path: string;
    files: number;
    bytes: number;
    exists: boolean;
}

/** ما نجرده، بمفاتيح ثابتة تُترجمها الواجهة. */
const TARGETS: { key: string; rel: string; }[] = [
    { key: "settings", rel: "settings" },
    { key: "themes", rel: "themes" },
    { key: "plugins", rel: "plugins" },
    { key: "community", rel: "community" },
    { key: "tools", rel: "tools" },
    { key: "messageLogger", rel: "MessageLoggerData" }
];

function measure(dir: string): { files: number; bytes: number; } {
    let files = 0;
    let bytes = 0;
    const walk = (d: string, depth: number) => {
        if (depth > 6) return;
        for (const entry of readdirSync(d, { withFileTypes: true })) {
            const full = join(d, entry.name);
            try {
                if (entry.isDirectory()) walk(full, depth + 1);
                else if (entry.isFile()) { files++; bytes += statSync(full).size; }
            } catch { /* ملفّ اختفى بيننا — يُتخطّى */ }
        }
    };
    try { walk(dir, 0); } catch { /* المجلد غير موجود */ }
    return { files, bytes };
}

export function inventory(): { root: string; entries: DataEntry[]; } {
    const entries: DataEntry[] = TARGETS.map(({ key, rel }) => {
        const path = join(DATA_DIR, rel);
        const exists = existsSync(path);
        const { files, bytes } = exists ? measure(path) : { files: 0, bytes: 0 };
        return { key, path, files, bytes, exists };
    });
    return { root: DATA_DIR, entries };
}

export function registerDataInventoryIpc() {
    ipcMain.handle(IpcEvents.DATA_INVENTORY, () => inventory());
    ipcMain.handle(IpcEvents.DATA_OPEN_ROOT, () => { shell.openPath(DATA_DIR); });
}
