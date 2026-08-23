/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * **إضافات المجتمع** — يستورد العضو مجلد إضافة من جهازه فتعمل بعد إعادة
 * التشغيل، بلا بناء وبلا أدوات مطوّرين.
 *
 * ## 🔴 حدود المسؤولية — وهي حدود مكتوبة في الكود لا في نصّ تسويقيّ
 *
 * إشراق مسؤول عن **أن تعمل هذه الميزة**: أن يُقرأ المجلد، ويُحوَّل، ويُحمَّل في
 * الوقت الصحيح، وأن يُفعَّل ويُعطَّل ويُحذَف. **ولا علاقة له بالإضافة نفسها**:
 * لا يكتبها ولا يُراجعها ولا يُحدّثها ولا يُصلحها، ولا يتحمّل ما تفعله.
 *
 * ## ولا تغادر جهاز صاحبها — بالبناء لا بالوعد
 *
 * 1. **لا شبكة في هذا الملفّ إطلاقاً**: لا `fetch` ولا `http` ولا تنزيل ولا
 *    رفع. المصدر الوحيد مجلدٌ يختاره المستخدم بنفسه من قرصه.
 * 2. **تُخزَّن ملفّاتٍ على القرص، لا في الإعدادات ولا في `DataStore`.** وهذا
 *    مقصود: `exportSettings` يُصدّر `settings` و`quickCss` و`DataStore` —
 *    فلو سكن المصدر أياً منها لسافر مع أول نسخة احتياطية أو مزامنة سحابية.
 *    وهو خارجها كلّها، فلا يُصدَّر ولا يُزامَن ولا يُشارَك.
 * 3. **لا يُشحن مع إشراق**: المجلد يُنشأ عند أوّل استيراد على جهاز صاحبه، ولا
 *    وجود له في الحزمة التي تصل الناس.
 */

import { DATA_DIR } from "@main/utils/constants";
import { IpcEvents } from "@shared/IpcEvents";
import { createHash } from "crypto";
import { dialog, ipcMain, shell } from "electron";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { basename, join, relative, sep } from "path";
import { transform } from "sucrase";

import { type Finding, LIMITS, validate } from "./validate";

const COMMUNITY_DIR = join(DATA_DIR, "community");

/** ما تراه الواجهة عن كل إضافة مستورَدة. */
export interface CommunityEntry {
    id: string;
    /** اسم المجلد كما اختاره صاحب الإضافة — نعرضه كما هو. */
    folderName: string;
    /** الاسم المُعلَن داخل `definePlugin` إن قُرئ، وإلّا فاسم المجلد. */
    name: string;
    description: string;
    authors: string[];
    enabled: boolean;
    importedAt: string;
    /** بصمة المصدر — تتغيّر إن غُيّر حرف واحد. */
    hash: string;
    fileCount: number;
    bytes: number;
    /** مسار المصدر على القرص، ليفتحه المستخدم ويقرأه بعينه. */
    sourcePath: string;
    /** خطأ منع التحميل آخر مرّة، إن وقع. */
    loadError?: string;
    /**
     * الوحدات الخارجية التي تطلبها الإضافة (بعد الترجمة، فالأنواع محذوفة).
     *
     * تُحسَب هنا لأنّ الشيفرة المُترجَمة هنا، ويُحكَم عليها في المُصيِّر حيث
     * تسكن الخريطة — فيرى المستخدم **قبل التفعيل** ما سيعمل وما لن يعمل، بدل
     * أن يكتشفه خطأً أحمر بعد إعادة التشغيل.
     */
    externals: string[];
    /**
     * الأسماء المطلوبة من كل وحدة خارجية — `{ "@api/HeaderBar": ["toggleCompactMode", …] }`.
     *
     * 🔴 لماذا لا تكفي أسماء الوحدات: `checkCompatibility` كان يحكم على
     * **الوحدة** وحدها. فإضافةٌ تكتب
     * `import { TestcordDevs } from "@utils/constants"` تُحلّ بنجاح — الوحدة
     * عندنا — ثمّ تسقط وقت التشغيل لأن الاسم ليس فيها. تقريرٌ يقول «سليمة»
     * وإضافةٌ لا تعمل: أسوأ من عطلٍ صريح. قِيس على ٥١٥ مجلداً حقيقياً:
     * الحالة تتكرّر في مئاتٍ منها، وتقريرنا صامت عنها.
     *
     * تُستخرج من **المصدر قبل الترجمة** لا من ناتجها: صيغة `import` معلومة
     * وثابتة، بينما أسماء المتغيّرات التي يُولّدها المُترجِم تفصيلٌ داخليّ.
     */
    importedNames?: Record<string, string[]>;
}

