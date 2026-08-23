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
 * الجيل الأقدم من نسخة الأمان.
 *
 * 🔴 لماذا جيلان: النسخة كانت تُؤخَذ بعد **كل** قراءةٍ ناجحة بلا شرط. فإن
 * أقلع العميل مرّةً على ملفٍّ خسر محتواه — وقراءتُه تنجح، فهو JSON سليم —
 * نُسخ الخاوي فوق النسخة السليمة وصار الضياع **دائماً**. بجيلين، لقطةٌ
 * واحدة سيّئة لا تُتلف آخر ما يُوثَق به.
 */
const olderBackupOf = (file: string) => `${file}.bak.1`;

/**
 * هل هذا **تلفٌ في المحتوى** أم **عجزٌ عابر عن القراءة**؟
 *
 * 🔴 الفرق يقرّر مصير ملفّ المستخدم. `JSON.parse` يرمي `SyntaxError` بلا
 * `code` ⇒ الملفّ نفسه تالف، فعزلُه صواب. أمّا `EACCES` أو `EBUSY` أو
 * `EMFILE` (نفاد الواصفات عند الإقلاع) فالملفّ **سليم** ولم يُقرأ فحسب —
 * وعزلُه حينها يُحوّل عطلاً يشفى وحده في الإقلاع التالي إلى **ضياعٍ دائم**،
 * ولا سبيل للمستخدم إلى استعادته إلّا بإعادة تسميةٍ يدوية لا يعرفها.
 *
 * فلا يُعزَل إلّا ما ثبت تلفه.
 */
