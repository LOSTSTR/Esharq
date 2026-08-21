/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * **منشئ الثيمات — الجانب الذي يمسّ القرص.**
 *
 * ثلاثة أشياء لا يستطيع المُصيَّر فعلها بنفسه، ولكلٍّ سببه المقيس:
 *
 * ① **اختيار صورة الخلفية.** حوار النظام يعيش في العملية الرئيسية، وهو الطريق
 *    الوحيد الذي يمنح المستخدم اختياراً صريحاً بلا منح المُصيَّر وصولاً إلى
 *    القرص. فما يُقرأ هو ما أشار إليه صاحبه بإصبعه، لا ما طلبته صفحة.
 *
 * ② **إعادتها كـ`data:`.** قِيس على عميل حيّ يوم 2026-08-21: `file://` **محجوب
 *    في المُصيَّر** — لا `<img>` تُحمّله ولا `fetch` يبلغه. والمخادع أن سطر
 *    الـCSS **يُقبَل نصّاً** ثم لا تُرسَم صورة: خطأٌ لا أثر له في أي سجلّ.
 *    والبديل الآخر — توسيع الـCSP ليقبل `file:` — يفتح على كل الثيمات باباً
 *    إلى قرص صاحبها لأجل ميزةٍ واحدة، فلم يُؤخذ.
 *
 * ③ **حفظ الثيم ملفّاً.** الرفع في `VencordNative.themes` **للويب وحده**؛
 *    ولا يكتمل «منشئ ثيمات» بلا ملفٍّ يخرج منه إلى مجلد الثيمات، يُشارَك
 *    ويبقى بعد إطفاء المنشئ.
 *
 * ولا شيء هنا يتّصل بالشبكة، ولا يخرج بايتٌ من الجهاز.
 */

import { dialog, ipcMain, shell } from "electron";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { extname, join } from "path";

import { IpcEvents } from "../shared/IpcEvents";
import { DATA_DIR, THEMES_DIR } from "./utils/constants";
import { ensureSafePath } from "./utils/ensureSafePath";

/** خلفية المنشئ تسكن مجلّدها الخاصّ، فلا تُحسَب ثيماً ولا تظهر في قائمتها. */
const CREATOR_DIR = join(DATA_DIR, "themeCreator");

/**
 * 12 ميغابايت.
 *
 * الحدّ ليس ذوقاً: الصورة تعبر IPC ثم تسكن الذاكرة نصّاً بالسِتّ والستّين
 * (`data:`)، فتنتفخ نحو الثلث. و12MB صورةً تكفي شاشةً بأربعة آلاف بكسل
 * بفارقٍ واسع، بينما 50MB تعني ~67MB نصّاً مقيماً في كل جلسة.
 */
const MAX_BACKGROUND_BYTES = 12 * 1024 * 1024;

const IMAGE_TYPES: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".bmp": "image/bmp"
};

export interface PickedBackground {
    ok: boolean;
    /** سبب الرفض بمفتاح ثابت تُترجمه الواجهة — لا جملة إنجليزية تُعرَض كما هي. */
    reason?: "cancelled" | "unsupported" | "too-big" | "unreadable";
    name?: string;
    bytes?: number;
    dataUrl?: string;
}

function readAsDataUrl(path: string): PickedBackground {
    const ext = extname(path).toLowerCase();
    const mime = IMAGE_TYPES[ext];
    if (!mime) return { ok: false, reason: "unsupported" };

    let buffer: Buffer;
    try {
        buffer = readFileSync(path);
    } catch {
        return { ok: false, reason: "unreadable" };
    }

    if (buffer.byteLength > MAX_BACKGROUND_BYTES) {
        return { ok: false, reason: "too-big", bytes: buffer.byteLength };
    }

    return {
        ok: true,
        name: path.split(/[/\\]/).pop() ?? "background",
        bytes: buffer.byteLength,
        dataUrl: `data:${mime};base64,${buffer.toString("base64")}`
    };
}

/** نسخةٌ واحدة تبقى: الاختيار الجديد يمحو القديم فلا يتراكم المجلد. */
function storeBackground(sourcePath: string): void {
    mkdirSync(CREATOR_DIR, { recursive: true });
    for (const name of readdirSync(CREATOR_DIR)) {
        if (name.startsWith("background.")) rmSync(join(CREATOR_DIR, name), { force: true });
    }
    writeFileSync(join(CREATOR_DIR, `background${extname(sourcePath).toLowerCase()}`), readFileSync(sourcePath));
}

function storedBackgroundPath(): string | null {
    if (!existsSync(CREATOR_DIR)) return null;
    const name = readdirSync(CREATOR_DIR).find(f => f.startsWith("background."));
    return name ? join(CREATOR_DIR, name) : null;
}

export function registerThemeCreatorIpc() {
    /** يفتح حوار النظام، ويحفظ نسخةً تبقى بعد إغلاق ديسكورد، ويعيد الصورة. */
    ipcMain.handle(IpcEvents.THEME_PICK_BACKGROUND, async () => {
        const result = await dialog.showOpenDialog({
            title: "اختر صورة الخلفية · Choose a background image",
            properties: ["openFile"],
            filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp"] }]
        });

        const path = result.filePaths[0];
        if (result.canceled || !path) return { ok: false, reason: "cancelled" } satisfies PickedBackground;

        const read = readAsDataUrl(path);
        // تُحفَظ النسخة **بعد** نجاح القراءة وحدها: صورةٌ مرفوضة لا تُخزَّن
        // فتعود وحدها عند الإقلاع القادم.
        if (read.ok) {
            try { storeBackground(path); } catch { /* العرض يعمل، والبقاء بعد الإقلاع لا */ }
        }
        return read;
    });

    /** تُقرأ عند الإقلاع لتعود الخلفية كما تركها صاحبها. */
    ipcMain.handle(IpcEvents.THEME_GET_BACKGROUND, () => {
        const path = storedBackgroundPath();
        if (!path) return { ok: false, reason: "cancelled" } satisfies PickedBackground;
        return readAsDataUrl(path);
    });

    ipcMain.handle(IpcEvents.THEME_CLEAR_BACKGROUND, () => {
        const path = storedBackgroundPath();
        if (path) rmSync(path, { force: true });
    });

    /**
     * يكتب الثيم ملفّاً في مجلد الثيمات.
     *
     * 🔴 المسار يُصفّى بـ`ensureSafePath` والاسم يُقصر على الحروف الآمنة: اسمٌ
     * فيه `..` يكتب خارج المجلد. والاسم يأتي من صندوق نصّ يكتبه المستخدم،
     * فهو مُدخَلٌ لا ثابت.
     */
    ipcMain.handle(IpcEvents.THEME_SAVE_CSS, (_, fileName: string, css: string) => {
        const clean = String(fileName)
            .replace(/[/\\]/g, "")
            .replace(/[^\p{L}\p{N}._ -]/gu, "")
            .trim()
            .slice(0, 60);

        if (clean === "" || clean.startsWith(".")) return { ok: false, reason: "bad-name" };

        const withExt = clean.toLowerCase().endsWith(".css") ? clean : `${clean}.css`;
        const safe = ensureSafePath(THEMES_DIR, withExt);
        if (!safe) return { ok: false, reason: "bad-name" };

        try {
            mkdirSync(THEMES_DIR, { recursive: true });
            writeFileSync(safe, css, "utf8");
            return { ok: true, fileName: withExt, path: safe };
        } catch {
            return { ok: false, reason: "write-failed" };
        }
    });

    ipcMain.handle(IpcEvents.THEME_OPEN_FOLDER, () => shell.openPath(THEMES_DIR));
}
