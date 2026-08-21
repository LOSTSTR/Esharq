/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * **مكتبة ثيمات BetterDiscord** — القراءة والتنزيل، في العملية الرئيسية.
 *
 * ## 🔴 ولماذا هنا لا في المُصيَّر
 *
 * قِيس: `betterdiscord.app` **لا يُرسل `Access-Control-Allow-Origin`**. فحتى
 * بعد السماح له في سياسة المحتوى يبقى المُصيَّر عاجزاً عن قراءة الجواب —
 * المتصفّح يمنعه، لا نحن. وأُثبِت ذلك بعد إعادة تشغيلٍ كاملة: الطلب ظلّ
 * `Failed to fetch`.
 *
 * والعملية الرئيسية ليست صفحةً، فلا سياسةَ مصدرٍ واحد عليها. فتقرأ هي، ويبقى
 * المُصيَّر بلا صلاحيةِ شبكةٍ جديدة.
 *
 * ⚠️ والصور تبقى في المُصيَّر: `<img>` لا تحتاج CORS، ويكفيها `img-src` في
 * السياسة — فلا تمرّ ميغابايتاتُ المصغّرات عبر IPC بلا داعٍ.
 *
 * ## ولا واجهة برمجية عندهم
 *
 * جُرّبت `api.betterdiscord.app/v2/store/themes` و`/v1/…` و`/api/themes`
 * وغيرها: كلّها `404`، وواحدةٌ تُحوّل إلى جوجل. والصفحة تُصيَّر في الخادم
 * وتحمل بياناتها نصّاً، فتُقرأ منها.
 */

import { ipcMain, shell } from "electron";
import { mkdirSync, writeFileSync } from "fs";

import { IpcEvents } from "../shared/IpcEvents";
import { fileNameFor, LibraryTheme, parseThemes } from "./themeLibraryParse";
import { THEMES_DIR } from "./utils/constants";
import { ensureSafePath } from "./utils/ensureSafePath";

export type { LibraryTheme } from "./themeLibraryParse";
export { fileNameFor, parseThemes } from "./themeLibraryParse";

const SITE = "https://betterdiscord.app";

/** ترويسةُ متصفّحٍ عاديّ: بعض المواقع تردّ صفحةً مختلفة لعميلٍ بلا هويّة. */
const HEADERS = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml"
};

export type LibraryResult =
    | { ok: true; themes: LibraryTheme[]; }
    | { ok: false; reason: "offline" | "http" | "shape"; };

export function registerThemeLibraryIpc() {
    ipcMain.handle(IpcEvents.THEME_LIBRARY_LIST, async (): Promise<LibraryResult> => {
        let html: string;
        try {
            const response = await fetch(`${SITE}/themes`, { headers: HEADERS });
            if (!response.ok) return { ok: false, reason: "http" };
            html = await response.text();
        } catch {
            return { ok: false, reason: "offline" };
        }

        const themes = parseThemes(html);
        // صفرٌ يعني أن شكل الصفحة تغيّر — حالةٌ تُقال لا تُخفى خلف قائمةٍ فارغة.
        return themes.length === 0 ? { ok: false, reason: "shape" } : { ok: true, themes };
    });

    /**
     * ينزّل ثيماً ويكتبه في مجلد الثيمات.
     *
     * 🔴 العنوان يُبنى من **الرقم** لا من حقلٍ في الصفحة، والاسم يُعاد بناؤه
     * هنا لا يُؤخذ من المُصيَّر: كلاهما مُدخَلٌ يعبر IPC، ومن يتحكّم به يختار
     * وإلّا المضيفَ الذي نُنزّل منه والمسارَ الذي نكتب فيه.
     */
    ipcMain.handle(IpcEvents.THEME_LIBRARY_INSTALL, async (_, rawId: unknown, rawName: unknown) => {
        const id = Number(rawId);
        if (!Number.isInteger(id) || id <= 0) return { ok: false, reason: "bad-id" };

        const fileName = fileNameFor(typeof rawName === "string" ? rawName : "", id);
        const safe = ensureSafePath(THEMES_DIR, fileName);
        if (!safe) return { ok: false, reason: "bad-name" };

        let css: string;
        try {
            const response = await fetch(`${SITE}/download?id=${id}`, { headers: HEADERS });
            if (!response.ok) return { ok: false, reason: "download" };
            css = await response.text();
        } catch {
            return { ok: false, reason: "download" };
        }

        if (css.trim() === "") return { ok: false, reason: "empty" };

        try {
            mkdirSync(THEMES_DIR, { recursive: true });
            writeFileSync(safe, css, "utf8");
            return { ok: true, fileName, bytes: Buffer.byteLength(css, "utf8") };
        } catch {
            return { ok: false, reason: "save" };
        }
    });

    /** صفحة الثيم في المعرض — تُفتح في متصفّح المستخدم لا داخل ديسكورد. */
    ipcMain.handle(IpcEvents.THEME_LIBRARY_OPEN, (_, rawId: unknown) => {
        const id = Number(rawId);
        if (!Number.isInteger(id) || id <= 0) return;
        return shell.openExternal(`${SITE}/theme?id=${id}`);
    });
}
