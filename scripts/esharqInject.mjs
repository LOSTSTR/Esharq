/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Esharq contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * مُثبِّت إشراق — **مستقلّ تماماً**، بلا `EquilotlCli` وبلا أي تبعية.
 *
 *   node scripts/esharqInject.mjs --branch canary
 *   node scripts/esharqInject.mjs --branch canary --uninstall
 *   node scripts/esharqInject.mjs --location "<مسار resources>"
 *
 * ## لماذا مُثبِّتنا
 *
 * المُثبِّت الخارجي كان يكتب في ديسكورد سطراً واحداً:
 * `require("%APPDATA%\\Equicord\\equicord.asar")` — أي أن **بصمة التثبيت
 * ومسار الحمولة باسم مشروع آخر**. إشراق نسخة مستقلّة بإشاراتها، فحمولته
 * في `%APPDATA%\Esharq\esharq.asar` ومُثبِّته من عنده.
 *
 * ## الآلية (مُثبَتة عملياً على ديسكورد حديث)
 *
 *     app.asar  →  _app.asar        الأصلي، يُعاد تسميته فقط
 *     app.asar  ←  أرشيف صغير منّا  يُحمّل esharq.asar ثم يُمرّر للأصلي
 *
 * ⚠️ مجلد `resources/app` **لا يعمل**: ديسكورد يتجاهله تماماً — جُرّب حيّاً.
 * ولأن إعادة التسمية أكثر تدخّلاً، فالتراجع شرط: `--uninstall` يُعيد الأصل.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { packAsar, readAsarFile } from "./esharq/asar.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** بصمتنا داخل الأرشيف الصغير — بها نعرف تثبيتنا من تثبيت غيرنا. */
const MARKER = "esharq";

/** مجلدات ديسكورد على ويندوز. */
const BRANCHES = {
    stable: "Discord",
    ptb: "DiscordPTB",
    canary: "DiscordCanary"
};

const args = process.argv.slice(2);
const flag = name => {
    const at = args.indexOf(`--${name}`);
    return at === -1 ? undefined : args[at + 1];
};

const uninstall = args.includes("--uninstall");
const branch = flag("branch");
const location = flag("location");

function fail(message) {
    console.error(`✖ ${message}`);
    process.exit(1);
}

/**
 * أحدث مجلد نسخة — **بمقارنة رقمية لا نصّية**.
 * نصّياً `app-1.0.9999 > app-1.0.10000`، فيُحقَن مجلد قديم ويبدو أن
 * المُثبِّت «لم يفعل شيئاً».
 */
function latestVersionDir(base) {
    const versions = readdirSync(base)
        .filter(name => name.startsWith("app-"))
        .map(name => ({ name, parts: name.slice(4).split(".").map(Number) }))
        .filter(entry => entry.parts.every(Number.isFinite))
        .sort((a, b) => {
            for (let i = 0; i < Math.max(a.parts.length, b.parts.length); i++) {
                const diff = (b.parts[i] ?? 0) - (a.parts[i] ?? 0);
                if (diff !== 0) return diff;
            }
            return 0;
        });

    for (const version of versions) {
        const resources = join(base, version.name, "resources");
        if (existsSync(join(resources, "app.asar"))) return resources;
    }
    return undefined;
}

function resolveResources() {
    if (location !== undefined) return location;
    if (branch === undefined) fail("حدّد --branch [stable|ptb|canary] أو --location <مسار resources>");

    const folder = BRANCHES[branch];
    if (folder === undefined) fail(`فرع غير معروف: ${branch}`);

    if (process.platform !== "win32") {
        fail("هذا المُثبِّت لويندوز. على غيره مرّر --location صراحةً.");
    }

    const base = join(process.env.LOCALAPPDATA, folder);
    if (!existsSync(base)) fail(`لم أجد ${folder} — هل هو مثبَّت؟`);

    const resources = latestVersionDir(base);
    if (resources === undefined) fail(`لم أجد مجلد نسخة صالحاً داخل ${base}`);
    return resources;
}

const RESOURCES = resolveResources();
const APP = join(RESOURCES, "app.asar");
const BACKUP = join(RESOURCES, "_app.asar");

/** حمولتنا: خارج مجلد ديسكورد فلا يمحوها تحديثه. */
const PAYLOAD_DIR = join(process.env.APPDATA ?? process.env.HOME ?? ".", "Esharq");
const PAYLOAD = join(PAYLOAD_DIR, "esharq.asar");

/** هل `app.asar` الحالي أرشيفنا نحن؟ */
function isOurs() {
    if (!existsSync(APP) || statSync(APP).isDirectory()) return false;
    try {
        const raw = readAsarFile(APP, "package.json");
        return raw !== undefined && JSON.parse(raw.toString("utf8"))[MARKER] !== undefined;
    } catch {
        return false;
    }
}

if (uninstall) {
    if (!isOurs()) fail("app.asar الحالي ليس أرشيفنا — لا نلمس ما لا نملك");
    if (!existsSync(BACKUP)) fail("_app.asar مفقود — لا يمكن التراجع بأمان");

    unlinkSync(APP);
    renameSync(BACKUP, APP);
    console.log(`✔ أُلغي التثبيت وأُعيد app.asar الأصلي — ${RESOURCES}`);
    console.log(`  الحمولة باقية في ${PAYLOAD}، احذفها يدوياً إن أردت.`);
    process.exit(0);
}

// ── التثبيت ──────────────────────────────────────────────────────────
const BUILT = join(ROOT, "dist", "desktop.asar");
if (!existsSync(BUILT)) fail("لا يوجد dist/desktop.asar — شغّل `pnpm build` أوّلاً");

// 🔴 تثبيت مُعدِّل آخر: نتوقّف. استبداله يكسر تثبيته ويُلام عليه إشراق.
if (existsSync(BACKUP) && !isOurs()) {
    fail("_app.asar موجود و app.asar ليس أرشيفنا — مُعدِّل آخر مثبَّت. أزله أوّلاً.");
}

mkdirSync(PAYLOAD_DIR, { recursive: true });
copyFileSync(BUILT, PAYLOAD);

// إعادة التسمية **مرّة واحدة**: لو كرّرناها على تثبيتنا لصار `_app.asar`
// هو أرشيفنا الصغير وضاع ديسكورد الأصلي نهائياً.
if (!existsSync(BACKUP)) {
    renameSync(APP, BACKUP);
    console.log("  أُعيد تسمية app.asar ← _app.asar");
} else {
    console.log("  _app.asar موجود سلفاً (إعادة تثبيت) — الأصل محفوظ");
    if (existsSync(APP)) rmSync(APP, { recursive: true, force: true });
}

const indexJs = `// مُولَّد بواسطة إشراق — لا تُحرّره.
require(${JSON.stringify(PAYLOAD)});
`;

const packageJson = JSON.stringify({
    name: "discord",
    main: "index.js",
    [MARKER]: { installedAt: new Date().toISOString() }
}, null, 2);

writeFileSync(APP, packAsar({ "package.json": packageJson, "index.js": indexJs }));

console.log(`✔ ثُبِّت إشراق في ${RESOURCES}`);
console.log(`  app.asar  : أرشيفنا (${statSync(APP).size} بايت)`);
console.log(`  _app.asar : ديسكورد الأصلي (${(statSync(BACKUP).size / 1048576).toFixed(2)} MB)`);
console.log(`  الحمولة   : ${PAYLOAD} (${(statSync(PAYLOAD).size / 1048576).toFixed(2)} MB)`);
console.log("\nأعد تشغيل ديسكورد ليسري.");
