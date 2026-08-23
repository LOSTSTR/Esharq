/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Settings } from "@api/Settings";
import { IpcEvents } from "@shared/IpcEvents";
import { SettingsStore } from "@shared/SettingsStore";
import { mergeDefaults } from "@utils/mergeDefaults";
import { ipcMain } from "electron";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "fs";

import { NATIVE_SETTINGS_FILE, SETTINGS_DIR, SETTINGS_FILE } from "./utils/constants";

mkdirSync(SETTINGS_DIR, { recursive: true });

/**
 * كتابةٌ **ذرّية**: ملفٌّ مؤقّت ثمّ استبدال باسمه.
 *
 * ── لماذا ─────────────────────────────────────────────────────────────
 * 🔴 `writeFileSync` على الملفّ نفسه **ليست ذرّية**: النظام يقتطع الملفّ إلى
 * صفر ثمّ يكتب المحتوى. بين اللحظتين نافذةٌ الملفّ فيها ناقص. وكلّ تبديلٍ
 * يُعيد كتابة الملفّ كاملاً (86 KB عند مستخدمٍ نشط)، والملفّ يُكتَب كذلك
 * **مرّةً عند كلّ إقلاع** — قِسته: تحرّك `mtime` بلا أن ألمس شيئاً.
 *
 * فإن انتهت العملية في تلك النافذة — إغلاقٌ من علبة النظام، أو قتلٌ، أو
 * نومُ الجهاز، أو انهيار — بقي الملفّ مقطوعاً. وحينها تفشل قراءة الإقلاع
 * التالي، فيعمل العميل بالافتراضات، ثمّ **يكتب الافتراضات فوق ما بقي**:
 * يضيع كلّ ما اختاره صاحبه. رأيتُ ذلك يقع في اختبارٍ مقصود: ملفٌّ أفسدتُه
 * صار بعد إقلاعٍ واحد ملفَّ افتراضاتٍ كاملاً.
 *
 * `rename` في نظام الملفّات لا تتجزّأ: إمّا القديم كاملاً أو الجديد كاملاً.
 * فتُغلق النافذة نهائياً.
 *
 * ── لماذا الارتداد إلى الكتابة المباشرة ───────────────────────────────
 * على ويندوز قد تفشل `rename` إن أمسك الهدفَ برنامجٌ آخر (مضادّ فيروسات
 * يفحصه، مزامنة تقرؤه). عندها نكتب مباشرةً كما كنّا نفعل — فالنتيجة **لا
 * تصير أسوأ من اليوم بحال**، ويبقى المكسب في كلّ الأحوال الأخرى.
 *
 * 🔴 المؤقّت في **نفس المجلد** عمداً: `rename` عبر قرصين تفشل بـ`EXDEV`.
 */
function writeAtomic(file: string, data: string) {
    const tmp = `${file}.tmp`;
    try {
        writeFileSync(tmp, data);
        renameSync(tmp, file);
    } catch (e) {
        try {
            if (existsSync(tmp)) unlinkSync(tmp);
        } catch { /* لا يمنع المحاولة التالية */ }
        writeFileSync(file, data);
    }
}

/**
 * ملفّ الأمان: نسخةٌ **معروفة السلامة** تُؤخذ مرّة واحدة كلّ جلسة بعد قراءةٍ
 * ناجحة — لا مع كلّ كتابة (فلا كلفة على التبديل) ولا بعد قراءةٍ فاشلة (فلا
 * تُنسَخ حالةٌ فاسدة فوق نسخةٍ سليمة).
 */
const backupOf = (file: string) => `${file}.bak`;

/**
 * يُزيل ملفّاً مؤقّتاً بقي من كتابةٍ قُطعت.
 *
 * 🔴 ليس ضاراً — لا يُقرأ أبداً، وأوّل كتابةٍ ناجحة تستبدله — لكنّه يبقى في
 * مجلدٍ يفتحه المستخدم بنفسه، وقد يكون بحجم ملفّ الإعدادات كاملاً. قِسته:
 * بعد عشرين قتلاً أثناء الكتابة بقي واحد.
 */
function clearStaleTemp(file: string) {
    try {
        const tmp = `${file}.tmp`;
        if (existsSync(tmp)) unlinkSync(tmp);
    } catch { /* ممسوكٌ الآن — يُستبدَل عند أول كتابة */ }
}