interface Manifest extends Omit<CommunityEntry, "sourcePath"> {
    /** الملفّات المُحوَّلة بترتيب تحميلها؛ المدخل آخرها. */
    build: string[];
}

function ensureDir() {
    mkdirSync(COMMUNITY_DIR, { recursive: true });
}

function manifestPath(id: string) {
    return join(COMMUNITY_DIR, id, "manifest.json");
}

function readManifest(id: string): Manifest | null {
    try {
        return JSON.parse(readFileSync(manifestPath(id), "utf8"));
    } catch {
        return null;
    }
}

function writeManifest(m: Manifest) {
    writeFileSync(manifestPath(m.id), JSON.stringify(m, null, 4), "utf8");
}

/**
 * 🔴 المعرّف يُشتقّ من **البصمة** لا من اسم المجلد.
 *
 * فمجلدان اسمهما `index` لا يدوس أحدهما الآخر، واستيراد النسخة نفسها مرّتين
 * لا يُنشئ نسختين.
 */
function idFor(hash: string) {
    return hash.slice(0, 16);
}

// ── قراءة المجلد ─────────────────────────────────────────────────────────────

/** مجلدات لا معنى لقراءتها، ووجودها لا يمنع الاستيراد. */
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "build", ".vscode", ".idea"]);

function collect(root: string): { path: string; bytes: Uint8Array; }[] {
    const out: { path: string; bytes: Uint8Array; }[] = [];

    const walk = (dir: string, depth: number) => {
        if (depth > 6 || out.length > LIMITS.files * 4) return;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.name.startsWith(".") && entry.isDirectory()) continue;
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
                if (SKIP_DIRS.has(entry.name)) continue;
                walk(full, depth + 1);
            } else if (entry.isFile()) {
                // الرابط الرمزيّ لا يُتبَع: قد يشير خارج المجلد المُختار.
                if (entry.isSymbolicLink?.()) continue;
                if (statSync(full).size > LIMITS.fileBytes * 4) continue;
                out.push({ path: relative(root, full).split(sep).join("/"), bytes: readFileSync(full) });
            }
        }
    };

    walk(root, 0);
    return out;
}

// ── التحويل ──────────────────────────────────────────────────────────────────

/**
 * TypeScript وJSX ⇒ جافاسكربت، **مرّة واحدة وقت الاستيراد**.
 *
 * والاستيرادات تُحوَّل إلى `require` كي يُمرَّر لها جسرُنا وقت التحميل. وهذا
 * ليس تفصيلاً: بهذه الصيغة يعرف المُحوِّل أي الأسماء **أنواعٌ** فيحذفها —
 * ومن دونها يبقى الاسم مستورَداً ومُعرَّفاً معاً فينكسر الملفّ. قِسته على 900
 * ملفّ حقيقي: 900/900 بهذه الصيغة، مقابل 898 بدونها.
 */
function transpile(path: string, text: string): { code: string; } | { error: Finding; } {
    try {
        const { code } = transform(text, {
            transforms: ["typescript", "jsx", "imports"],
            jsxRuntime: "classic",
            jsxPragma: "React.createElement",
            jsxFragmentPragma: "React.Fragment",
            production: true,
            filePath: path
        });
        return { code };
    } catch (e: any) {
        // سُكريس يضع الموضع في الرسالة؛ نستخرج رقم السطر ليصل المستخدم مفيداً.
        const message = String(e?.message ?? e);
        const line = /\((\d+):\d+\)/.exec(message)?.[1];
        return {
            error: {
                severity: "error",
                rule: "syntax",
                file: path,
                line: line ? Number(line) : undefined,
                message: message.replace(/^Error: /, ""),
                hint: "أصلح الخطأ النحويّ في المصدر ثم أعد الاستيراد."
            }
        };
    }
}

/** قراءة الاسم والوصف من `definePlugin` — عرضٌ فقط، وفشلها لا يمنع شيئاً. */
function readMeta(code: string) {
    // 🔴 حدّ الكلمة ليس تجميلاً: بلا `(?<![\\w$])` تُطابق `name:` **داخل**
    // `username:`، فقُرئ اسم الإضافة «Unknown User» من سطرٍ وسط الشيفرة
    // (`username: "Unknown User"`) بدل «FakeDM» من `definePlugin`. رأيتُه.
    const pick = (key: string) => new RegExp(`(?<![\\w$])${key}\\s*:\\s*["'\`]([^"'\`]{1,120})["'\`]`).exec(code)?.[1];
    const authors = [...code.matchAll(/name\s*:\s*["']([^"']{1,60})["']\s*,\s*id\s*:/g)].map(m => m[1]);
    return { name: pick("name"), description: pick("description"), authors };
}

