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

import { app } from "electron";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, sep } from "path";

const suffix = IS_DEV ? "dev" : "";

/**
 * مجلد بيانات المستخدم — الإعدادات والثيمات وCSS المخصص.
 *
 * كان باسم المشروع الأصل، فيرى مستخدم إشراق مجلداً باسم غيره حين يفتح
 * «مجلد الثيمات»، وتتفرّق بياناته عن حمولته في `%APPDATA%\Esharq`.
 *
 * 🔴 **المتغيّر القديم يبقى مقروءاً**: من ضبط `EQUICORD_USER_DATA_DIR`
 * صراحةً قصد مساراً بعينه، وتجاهله يُخفي بياناته عنه بلا إنذار.
 */
const legacyDataDir = process.env.DISCORD_USER_DATA_DIR
    ? join(process.env.DISCORD_USER_DATA_DIR, "..", "EquicordData", suffix)
    : join(app.getPath("userData"), "..", "Equicord", suffix);

export const DATA_DIR = process.env.ESHARQ_USER_DATA_DIR
    ?? process.env.EQUICORD_USER_DATA_DIR
    ?? (
        process.env.DISCORD_USER_DATA_DIR
            ? join(process.env.DISCORD_USER_DATA_DIR, "..", "EsharqData", suffix)
            : join(app.getPath("userData"), "..", "Esharq", suffix)
    );

/** المجلد القديم — يُقرأ مرّة للترحيل فقط، ولا يُحذف. */
export const LEGACY_DATA_DIR = legacyDataDir;

export const SETTINGS_DIR = join(DATA_DIR, "settings");
export const THEMES_DIR = join(DATA_DIR, "themes");
export const QUICK_CSS_PATH = join(SETTINGS_DIR, "quickCss.css");
export const SETTINGS_FILE = join(SETTINGS_DIR, "settings.json");
export const NATIVE_SETTINGS_FILE = join(SETTINGS_DIR, "native-settings.json");
export const DEV_MIGRATED = join(SETTINGS_DIR, "migration");
export const ALLOWED_PROTOCOLS = [
    "https:",
    "http:",
    "steam:",
    "spotify:",
    "com.epicgames.launcher:",
    "tidal:",
    "itunes:",
    "vrcx:",
    "tg:",
];

export const IS_VANILLA = /* @__PURE__ */ process.argv.includes("--vanilla");

/**
 * ترحيل بيانات المستخدم من مجلد الأصل — **مرّة واحدة، ونسخاً لا نقلاً**.
 *
 * ## القواعد التي يقوم عليها
 *
 * 1. **لا يُحذف القديم أبداً.** النسخ يُبقي للمستخدم طريق رجوع لو أخطأنا،
 *    ولو نقلنا لَما بقي لنسخة أقدم من إشراق شيء تقرؤه.
 * 2. **لا يُطمَس شيء في الجديد** (`force: false`): لو كان قد بدأ استعماله
 *    فملفه أحدث من القديم.
 * 3. **العلامة تُكتب أخيراً**، وهي وحدها ما يمنع التكرار. لو انقطع النسخ
 *    في منتصفه فلا علامة ⇒ يُعاد في الإقلاع التالي ويُكمل ما نقص. ولو
 *    اعتمدنا وجود `settings.json` دليلاً لَعُدّ نسخٌ ناقص نجاحاً.
 * 4. **يُتخطّى إن ضُبط المسار يدوياً**: من ضبط متغيّر بيئة قصد مكاناً بعينه.
 * 5. **بيانات المستخدم وحدها**: لا تُنسخ حمولة المُعدِّل الأصل (`*.asar`)
 *    ولا الذواكر المؤقّتة. نسخها يضاعف مئات الميغابايت بلا فائدة، ويضع
 *    حمولة مشروع آخر داخل مجلد إشراق فيُربك من يفتحه.
 *
 * صامت عند عدم وجود قديم — وهي حال كل مستخدم جديد.
 */
const NOT_USER_DATA = /^(ExtensionCache|DawnGraphiteCache|DawnWebGPUCache|GPUCache|Cache|Code Cache)$/;

function migrateLegacyData(): void {
    const marker = join(DATA_DIR, ".migrated-from-upstream");

    if (DATA_DIR === LEGACY_DATA_DIR) return;
    if (process.env.ESHARQ_USER_DATA_DIR || process.env.EQUICORD_USER_DATA_DIR) return;
    if (existsSync(marker)) return;
    if (!existsSync(LEGACY_DATA_DIR)) return;

    try {
        cpSync(LEGACY_DATA_DIR, DATA_DIR, {
            recursive: true,
            force: false,
            errorOnExist: false,
            filter: source => {
                const name = source.slice(source.lastIndexOf(sep) + 1);
                return !name.endsWith(".asar") && !NOT_USER_DATA.test(name);
            }
        });
        mkdirSync(DATA_DIR, { recursive: true });
        writeFileSync(marker, new Date().toISOString());
        console.log(`[Esharq] نُسخت بيانات المستخدم من ${LEGACY_DATA_DIR} — والقديم باقٍ كما هو.`);
    } catch (err) {
        // لا نُوقف الإقلاع: بلا ترحيل يبدأ المستخدم بإعدادات افتراضية،
        // وبإيقاف الإقلاع لا يبدأ أصلاً. والقديم سليم في الحالتين.
        console.error("[Esharq] تعذّر ترحيل بيانات المستخدم:", err);
    }
}

migrateLegacyData();

if (IS_DEV) {
    const prodDir = join(DATA_DIR, "..");
    const settings = join(prodDir, "settings", "settings.json");
    const quickCss = join(prodDir, "settings", "quickCss.css");

    let migrated = false;
    if (existsSync(DEV_MIGRATED)) {
        const content = readFileSync(DEV_MIGRATED, "utf-8");
        migrated = content.includes("migrated");
    }

    if (!migrated) {
        setTimeout(() => {
            try {
                if (existsSync(settings)) copyFileSync(settings, SETTINGS_FILE);
                if (existsSync(quickCss)) copyFileSync(quickCss, QUICK_CSS_PATH);
                writeFileSync(DEV_MIGRATED, "migrated");
                app.relaunch();
                app.exit(0);
            } catch (err) {
                console.error("[Equicord] Failed to copy prod data:", err);
            }
        }, 5000);
    }
}
