/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
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

import "./updater";
import "./ipcPlugins";
import "./settings";

import { debounce } from "@shared/debounce";
import { IpcEvents } from "@shared/IpcEvents";
import { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell, systemPreferences } from "electron";
import monacoHtml from "file://monacoWin.html?minify&base64";
import { existsSync, FSWatcher, mkdirSync, readFileSync, renameSync, unlinkSync, watch, writeFileSync } from "fs";
import { open, readdir, readFile, unlink } from "fs/promises";
import { release } from "os";
import { basename, join } from "path";

import { registerCspIpcHandlers } from "./csp/manager";
import { getThemeInfo, stripBOM, UserThemeHeader } from "./themes";
import { ALLOWED_PROTOCOLS, QUICK_CSS_PATH, SETTINGS_DIR, THEMES_DIR } from "./utils/constants";
import { ensureSafePath } from "./utils/ensureSafePath";
import { makeLinksOpenExternally } from "./utils/externalLinks";

const RENDERER_CSS_PATH = join(__dirname, "renderer.css");

mkdirSync(THEMES_DIR, { recursive: true });

registerCspIpcHandlers();

/**
 * قراءة QuickCSS — **الغياب وحده يُعَدّ فراغاً**.
 *
 * 🔴 كانت `.catch(() => "")` تبتلع كل خطأ: قفلٌ عابر من مضادّ فيروسات أو
 * مزامنة سحابية يُعيد نصّاً فارغاً، فيُفتح المحرّر **خالياً** ويظنّ صاحبه أنّ
 * ثيمه ضاع — ثمّ أوّل حرفٍ يكتبه يُحفَظ فوق الملفّ فيمحوه فعلاً. قِسته:
 * 7,619 بايتاً صارت 1.
 *
 * الآن يُميَّز الغياب (`ENOENT` — مستخدمٌ لم يكتب شيئاً بعد) عن العجز، والعجز
 * **يُرمى** فيراه من طلبه بدل أن يُسلَّم فراغاً كاذباً.
 */
async function readCss() {
    try {
        return await readFile(QUICK_CSS_PATH, "utf-8");
    } catch (e: any) {
        if (e?.code === "ENOENT") return "";
        console.error("[Esharq] تعذّرت قراءة quickCss:", e);
        throw e;
    }
}

/**
 * كتابةٌ **ذرّية** لـQuickCSS: ملفٌّ مؤقّت ثمّ استبدال باسمه.
 *
 * 🔴 الحاجة هنا أشدّ منها في الإعدادات: هذا الملفّ يُعاد كتابته **مع كلّ
 * ضغطة مفتاح** في المحرّر (بتجميعٍ 300 ملّي)، فنافذة القطع مفتوحة باستمرار.
 * قِسته بقتل العملية أثناء الكتابة: **15 من 15** تركت الملفّ مقطوعاً.
 * والمقطوع تقرؤه الدالّة أعلاه، ثمّ يُحفَظ فوقه فيضيع الثيم نهائياً.
 *
 * والارتداد إلى الكتابة المباشرة عند فشل الاستبدال يُبقي السلوك **لا أسوأ
 * ممّا كان** في أضيق الحالات (ملفٌّ يمسكه غيرنا على ويندوز).
 */
function writeCssAtomic(css: string) {
    const tmp = `${QUICK_CSS_PATH}.tmp`;
    try {
        writeFileSync(tmp, css);
        renameSync(tmp, QUICK_CSS_PATH);
    } catch {
        try {
            if (existsSync(tmp)) unlinkSync(tmp);
        } catch { /* لا يمنع المحاولة التالية */ }
        writeFileSync(QUICK_CSS_PATH, css);
    }
}

// مخلَّفٌ من كتابةٍ قُطعت — لا يُقرأ أبداً، لكنّه يبقى في مجلدٍ يفتحه المستخدم.
try {
    const stale = `${QUICK_CSS_PATH}.tmp`;
    if (existsSync(stale)) unlinkSync(stale);
} catch { /* ممسوك الآن — يُستبدَل عند أوّل كتابة */ }