// ── الاستيراد ────────────────────────────────────────────────────────────────

export interface ImportResult {
    ok: boolean;
    /** ألغى المستخدم نافذة الاختيار. */
    cancelled?: boolean;
    entry?: CommunityEntry;
    findings: Finding[];
}

export async function pickAndImport(): Promise<ImportResult> {
    const picked = await dialog.showOpenDialog({
        title: "اختر مجلد الإضافة",
        properties: ["openDirectory"]
    });
    if (picked.canceled || picked.filePaths.length === 0) return { ok: false, cancelled: true, findings: [] };

    return importFolder(picked.filePaths[0]);
}

/**
 * لاحقة `?managed` على استيراد CSS.
 *
 * ── ما هي ────────────────────────────────────────────────────────────
 * `import style from "./style.css?managed"` — صيغةُ عائلة Vencord: البناء
 * يُحوّلها إلى وحدةٍ تُسجّل الورقة في `window.VencordStyles` وتُصدّر **اسمها
 * نصّاً**، ثمّ تستعملها الإضافة `managedStyle: style` ليُشغّلها المُدير عند
 * البدء ويُطفئها عند التوقّف.
 *
 * ── لماذا تسقط عندنا ─────────────────────────────────────────────────
 * إضافة المجتمع تُترجَم بـsucrase وحدها، بلا إضافة esbuild التي تفهم
 * اللاحقة. فيصل المُحدِّد إلى المُحمِّل كما هو ولا يُطابق ملفّاً:
 * «لا يوجد ملفّ لـ‹./style.css?managed›». وهي **لا تظهر في تقرير التوافق
 * أصلاً** لأنّها وارد داخليّ لا يخرج من المجلّد — فالإضافة تبدو سليمة تماماً
 * ثمّ لا تعمل. قِيس: ‏٣١ مجلداً من ‏٥١٥، ‏٢٥ منها لا عائق فيها سواها.
 *
 * ── لماذا لا يكفي حذف اللاحقة ────────────────────────────────────────
 * 🔴 لو صارت `./style.css` لأعادت وحدةُ CSS العادية `module.exports = {}`،
 * فيُنادى `enableStyle({})` ويرمي `Style "[object Object]" does not exist`.
 * فالحلّ أن تُصنَع وحدةٌ ثانية تُسجّل الورقة وتُصدّر اسمها — نسخةً حرفية من
 * `scripts/build/module/style.js`، وهو ما يُنتجه بناؤنا نفسه.
 *
 * والمسار يحمل `.managed` لا `?managed`: علامة الاستفهام محرفٌ ممنوع في
 * أسماء ملفّات ويندوز.
 */
const MANAGED_CSS = /require\((["'])((?:\.{1,2}\/)[^"']*\.css)\?managed\1\)/g;

/** اسم الورقة كما سيراه `enableStyle` — مشتقٌّ من الإضافة ومسارها فلا يتصادم. */
const managedStyleName = (id: string, rel: string) => `community/${id}/${rel}`;

/**
 * الأسماء التي تطلبها الإضافة من كل وحدة — من **الناتج المُترجَم**.
 *
 * 🔴 ولا تُقرأ من المصدر: `import { ChatBarButtonFactory }` قد يكون **نوعاً**
 * لا قيمة، ولا فرق في الصيغة. والمُترجِم يمحو الأنواع، فما بقي في الناتج هو
 * ما تستعمله الإضافة فعلاً وقت التشغيل. قِسته: القراءة من المصدر أنذرت
 * كاذبةً على `ChatBarButtonFactory` و`ModalProps` و`NavContextMenuPatchCallback`.
 *
 * تُقرأ من **الناتج المُترجَم** لا من المصدر:
 *   `import { a, b as c } from "m"`  ⇒ a, b
 *   `import d from "m"`              ⇒ default
 *   `import * as ns from "m"`        ⇒ لا شيء (فضاء الأسماء كلّه، لا اسم بعينه)
 *
 * ولا يُفحَص إلّا ما في المصدر: `require` الديناميّ أو الوصول بمفتاحٍ محسوب
 * لا يُرى هنا، ويُقال ذلك بدل ادّعاء الإحاطة.
 */
function importedNamesOf(built: readonly { path: string; code: string; }[]): Record<string, string[]> {
    const out: Record<string, Set<string>> = {};

    for (const b of built) {
        // sucrase تُخرج: var _x = require('m')  ثمّ الوصول `_x.name`.
        const binds = new Map<string, string>();
        for (const m of b.code.matchAll(/var\s+(_[A-Za-z0-9$_]*)\s*=\s*require\(["']([^"']+)["']\)/g)) {
            binds.set(m[1], m[2]);
        }
        if (binds.size === 0) continue;

        // تعبيرٌ **حرفيّ ثابت**: يلتقط كل `_شيء.اسم`، ثمّ يُرشَّح بالجدول.
        // (البناء الديناميّ يحتاج هروباً داخل نصّ، وهو مصدر أخطاء صامتة.)
        for (const m of b.code.matchAll(/(?<![A-Za-z0-9$_])(_[A-Za-z0-9$_]*)\.([A-Za-z_$][A-Za-z0-9_$]*)/g)) {
            const spec = binds.get(m[1]);
            if (spec === undefined) continue;
            const name = m[2];
            // `default` و`__esModule` من عمل المُترجِم لا من طلب الإضافة.
            if (name === "default" || name === "__esModule") continue;
            (out[spec] ??= new Set()).add(name);
        }
    }
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]));
}