function isContentCorruption(err: any): boolean {
    return err?.code === undefined && err instanceof SyntaxError;
}

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
    recovered: false,
    /**
     * الأصل **ما زال على القرص سليماً**، لكنّه تعذّر عن القراءة هذه الجلسة
     * (قفلٌ عابر صمد أمام الإعادات)، فحُمّلت نسخة الأمان بدلاً منه.
     *
     * 🔴 في هذه الحال **يُمنَع الحفظ**. الملفّ الذي على القرص أحدث ممّا في
     * الذاكرة، فأوّل تبديلٍ كان يكتب القديم فوق الجديد ويُضيّع جلسةً كاملة
     * من اختيارات صاحبه — عقوبةً على قفلٍ دام جزءاً من ثانية. أن تُرفَض
     * كتابةٌ واحدة ويُقال السبب، أهون من أن يُمحى ملفٌّ سليم.
     */
    holdWrites: false
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

    /**
     * قراءةٌ تُعاد قبل أن يُحكَم بالفشل.
     *
     * 🔴 قفلُ مضادّ فيروسات أو مجلدٍ مُزامَن يدوم أجزاءً من الثانية. وبلا
     * إعادةٍ كان ذلك القفلُ العابر يُسقط الملفّ السليم إلى نسخة الأمس، ثمّ
     * أوّل تبديلٍ يكتب الأمس فوق اليوم. ثلاث محاولات بانتظارٍ متزايد تُعبر
     * القفل، ولا تُطيل الإقلاع إلّا حين يكون هناك عطلٌ فعلاً.
     */
    const parseWithRetry = (path: string) => {
        for (let attempt = 0; ; attempt++) {
            try {
                return parse(path);
            } catch (err: any) {
                // التلف لا يُشفى بالإعادة، والغياب ليس عطلاً — كلاهما يُرمى فوراً.
                if (attempt >= 2 || isContentCorruption(err) || err?.code === "ENOENT") throw err;
                Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 40 * (attempt + 1));
            }
        }
    };

    try {
        const parsed = parseWithRetry(file);
        // نسخةُ أمانٍ **معروفة السلامة**، مرّة واحدة كلّ جلسة — والقديمة
        // تُزاح جيلاً لا تُمحى.
        try {
            if (existsSync(backupOf(file))) copyFileSync(backupOf(file), olderBackupOf(file));
        } catch { /* تعذّرت الإزاحة — لا يمنع الإقلاع */ }
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
        // 🔴 الغياب لم يعد يتخطّى التعافي.
        //
        // كان الشرط `if (!missing)`، فبعد أن يُعزَل ملفٌّ تالف يصير غائباً —
        // والإقلاع التالي يقرأ `ENOENT` فيتخطّى نسخة الأمان كلّها ويعود
        // بـ`{}`، **ويُبلّغ أنّ القراءة سليمة**. كل الإضافات والثيمات تختفي
        // والتقرير أخضر. ومستخدمٌ جديد لا نسخةَ له أصلاً، فيمضي كما كان.
        {
            const fromBackup = () => {
                try {
                    return parseWithRetry(backupOf(file));
                } catch {
                    // الجيل الأقدم: يُجرَّب حين تكون الأحدث هي نفسها تالفة.
                    return parseWithRetry(olderBackupOf(file));
                }
            };
            try {
                const recovered = fromBackup();
                // 🔴 التالف **يُحفَظ ولا يُحذَف**: هو الدليل الوحيد على ما جرى،
                // وقد يحوي ما لا تحويه النسخة. الاسم بالتاريخ فلا يدوس بعضه بعضاً.
                if (isContentCorruption(err)) {
                    try {
                        renameSync(file, `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`);
                    } catch { /* بقي مكانه — سيُستبدَل ذرّياً عند أول كتابة */ }
                }

                console.error(`[Esharq] ${name} settings were unreadable — recovered from the backup.`, err);
                if (isRenderer) {
                    StartupRead.ok = false;
                    StartupRead.error = `${err?.code ?? "خطأ"}: ${err?.message ?? err} — استُعيدت من النسخة الاحتياطية`;
                    StartupRead.recovered = true;
                    // الأصل لم يُعزَل ولم يغب ⇒ هو الأحدث، فلا يُكتب فوقه.
                    StartupRead.holdWrites = !missing && !isContentCorruption(err) && existsSync(file);
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
            // 🔴 لا يُعزَل إلّا التلف المُثبَت. عجزٌ عابر (`EACCES`/`EBUSY`/
            // `EMFILE`) يُترَك الملفّ فيه مكانه: الإقلاع التالي يقرؤه فيشفى
            // وحده. وعزلُه كان يجعل عطلاً عابراً **ضياعاً دائماً** — وأسوأ
            // ما فيه أنّه يقع في أوّل إقلاعٍ بعد التحديث، حين لا نسخة أمانٍ
            // بعد، فيرى المستخدم إعداداتٍ من مصنعها بلا طريق رجوع.
            if (isContentCorruption(err)) {
                try {
                    renameSync(file, `${file}.corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`);
                } catch { /* تعذّر — الكتابة الذرّية ستستبدله على أي حال */ }
            }
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
    // ما في الذاكرة نسخةُ أمانٍ أقدم ممّا على القرص — الكتابة هنا محوٌ لا حفظ.
    if (StartupRead.holdWrites) {
        lastWriteError = "لم تُقرأ إعداداتك هذه الجلسة والملفّ الأصلي سليم على القرص، "
            + "فأُوقف الحفظ لئلّا يُكتب فوقه ما هو أقدم منه. أعد تشغيل إشراق.";
        console.error("[Esharq] settings write held back: startup read failed while the on-disk file is intact.");
        return;
    }

    const json = JSON.stringify(RendererSettings.plain, null, 4);

    try {
        writeAtomic(SETTINGS_FILE, json);
    } catch (e: any) {
        lastWriteError = `${e?.code ?? "خطأ"}: ${e?.message ?? e}`;
        console.error("Failed to write renderer settings", e);
        return;
    }

    // 🔴 الكتابة قد «تنجح» ولا تصل القرص: مضادّ فيروسات يعترضها، أو مجلد
    // مُزامَن يُعيد الملفّ القديم. نتحقّق من الحجم — رخيصٌ، والتبديل نادر.
    //
    // وهذا التحقّق **في مصيدته وحده**: كان داخل مصيدة الكتابة، فإن تعثّر
    // `statSync` على قفلٍ بعد كتابةٍ ناجحة قيل للمستخدم «لم تُحفَظ إعداداتك»
    // وهي محفوظة — فيُطارد عطلاً لا وجود له، ويصل التقرير مسموماً.
    try {
        const written = statSync(SETTINGS_FILE).size;
        const expected = Buffer.byteLength(json);
        lastWriteError = written === expected
            ? null
            : `الملفّ كُتب بحجم ${written} بايت والمتوقّع ${expected} — يعترضه شيءٌ خارج إشراق.`;
    } catch (e: any) {
        // الكتابة نجحت؛ التحقّق وحده تعذّر. لا يُقال إنّ الحفظ فشل.
        lastWriteError = null;
        console.warn("[Esharq] settings were written but could not be verified", e);
    }
});

ipcMain.handle(IpcEvents.REPORT_SETTINGS_SAVE_FAILURE, (_, message: string) => {
    // فشلٌ وقع في الواجهة قبل أن يصل القرص — يُسجَّل في نفس الحقل الذي تقرؤه
    // حزمة الدعم، فلا فرق عند من يشخّص بين فشلٍ هنا أو هناك.
    lastWriteError = `من الواجهة: ${String(message).slice(0, 300)}`;
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
        // الحفظ مُوقَف حمايةً لملفٍّ سليم لم يُقرأ — أهمّ سطرٍ في تقرير من
        // يقول «إعداداتي لا تُحفَظ»، وبلا هذا الحقل يُشخَّص العطل خطأً.
        writesHeld: StartupRead.holdWrites,
        loadedBytes: StartupRead.bytes
    };
});

ipcMain.handle(IpcEvents.GET_SETTINGS_DIR, () => SETTINGS_DIR);
ipcMain.on(IpcEvents.GET_SETTINGS, e => e.returnValue = RendererSettings.plain);

ipcMain.handle(IpcEvents.SET_SETTINGS, (_, data: Settings | string, pathToNotify?: string) => {
    // الكائن يبقى مقبولاً: نداءٌ من واجهةٍ أقدم لا يجوز أن ينهار.
    RendererSettings.setData(typeof data === "string" ? JSON.parse(data) : data, pathToNotify);
});

export interface NativeSettings {
    plugins: {
        [plugin: string]: {
            [setting: string]: any;
        };
    };
    customCspRules: Record<string, string[]>;
    /**
     * اختيار الاتّصال المشفّر — **حالةٌ تملكها العملية الرئيسية**.
     *
     * 🔴 كانت تسكن شجرة إعدادات المُصيِّر، وتُكتب من هنا بـ`setData`. لكنّ
     * المُصيِّر يأخذ لقطته عند الإقلاع ثمّ يرسل **الشجرة كاملةً** مع كل تبديل،
     * وهي لا تعرف هذا المفتاح — فيُمحى. عملياً: يختار المستخدم DNS مشفّراً،
     * يُبدّل أيّ إعدادٍ آخر، فيعود `off` بعد إعادة التشغيل. بلا رسالة.
     *
     * ولا جسر بين الاتّجاهين: `GET_SETTINGS` مرّةً عند الإقلاع، و`SET_SETTINGS`
     * من المُصيِّر إلى هنا — ولا شيء يدفع من هنا إليه. فالحلّ ليس ترقيعاً في
     * الدفع، بل أن تسكن الحالة تخزينها الصحيح.
     */
    esharqSecureDns?: { mode: string; providerId: string; };
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
