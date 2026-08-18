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

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
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
 * 🔴 ديسكورد يمسك `app.asar` ما دام يعمل، فأي حذف أو إعادة تسمية تفشل
 * بـEPERM. تُترجَم إلى جملة يفهمها القارئ بدل أثر مكدّس خام.
 */
function guarded(action) {
    try {
        action();
    } catch (error) {
        if (error.code === "EPERM" || error.code === "EBUSY") {
            fail("ديسكورد يعمل ويمسك app.asar — أغلقه تماماً ثمّ أعد المحاولة.");
        }
        throw error;
    }
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

    // 🔴 بلا وسائط ⇒ **stable**، لا رسالة خطأ.
    // `pnpm inject` هو الأمر الذي يكتبه كل مستخدم أوّل مرّة، وكان يفشل
    // بـ«حدّد --branch» — فبدا المُثبِّت معطوباً وهو سليم. والفرع المستقرّ
    // هو ما يريده جمهور المستخدمين؛ ومن أراد غيره يمرّره صراحةً.
    const chosen = branch ?? "stable";

    const folder = BRANCHES[chosen];
    if (folder === undefined) fail(`فرع غير معروف: ${chosen} — المتاح: stable | ptb | canary`);

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
/**
 * هل النصّ يحيل إلى حمولتنا؟ يُقارَن بالشكلين لأن `index.js` كود جافاسكربت،
 * فالشرطات المائلة فيه مضاعفة (`C:\\Users\\…`) لا مفردة.
 */
function referencesOurPayload(text) {
    return text.includes(PAYLOAD_DIR) || text.includes(PAYLOAD_DIR.split("\\").join("\\\\"));
}

/**
 * هل `app.asar` القائم تثبيتنا؟
 *
 * 🔴 **شكلان لا شكل واحد**: أرشيفنا الذي نكتبه، **و مجلداً** يتركه مُحدِّث
 * ديسكورد بعد كل تحديث — يفكّ أرشيفنا إلى `app.asar/index.js` و
 * `package.json` **بلا علامتنا** (يُعيد كتابته بنفسه). فالنسخة الأولى كانت
 * تقرأ العلامة وحدها وترفض المجلد، فتقول «مُعدِّل آخر مثبَّت» عن تثبيتنا
 * نفسه — إنذار كاذب يتكرّر مع **كل** تحديث لديسكورد ويمنع إعادة الحقن
 * والتراجع معاً. والدليل الصادق **مسار الحمولة** لا العلامة.
 */
function isOurs() {
    if (!existsSync(APP)) return false;

    if (statSync(APP).isDirectory()) {
        const index = join(APP, "index.js");
        if (!existsSync(index)) return false;
        try {
            return referencesOurPayload(readFileSync(index, "utf8"));
        } catch {
            return false;
        }
    }

    try {
        const raw = readAsarFile(APP, "package.json");
        if (raw !== undefined && JSON.parse(raw.toString("utf8"))[MARKER] !== undefined) return true;
    } catch { /* ليس أرشيفاً نقرأه */ }

    // احتياط: أرشيف بلا علامة لكنه يُحمّل حمولتنا (نسخة أقدم من المُثبِّت).
    try {
        const raw = readAsarFile(APP, "index.js");
        return raw !== undefined && referencesOurPayload(raw.toString("utf8"));
    } catch {
        return false;
    }
}

if (uninstall) {
    if (!isOurs()) fail("app.asar الحالي ليس أرشيفنا — لا نلمس ما لا نملك");
    if (!existsSync(BACKUP)) fail("_app.asar مفقود — لا يمكن التراجع بأمان");

    guarded(() => {
        // المجلد يُحذف تعاوداً؛ `unlinkSync` يفشل عليه بـEPERM/EISDIR.
        rmSync(APP, { recursive: true, force: true });
        renameSync(BACKUP, APP);
    });
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

const indexJs = `// مُولَّد بواسطة إشراق — لا تُحرّره.
require(${JSON.stringify(PAYLOAD)});
`;

const packageJson = JSON.stringify({
    name: "discord",
    main: "index.js",
    [MARKER]: { installedAt: new Date().toISOString() }
}, null, 2);

const bridge = packAsar({ "package.json": packageJson, "index.js": indexJs });

/** هل الجسر القائم يُحمّل نفس الحمولة؟ عندها كتابته من جديد لا تُغيّر شيئاً. */
function bridgeIsCurrent() {
    if (!isOurs()) return false;

    // 🔴 شكل المجلد **ليس مطابقاً** ولو أشار إلى الحمولة نفسها: يجب أن
    // يُستبدَل بأرشيفنا، وإلّا بقي ديسكورد يقرأ ما فكّه مُحدِّثه. وقراءته
    // بـ`readAsarFile` تنفجر بـEISDIR، فيُفحَص النوع أوّلاً.
    if (statSync(APP).isDirectory()) return false;

    try {
        const raw = readAsarFile(APP, "index.js");
        return raw !== undefined && raw.toString("utf8").includes(JSON.stringify(PAYLOAD));
    } catch {
        return false;
    }
}

// إعادة التسمية **مرّة واحدة**: لو كرّرناها على تثبيتنا لصار `_app.asar`
// هو أرشيفنا الصغير وضاع ديسكورد الأصلي نهائياً.
if (!existsSync(BACKUP)) {
    guarded(() => {
        renameSync(APP, BACKUP);
        writeFileSync(APP, bridge);
    });
    console.log("  أُعيد تسمية app.asar ← _app.asar");
} else {
    console.log("  _app.asar موجود سلفاً (إعادة تثبيت) — الأصل محفوظ");

    // الحمولة وحدها هي ما يتغيّر بين بناء وآخر؛ الجسر ثابت ما دام مساره
    // نفسه. فلا نحذف ملفاً ونعيد كتابته بنفس المعنى — كان ذلك يُفشل كل
    // إعادة تثبيت وديسكورد يعمل، بلا أي فائدة مقابل الفشل.
    if (bridgeIsCurrent()) {
        console.log("  الجسر مطابق سلفاً — حُدِّثت الحمولة وحدها");
    } else {
        guarded(() => {
            if (existsSync(APP)) rmSync(APP, { recursive: true, force: true });
            writeFileSync(APP, bridge);
        });
    }
}

console.log(`✔ ثُبِّت إشراق في ${RESOURCES}`);
// يُقال الفرع صراحةً: بلا وسائط يُختار المستقرّ، ومن ظنّ أنه يحقن كناري
// يرى هنا أنه لم يفعل — بدل أن يكتشفه بعد إعادة تشغيل لا تُغيّر شيئاً.
console.log(`  الفرع     : ${branch ?? "stable (افتراضي)"}`);
console.log(`  app.asar  : أرشيفنا (${statSync(APP).size} بايت)`);
console.log(`  _app.asar : ديسكورد الأصلي (${(statSync(BACKUP).size / 1048576).toFixed(2)} MB)`);
console.log(`  الحمولة   : ${PAYLOAD} (${(statSync(PAYLOAD).size / 1048576).toFixed(2)} MB)`);
console.log("\nأعد تشغيل ديسكورد ليسري.");