export function importFolder(root: string, keepFolderName?: string): ImportResult {
    ensureDir();

    let raw: { path: string; bytes: Uint8Array; }[];
    try {
        raw = collect(root);
    } catch (e: any) {
        return { ok: false, findings: [{ severity: "error", rule: "unreadable", message: `تعذّرت قراءة المجلد: ${e?.message ?? e}` }] };
    }

    // ما لا يُعنينا لا يُحسَب على المستخدم: نتجاهل الملفّات غير المرشَّحة
    // (README، صور…) بدل رفض المجلد كلّه بسببها.
    const candidates = raw.filter(f => /\.(tsx?|jsx?|css|json)$/i.test(f.path));
    const result = validate(candidates);
    if (!result.ok) return { ok: false, findings: result.findings };

    const findings = [...result.findings];

    // البصمة على **المصدر كما هو**، مرتّباً، فلا تتغيّر بترتيب القراءة.
    const hash = createHash("sha256");
    for (const f of [...result.accepted].sort((a, b) => a.path.localeCompare(b.path))) {
        hash.update(f.path);
        hash.update("\0");
        hash.update(f.text);
        hash.update("\0");
    }
    const digest = hash.digest("hex");
    const id = idFor(digest);
    const dir = join(COMMUNITY_DIR, id);

    // إعادة استيراد النسخة نفسها: نُبقي حالة التفعيل ولا نُكرّر المدخل.
    const previous = readManifest(id);

    const built: { path: string; code: string; }[] = [];
    for (const f of result.accepted) {
        // 🔴 CSS تدخل الحزمة **وحدةً تُحقن**، ولا تُتخطّى.
        //
        // كانت تُقبَل في التحقّق وتُحفظ في `source/` ثمّ يتخطّاها البناء، فلا
        // تصل الواجهة أصلاً و`import "./style.css"` يفشل بـ«لا يوجد ملفّ» —
        // وهي أوّل ما يكتبه من يصنع إضافةً لها مظهر، فالمجلّد النموذجيّ
        // `index.tsx` + `components/` + `util/` + `style.css`.
        //
        // تُترجَم إلى شيفرة تُنشئ `<style>` مرّةً واحدة بمعرّف مشتقّ من مسارها،
        // فإعادة التحميل لا تُكرّرها. والنصّ يمرّ بـ`JSON.stringify` فلا يكسره
        // اقتباسٌ ولا سطرٌ جديد.
        if (!f.code) {
            // JSON وحدةٌ تُصدّر بياناتها. مقبولة في التحقّق لكنّها ليست «شيفرة»،
            // فكانت تُتخطّى مثل CSS و`import data from "./x.json"` يفشل.
            // تُتحقَّق صحّتها هنا: ملفّ تالف يُرفَض عند الاستيراد لا وقت التشغيل.
            if (/\.json$/i.test(f.path)) {
                try {
                    JSON.parse(f.text);
                } catch (e: any) {
                    // 🔴 **تنبيهٌ لا رفض**: كنتُ أرفض المجلد كلّه، فمجلدٌ فيه
                    // `tsconfig.json` بتعليقات `//` — وهو قالب TypeScript
                    // الافتراضيّ — يُرفَض استيراده كلّه بسبب ملفٍّ لا تستورده
                    // الإضافة أصلاً. الملفّ يُتخطّى وحده، ومن استورده فعلاً
                    // يراه ناقصاً في تقرير التوافق.
                    findings.push({
                        severity: "warning", rule: "syntax", file: f.path,
                        message: `JSON غير صالح — تُخطّي هذا الملفّ: ${e?.message ?? e}`,
                        hint: "إن كانت الإضافة تستورده فأصلحه ثمّ أعد الاستيراد."
                    });
                    continue;
                }
                built.push({ path: f.path, code: `module.exports = ${f.text};` });
                continue;
            }
            if (!/\.css$/i.test(f.path)) continue;
            const styleId = `esharq-community-${id}-${f.path.replace(/[^a-z0-9]+/gi, "-")}`;
            built.push({
                path: f.path,
                code: [
                    `const __id = ${JSON.stringify(styleId)};`,
                    "let __el = document.getElementById(__id);",
                    "if (__el === null) {",
                    "    __el = document.createElement('style');",
                    "    __el.id = __id;",
                    // 🔴 `document.head` **عدمٌ هنا**، وهذا ليس احتياطاً نظرياً:
                    // `loadCommunityPlugins` تُنفَّذ في تمهيد المُصيِّر قبل
                    // `DOMContentLoaded` (Vencord.ts) عمداً — لتُسجَّل الرقع قبل
                    // إقلاع webpack. فالإلحاق المباشر يرمي «Cannot read
                    // properties of null (reading 'appendChild')» وتسقط الإضافة
                    // كلّها عند أوّل `import \"./style.css\"`. رآه مستخدم فعليّ.
                    "    const __attach = () => (document.head || document.documentElement).appendChild(__el);",
                    "    if (document.head || document.documentElement) __attach();",
                    "    else document.addEventListener('DOMContentLoaded', __attach, { once: true });",
                    "}",
                    `__el.textContent = ${JSON.stringify(f.text)};`,
                    "module.exports = {};"
                ].join("\n")
            });
            continue;
        }
        const out = transpile(f.path, f.text);
        if ("error" in out) return { ok: false, findings: [...findings, out.error] };
        built.push({ path: f.path.replace(/\.(tsx?|jsx?)$/i, ".js"), code: out.code });
    }

    /**
     * المدخل آخر ما يُنفَّذ، والمُصيِّر يقرؤه بـ`modules.at(-1)`.
     *
     * 🔴 «آخر ملفّ» لم يعد يعني «آخر ملفّ **شيفرة**»: منذ صارت CSS وJSON
     * وحدتين تدخلان `built`، صار مجلدٌ اسم مدخله `plugin.tsx` بجواره
     * `style.css` يُرتَّب [plugin.js, style.css] — فلا يُطابق `^index\.js$`،
     * ولا يُعاد ترتيبه، فيصير **ملفّ الأنماط** هو المدخل. النتيجة: الإضافة
     * تسقط برسالة «الملفّ لا يُصدّر إضافة» تتّهم صاحبها، وبطاقتها تُعرَض بلا
     * وصف. والتحقّق يُجيز صراحةً ملفَّ شيفرةٍ وحيداً **بأيّ اسم** مدخلاً
     * (`validate.ts`)، فالحالة مشروعة لا شاذّة.
     *
     * فيُنتقى آخر ملفّ **شيفرة**: `index.js` إن وُجد، وإلّا آخر `.js`.
     */
    const isCodeModule = (path: string) => /\.js$/i.test(path);

    /**
     * ── إصلاح `?managed` ─────────────────────────────────────────────────
     * يقع **بعد** بناء الوحدات وقبل انتقاء المدخل، فلا يمسّ المصدر ولا
     * البصمة: المعرّف يبقى كما هو، وحالة التفعيل لا تضيع، و`source/` يبقى
     * أصلاً سليماً يُبنى منه ثانيةً متى شئنا.
     */
    const managedFixes: { file: string; specifier: string; to: string; }[] = [];
    const cssTextByPath = new Map(result.accepted.filter(f => /\.css$/i.test(f.path)).map(f => [f.path, f.text]));

    for (const b of built) {
        if (!isCodeModule(b.path)) continue;
        const rewritten = b.code.replace(MANAGED_CSS, (whole, q: string, rel: string) => {
            // مسارٌ مُطلَق داخل الحزمة، لنعرف أيّ ملفّ CSS يُقصَد.
            const parts = b.path.split("/").slice(0, -1);
            for (const piece of rel.split("/")) {
                if (piece === "." || piece === "") continue;
                if (piece === "..") parts.pop();
                else parts.push(piece);
            }
            const target = parts.join("/");
            // لا يُصلَح ما لا نملك نصّه: يُترَك كما هو ليُقال في التقرير.
            if (!cssTextByPath.has(target)) return whole;
            managedFixes.push({ file: b.path, specifier: `${rel}?managed`, to: `${rel}.managed` });
            return `require(${q}${rel}.managed${q})`;
        });
        if (rewritten !== b.code) b.code = rewritten;
    }

    // وحدةُ نمطٍ لكل ورقةٍ طُلبت بـ`?managed` — نسخةٌ حرفية من
    // `scripts/build/module/style.js`، وهو ما يُنتجه بناؤنا لإضافاتنا.
    for (const rel of new Set(managedFixes.map(f => {
        const parts = f.file.split("/").slice(0, -1);
        for (const piece of f.specifier.replace(/\?managed$/, "").split("/")) {
            if (piece === "." || piece === "") continue;
            if (piece === "..") parts.pop();
            else parts.push(piece);
        }
        return parts.join("/");
    }))) {
        const name = managedStyleName(id, rel);
        built.push({
            path: `${rel}.managed`,
            code: [
                `const __name = ${JSON.stringify(name)};`,
                "(window.VencordStyles ??= new Map()).set(__name, {",
                "    name: __name,",
                `    source: ${JSON.stringify(cssTextByPath.get(rel) ?? "")},`,
                "    classNames: {},",
                "    dom: null",
                "});",
                "module.exports = __name;"
            ].join(String.fromCharCode(10))
        });
    }

    if (managedFixes.length > 0) {
        findings.push({
            severity: "warning", rule: "fix:managed-css",
            message: `بُدّلت ${managedFixes.length} إشارة «?managed» بوحدة نمطٍ مُدارة — ${managedFixes.map(f => f.specifier).join(" · ")}`,
            hint: "لاحقةٌ تفهمها أدوات بناء الشوكات ولا يفهمها المُترجِم وحده. النسخة المُدارة وحدها عُدّلت؛ مجلدك لم يُمَسّ."
        });
    }

    let entryIndex = built.findIndex(b => /^index\.js$/.test(b.path));
    if (entryIndex === -1) {
        /**
         * 🔴 «آخر ملفّ كود» تخمينٌ يُخطئ حين لا يكون المدخل آخر ما يُقرأ.
         *
         * والدليل في الشيفرة نفسها: `export default definePlugin` لا يكتبه
         * إلّا المدخل — وهو ما استدلّ به الفاحص لقبول المجلد أصلاً
         * (`fix:entry`). فلو اختار البناء ملفّاً غيره، قُبل المجلد ثمّ سقط
         * بـ«الملفّ لا يُصدّر إضافة» — تناقضٌ بين خطوتين في مسارٍ واحد.
         */
        const marked = built.findIndex(b =>
            isCodeModule(b.path) && /exports\s*\.\s*default\s*=/.test(b.code));
        if (marked !== -1) entryIndex = marked;
    }
    if (entryIndex === -1) {
        for (let i = built.length - 1; i >= 0; i--) {
            if (isCodeModule(built[i].path)) { entryIndex = i; break; }
        }
    }
    if (entryIndex !== -1) built.push(...built.splice(entryIndex, 1));

    try {
        rmSync(join(dir, "source"), { recursive: true, force: true });
        rmSync(join(dir, "build"), { recursive: true, force: true });
        mkdirSync(join(dir, "source"), { recursive: true });
        mkdirSync(join(dir, "build"), { recursive: true });

        for (const f of result.accepted) {
            const dest = join(dir, "source", f.path);
            mkdirSync(join(dest, ".."), { recursive: true });
            writeFileSync(dest, f.text, "utf8");
        }
        for (const b of built) {
            const dest = join(dir, "build", b.path);
            mkdirSync(join(dest, ".."), { recursive: true });
            writeFileSync(dest, b.code, "utf8");
        }
    } catch (e: any) {
        return { ok: false, findings: [...findings, { severity: "error", rule: "write-failed", message: `تعذّرت الكتابة: ${e?.message ?? e}` }] };
    }

    // كلّ استيراد صار `require("...")` بعد الترجمة، فاستخراجها نصّياً دقيق
    // هنا — لا تخمين: ما لا يبدأ بنقطة فهو خارج الإضافة.
    const rawSpecifiers = [...new Set(
        built.flatMap(b => [...b.code.matchAll(/require\(["']([^"']+)["']\)/g)].map(m => m[1]))
    )];

    // 🔴 النسبيّ الذي **يخرج** من المجلّد يُحسَب خارجياً هو الآخر: ملفّه ليس
    // في الحزمة ولن يكون، فحاله حال وحدةٍ خارجية تماماً — وإخفاؤه عن التقرير
    // يجعل الإضافة تبدو سليمةً ثمّ تسقط عند التشغيل.
    const escapes = (spec: string) => {
        if (!spec.startsWith(".")) return false;
        let depth = 0;
        for (const piece of spec.split("/")) {
            if (piece === "..") depth--;
            else if (piece !== "." && piece !== "") depth++;
            if (depth < 0) return true;
        }
        return false;
    };

    const externals = [...new Set(rawSpecifiers.filter(s => !s.startsWith(".") || escapes(s)))].sort();

    const entryCode = built.at(-1)?.code ?? "";
    const meta = readMeta(entryCode);
    // عند إعادة الفحص يكون الجذر هو `<id>/source`، واسمه ليس اسم مجلد صاحبه.
    const folderName = keepFolderName ?? (basename(root) || "plugin");

    const manifest: Manifest = {
        id,
        folderName,
        name: meta.name ?? folderName,
        description: meta.description ?? "",
        authors: meta.authors,
        // 🔴 لا تُفعَّل من تلقاء نفسها: الاستيراد ليس موافقةً على التشغيل.
        enabled: previous?.enabled ?? false,
        importedAt: new Date().toISOString(),
        hash: digest,
        fileCount: result.accepted.length,
        bytes: result.accepted.reduce((n, f) => n + f.text.length, 0),
        build: built.map(b => b.path),
        externals,
        // يُحفَظ ما يخصّ الخارجيّ وحده: الداخليّ يُحلّ من الحزمة نفسها.
        importedNames: Object.fromEntries(
            Object.entries(importedNamesOf(built)).filter(([spec]) => externals.includes(spec))
        )
    };
    writeManifest(manifest);

    return { ok: true, findings, entry: toEntry(manifest) };
}