async function listThemes(): Promise<UserThemeHeader[]> {
    const files = await readdir(THEMES_DIR).catch(() => []);

    const themeInfo: UserThemeHeader[] = [];

    for (const fileName of files) {
        if (!fileName.endsWith(".css")) continue;

        const data = await getThemeData(fileName).then(stripBOM).catch(() => null);
        if (data == null) continue;

        themeInfo.push(getThemeInfo(data, fileName));
    }

    return themeInfo;
}

function getThemeData(fileName: string) {
    fileName = fileName.replace(/\?v=\d+$/, "");
    const safePath = ensureSafePath(THEMES_DIR, fileName);
    if (!safePath) return Promise.reject(`Unsafe path ${fileName}`);
    return readFile(safePath, "utf-8");
}

ipcMain.handle(IpcEvents.OPEN_QUICKCSS, () => shell.openPath(QUICK_CSS_PATH));

ipcMain.handle(IpcEvents.OPEN_EXTERNAL, (_, url) => {
    try {
        var { protocol } = new URL(url);
    } catch {
        throw "Malformed URL";
    }
    if (!ALLOWED_PROTOCOLS.includes(protocol))
        throw "Disallowed protocol.";

    shell.openExternal(url)
        .catch(err => console.error("[Vencord] Failed to open external link", url, err));
});

ipcMain.handle(IpcEvents.GET_QUICK_CSS, () => readCss());
ipcMain.handle(IpcEvents.SET_QUICK_CSS, (_, css) => writeCssAtomic(css));

ipcMain.handle(IpcEvents.GET_THEMES_LIST, () => listThemes());
ipcMain.handle(IpcEvents.GET_THEME_DATA, (_, fileName) => getThemeData(fileName));
ipcMain.handle(IpcEvents.DELETE_THEME, (_, fileName) => {
    const safePath = ensureSafePath(THEMES_DIR, fileName);
    if (!safePath) return Promise.reject(`Unsafe path ${fileName}`);
    return unlink(safePath);
});
ipcMain.handle(IpcEvents.GET_THEME_SYSTEM_VALUES, () => {
    let accentColor = systemPreferences.getAccentColor?.() ?? "";

    if (accentColor.length && accentColor[0] !== "#") {
        accentColor = `#${accentColor}`;
    }

    return {
        "os-accent-color": accentColor
    };
});

ipcMain.handle(IpcEvents.OPEN_THEMES_FOLDER, () => shell.openPath(THEMES_DIR));
ipcMain.handle(IpcEvents.OPEN_SETTINGS_FOLDER, () => shell.openPath(SETTINGS_DIR));

let fsWatchers = [] as FSWatcher[];