clearStaleTemp(SETTINGS_FILE);
clearStaleTemp(NATIVE_SETTINGS_FILE);

/**
 * نتيجة قراءة الإقلاع — تُحفظ لأنّها **السؤال الحقيقي**.
 *
 * 🔴 قراءةُ الملفّ لحظة إنشاء التقرير تُجيب سؤالاً آخر: قد يُقفَل الملفّ لحظةً
 * عند الإقلاع (مضادّ فيروسات، مزامنة سحابية) فتفشل القراءة ويبدأ العميل
 * بإعدادات فارغة، ثمّ يصير الملفّ مقروءاً بعد ثوانٍ — فيُظهر الفحص «سليم»
 * وقد ضاعت اختيارات صاحبه بالفعل. تقريرٌ حقيقيّ وصل هكذا: `readable: null`
 * و`lastWriteError: null` و**كلّ الإضافات مُطفأة**.
 *
 * والأسوأ أنّ الضرر لا يقف عند جلسة: العميل يعمل بالافتراضات، وأوّل تبديلٍ
 * يكتب `RendererSettings.plain` كاملاً — أي **الافتراضات فوق ملفّه**.
 */
export const StartupRead = {
    ok: true,
    error: null as string | null,
    /** كم إضافةً حُمّلت من الملفّ فعلاً — صفرٌ مع ملفٍّ غير فارغ = دليل قاطع. */
    pluginEntries: 0,
    /** حجم ما قُرئ بالبايت، ليُقارَن بحجم الملفّ على القرص. */
    bytes: 0,
    /** أُنقِذت الإعدادات من نسخة الأمان — أي أنّ الأصل كان تالفاً. */
    recovered: false
};

function readSettings<T = object>(name: string, file: string): Partial<T> {
    const isRenderer = name === "renderer";

    const parse = (path: string) => {
        const raw = readFileSync(path, "utf-8");
        const parsed = JSON.parse(raw);
        if (isRenderer) {
            StartupRead.bytes = Buffer.byteLength(raw);
            StartupRead.pluginEntries = Object.keys((parsed as any)?.plugins ?? {}).length;
        }
        return parsed;
    };

    try {
        const parsed = parse(file);
        // نسخةُ أمانٍ **معروفة السلامة**، مرّة واحدة كلّ جلسة.
        try {
            copyFileSync(file, backupOf(file));
        } catch { /* تعذّرت النسخة — لا يمنع الإقلاع */ }
        return parsed;
    } catch (err: any) {
        const missing = err?.code === "ENOENT";

        // 🔴 قبل أن يُدَس شيء: تُجرَّب نسخة الأمان.
        //
        // بلا هذه الخطوة كان تلفٌ عابر يُكلّف المستخدم **كلّ** اختياراته:
        // القراءة تفشل ⇒ افتراضات ⇒ أوّل تبديلٍ يكتبها فوق ملفّه. الآن يخسر
        // آخر تغييرٍ لا أكثر.
        if (!missing) {
            try {
                const recovered = parse(backupOf(file));
                // 🔴 التالف **يُحفَظ ولا يُحذَف**: هو الدليل الوحيد على ما جرى،
                // وقد يحوي ما لا تحويه النسخة. الاسم بالتاريخ فلا يدوس بعضه بعضاً.
                try {
                    renameSync(file, `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`);
                } catch { /* بقي مكانه — سيُستبدَل ذرّياً عند أول كتابة */ }

                console.error(`[Esharq] ${name} settings were unreadable — recovered from the backup.`, err);
                if (isRenderer) {
                    StartupRead.ok = false;
                    StartupRead.error = `${err?.code ?? "خطأ"}: ${err?.message ?? err} — استُعيدت من النسخة الاحتياطية`;
                    StartupRead.recovered = true;
                }
                return recovered;
            } catch { /* لا نسخة صالحة — نُكمل إلى الافتراضات */ }
        }

        if (isRenderer) {
            // الغياب ليس عطلاً — هذه حال كل مستخدمٍ جديد.
            StartupRead.ok = missing;
            StartupRead.error = missing ? null : `${err?.code ?? "خطأ"}: ${err?.message ?? err}`;
        }
        if (!missing) {
            console.error(`Failed to read ${name} settings`, err);
            // لا نسخة تُنقذ: يُحفَظ التالف كي لا تمحوه أوّل كتابة.
            try {
                renameSync(file, `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`);
            } catch { /* تعذّر — الكتابة الذرّية ستستبدله على أي حال */ }
        }

        return {};
    }
}