function toEntry(m: Manifest): CommunityEntry {
    const { build, ...rest } = m;
    // `externals` أُضيف بعد أن صار للناس إضافاتٌ مستورَدة، وبياناتها على القرص
    // لا تحمله. بلا هذا الافتراضي يُقرأ `.length` من `undefined` في الواجهة.
    return { ...rest, externals: m.externals ?? [], sourcePath: join(COMMUNITY_DIR, m.id, "source") };
}

// ── القراءة والإدارة ─────────────────────────────────────────────────────────

/**
 * إعادة فحصٍ وإصلاح لإضافةٍ مستورَدة سلفاً — **من نسختها المحفوظة**.
 *
 * ── لماذا تلزم ────────────────────────────────────────────────────────
 * ما استُورد قبل أن يتعلّم المُحرِّك شيئاً جديداً يبقى على حاله: حزمته
 * المبنيّة قديمة، ولا يحمل جرد الأسماء المطلوبة فلا يُفحَص فحصاً كاملاً.
 * وكل تحديثٍ لإشراق يُضيف وحدةً إلى الخريطة يجعل إضافاتٍ كانت تسقط قابلةً
 * للعمل — بلا أن يعرف صاحبها.
 *
 * ── لماذا من `source/` لا من مجلد المستخدم ───────────────────────────
 * 🔴 مسار المجلد الذي اختاره **لا يُحفَظ أصلاً** (اسمه وحده يُحفَظ)، وقد
 * يكون نُقل أو حُذف. و`source/` نسخةٌ حرفية ممّا استُورد، فالبصمة المحسوبة
 * منها **مطابقة** ⇒ المعرّف نفسه ⇒ لا بطاقة ثانية، ولا حالة تفعيلٍ تضيع،
 * والمجلد نفسه يُعاد بناؤه في مكانه.
 *
 * ولا يُكتب حرفٌ في مجلد صاحبها: يُقرأ `source/` ويُكتب `build/`.
 */