ipcMain.handle(IpcEvents.INIT_FILE_WATCHERS, ({ sender }) => {
    fsWatchers.forEach(w => w.close());

    let quickCssWatcher: FSWatcher | undefined;
    let rendererCssWatcher: FSWatcher | undefined;

    open(QUICK_CSS_PATH, "a+").then(fd => {
        fd.close();
        /**
         * 🔴 يُراقَب **المجلد** لا الملفّ.
         *
         * الكتابة صارت ذرّية (`.tmp` ثمّ `rename`)، والاستبدال يُنشئ عقدةً
         * جديدة. و`inotify` على لينكس يتعلّق بالعقدة نفسها — فأوّل حفظٍ من
         * المحرّر كان يقتل المراقبة صامتةً، ويتوقّف العرض الحيّ حتى إعادة
         * التشغيل. (ويندوز غير متأثّر: يراقب المجلد الأب أصلاً — مقيس.)
         * مراقبةُ المجلد تنجو من الاستبدال في كل نظام.
         */
        const quickCssName = basename(QUICK_CSS_PATH);
        quickCssWatcher = watch(SETTINGS_DIR, { persistent: false }, debounce(async (_event: string, filename: string | null) => {
            // يجاوره `settings.json` وتُكتب كثيراً — فيُرشَّح بالاسم.
            // (اسمٌ فارغ نادرٌ جداً؛ نقرأ عندها احتياطاً لا إهمالاً.)
            if (filename && filename !== quickCssName) return;

            /**
             * 🔴 مصيدةٌ حول القراءة.
             *
             * `readCss` صارت تُبلّغ بالعطل بدل أن تُعيد فراغاً — وهذه الدالّة
             * غير متزامنة و`debounce` **يُهمل ما تُعيده**، فقفلُ مضادّ
             * فيروسات لجزءٍ من ثانية كان يصير رفضاً غير مُعالَج في **العملية
             * الرئيسية**. ولا يُرسَل فراغ عند الفشل: المُصيِّر يضعه في عنصر
             * النمط فيمحو ثيم المستخدم من الشاشة.
             */
            try {
                sender.postMessage(IpcEvents.QUICK_CSS_UPDATE, await readCss());
            } catch (e) {
                console.error("[Esharq] QuickCSS changed but could not be read — the previous CSS stays applied.", e);
            }
        }, 50));
    }).catch(() => { });

    const themesWatcher = watch(THEMES_DIR, { persistent: false }, debounce(() => {
        sender.postMessage(IpcEvents.THEME_UPDATE, void 0);
    }));

    if (IS_DEV) {
        rendererCssWatcher = watch(RENDERER_CSS_PATH, { persistent: false }, async () => {
            // نفس السبب: رفضٌ غير مُعالَج في العملية الرئيسية عند إعادة بناءٍ
            // يمسك الملفّ لحظة الحدث.
            try {
                sender.postMessage(IpcEvents.RENDERER_CSS_UPDATE, await readFile(RENDERER_CSS_PATH, "utf-8"));
            } catch (e) {
                console.error("[Esharq] renderer CSS changed but could not be read", e);
            }
        });
    }

    fsWatchers = [quickCssWatcher, themesWatcher, rendererCssWatcher].filter(Boolean) as FSWatcher[];

    sender.once("destroyed", () => {
        quickCssWatcher?.close();
        themesWatcher.close();
        rendererCssWatcher?.close();
        fsWatchers = [];
    });
});

ipcMain.on(IpcEvents.GET_MONACO_THEME, e => {
    e.returnValue = nativeTheme.shouldUseDarkColors ? "vs-dark" : "vs-light";
});

let monacoWin: BrowserWindow | null = null;

ipcMain.handle(IpcEvents.OPEN_MONACO_EDITOR, async () => {
    if (monacoWin && !monacoWin.isDestroyed()) {
        monacoWin.show();
        monacoWin.focus();
        return;
    }

    monacoWin = new BrowserWindow({
        title: "Equicord QuickCSS Editor",
        autoHideMenuBar: true,
        darkTheme: true,
        backgroundColor: nativeTheme.shouldUseDarkColors ? "#1e1e1e" : "white",
        webPreferences: {
            preload: join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    monacoWin.once("closed", () => { monacoWin = null; });

    makeLinksOpenExternally(monacoWin);

    await monacoWin.loadURL(`data:text/html;base64,${monacoHtml}`);
});

app.on("before-quit", async event => {
    if (monacoWin && !monacoWin.isDestroyed() && !monacoWin.isVisible()) {
        const result = await dialog.showMessageBox({
            type: "question",
            buttons: ["Cancel", "Close Anyway"],
            defaultId: 0,
            title: "QuickCSS Editor Open",
            message: "QuickCSS editor is still open in the background.",
            detail: "Do you want to close Discord anyway? This will also close the QuickCSS editor."
        });

        if (result.response === 1) {
            app.exit();
        }
    }
});

ipcMain.handle(IpcEvents.GET_RENDERER_CSS, () => readFile(RENDERER_CSS_PATH, "utf-8"));

if (IS_DISCORD_DESKTOP) {
    ipcMain.on(IpcEvents.PRELOAD_GET_RENDERER_JS, e => {
        e.returnValue = readFileSync(join(__dirname, "renderer.js"), "utf-8");
    });
}

ipcMain.on(IpcEvents.SUPPORTS_WINDOWS_MATERIAL, e => {
    e.returnValue = process.platform === "win32" && Number(release().split(".")[2]) >= 22621;
});