export const RendererSettings = new SettingsStore(readSettings<Settings>("renderer", SETTINGS_FILE));

/**
 * آخر فشلٍ في حفظ الإعدادات — يُقرأ من الواجهة.
 *
 * 🔴 لماذا يُرصد: كان الفشل يُطبَع في مِعراض **العملية الرئيسية** وحده — وهو
 * ما لا يراه مستخدم. فمن يُفعّل إضافاته ثمّ يجدها مُطفأة بعد إعادة التشغيل لا
 * يرى سبباً واحداً في أي مكان، ولا يحمله تقرير الدعم. حالةٌ حقيقية: عضوٌ
 * أرسل تقريراً فيه 21 إضافة، **كلّها تلقائية** (`required` أو
 * `enabledByDefault` أو تابعة) — أي أن ملفّه لم يُطبَّق قطّ، والتقرير لا يقول
 * لماذا. فالسبب يجب أن يصل الواجهة لا المِعراض.
 */
let lastWriteError: string | null = null;

RendererSettings.addGlobalChangeListener(() => {
    try {
        const json = JSON.stringify(RendererSettings.plain, null, 4);
        writeAtomic(SETTINGS_FILE, json);

        // 🔴 الكتابة قد «تنجح» ولا تصل القرص: مضادّ فيروسات يعترضها، أو مجلد
        // مُزامَن يُعيد الملفّ القديم. نتحقّق من الحجم — رخيصٌ، والتبديل نادر.
        const written = statSync(SETTINGS_FILE).size;
        const expected = Buffer.byteLength(json);
        lastWriteError = written === expected
            ? null
            : `الملفّ كُتب بحجم ${written} بايت والمتوقّع ${expected} — يعترضه شيءٌ خارج إشراق.`;
    } catch (e: any) {
        lastWriteError = `${e?.code ?? "خطأ"}: ${e?.message ?? e}`;
        console.error("Failed to write renderer settings", e);
    }
});

ipcMain.handle(IpcEvents.GET_SETTINGS_HEALTH, () => {
    let exists = false, size = 0, mtime: string | null = null, readable: string | null = null;
    try {
        const st = statSync(SETTINGS_FILE);
        exists = true;
        size = st.size;
        mtime = st.mtime.toISOString();
        // يُقرأ فعلاً: ملفٌّ موجودٌ لكنّه تالف يُعيد المستخدمَ إلى الافتراضات
        // في كل إقلاع، وهو أشيع من غيابه.
        JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));
    } catch (e: any) {
        if (e?.code !== "ENOENT") readable = `${e?.code ?? "خطأ"}: ${e?.message ?? e}`;
    }
    return {
        path: SETTINGS_FILE, exists, size, mtime, readable, lastWriteError,
        startupReadOk: StartupRead.ok,
        startupReadError: StartupRead.error,
        loadedPluginEntries: StartupRead.pluginEntries,
        recoveredFromBackup: StartupRead.recovered,
        loadedBytes: StartupRead.bytes
    };
});

ipcMain.handle(IpcEvents.GET_SETTINGS_DIR, () => SETTINGS_DIR);
ipcMain.on(IpcEvents.GET_SETTINGS, e => e.returnValue = RendererSettings.plain);

ipcMain.handle(IpcEvents.SET_SETTINGS, (_, data: Settings, pathToNotify?: string) => {
    RendererSettings.setData(data, pathToNotify);
});

export interface NativeSettings {
    plugins: {
        [plugin: string]: {
            [setting: string]: any;
        };
    };
    customCspRules: Record<string, string[]>;
}

const DefaultNativeSettings: NativeSettings = {
    plugins: {},
    customCspRules: {}
};

const nativeSettings = readSettings<NativeSettings>("native", NATIVE_SETTINGS_FILE);
mergeDefaults(nativeSettings, DefaultNativeSettings);

export const NativeSettings = new SettingsStore(nativeSettings as NativeSettings);

NativeSettings.addGlobalChangeListener(() => {
    try {
        writeAtomic(NATIVE_SETTINGS_FILE, JSON.stringify(NativeSettings.plain, null, 4));
    } catch (e) {
        console.error("Failed to write native settings", e);
    }
});