export function rescan(id: string): ImportResult {
    if (!/^[0-9a-f]{16}$/.test(id)) {
        return { ok: false, findings: [{ severity: "error", rule: "bad-id", message: "معرّفٌ غير صالح." }] };
    }
    const previous = readManifest(id);
    if (previous === null) {
        return { ok: false, findings: [{ severity: "error", rule: "missing", message: "لا بيان لهذه الإضافة — أعد استيرادها من مجلدها." }] };
    }
    const sourceDir = join(COMMUNITY_DIR, id, "source");
    if (!existsSync(sourceDir)) {
        return { ok: false, findings: [{ severity: "error", rule: "missing", message: "نسخة المصدر المحفوظة غير موجودة — أعد استيرادها من مجلدها." }] };
    }
    return importFolder(sourceDir, previous.folderName);
}

export function list(): CommunityEntry[] {
    if (!existsSync(COMMUNITY_DIR)) return [];
    const out: CommunityEntry[] = [];
    for (const name of readdirSync(COMMUNITY_DIR)) {
        const m = readManifest(name);
        if (m !== null) out.push(toEntry(m));
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function setEnabled(id: string, enabled: boolean): boolean {
    const m = readManifest(id);
    if (m === null) return false;
    m.enabled = enabled;
    writeManifest(m);
    return true;
}

export function remove(id: string): boolean {
    const dir = join(COMMUNITY_DIR, id);
    // 🔴 لا نحذف مساراً لم نبنِه نحن: `id` يأتي من الواجهة.
    if (!/^[0-9a-f]{16}$/.test(id) || !existsSync(manifestPath(id))) return false;
    rmSync(dir, { recursive: true, force: true });
    return true;
}

export function readSource(id: string): { path: string; text: string; }[] {
    const m = readManifest(id);
    if (m === null) return [];
    const base = join(COMMUNITY_DIR, id, "source");
    const out: { path: string; text: string; }[] = [];
    const walk = (dir: string) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else out.push({ path: relative(base, full).split(sep).join("/"), text: readFileSync(full, "utf8") });
        }
    };
    try { walk(base); } catch { /* حُذف المجلد من تحتنا */ }
    return out;
}

export function openFolder(id: string) {
    const dir = join(COMMUNITY_DIR, id, "source");
    if (existsSync(dir)) shell.openPath(dir);
}

// ── الحزمة التي يقرؤها المُصيِّر ───────────────────────────────────────────────

export interface BundledPlugin {
    id: string;
    name: string;
    hash: string;
    /** الملفّات المُحوَّلة: المسار ⇒ الكود. المدخل آخرها. */
    modules: { path: string; code: string; }[];
}

/**
 * تُقرأ **متزامنةً** في تمهيد المُصيِّر، قبل أن يُقلع webpack عند ديسكورد —
 * وإلّا سُجّلت رقع الإضافة بعد أن تكون الوحدات قد حُمّلت، فلا تُطابق شيئاً.
 */
export function getBundle(): BundledPlugin[] {
    const out: BundledPlugin[] = [];
    for (const entry of list()) {
        if (!entry.enabled) continue;
        const m = readManifest(entry.id);
        if (m === null) continue;
        const modules: { path: string; code: string; }[] = [];
        try {
            for (const rel of m.build) {
                modules.push({ path: rel, code: readFileSync(join(COMMUNITY_DIR, m.id, "build", rel), "utf8") });
            }
        } catch {
            continue; // لقطة ناقصة ⇒ تُتخطّى بصمت ولا تُسقط الإقلاع
        }
        out.push({ id: m.id, name: m.name, hash: m.hash, modules });
    }
    return out;
}

export function registerCommunityPluginIpc() {
    ipcMain.handle(IpcEvents.COMMUNITY_LIST, () => list());
    ipcMain.handle(IpcEvents.COMMUNITY_PICK_AND_IMPORT, () => pickAndImport());
    ipcMain.handle(IpcEvents.COMMUNITY_REMOVE, (_e, id: string) => remove(id));
    ipcMain.handle(IpcEvents.COMMUNITY_SET_ENABLED, (_e, id: string, enabled: boolean) => setEnabled(id, enabled));
    ipcMain.handle(IpcEvents.COMMUNITY_OPEN_FOLDER, (_e, id: string) => openFolder(id));
    ipcMain.handle(IpcEvents.COMMUNITY_READ_SOURCE, (_e, id: string) => readSource(id));
    ipcMain.handle(IpcEvents.COMMUNITY_RESCAN, (_e, id: string) => rescan(id));

    ipcMain.on(IpcEvents.COMMUNITY_GET_BUNDLE, e => {
        try {
            e.returnValue = getBundle();
        } catch {
            e.returnValue = [];
        }
    });
}
