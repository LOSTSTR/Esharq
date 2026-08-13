/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * اختبار ترحيل تفضيلَي التعريب — **الصامت هو الخطر**.
 *
 *   pnpm testPrefs
 *
 * الترحيل الخاطئ لا يرمي خطأً ولا يكسر بناءً: يفتح المستخدم العميل فيجد
 * تفضيله عاد إلى افتراضيّه، ولا شيء في السجلّ يقول لماذا.
 *
 * 🔴 الحالة التي أسقطت النسخة الأولى مُثبَّتة هنا: المخزن يحمل **افتراضيات
 * مكتوبة** (`mergeDefaults` يكتبها عند الإقلاع)، فوجود القيمة لا يعني أن
 * المستخدم اختارها. من يعتمد على «غير محدَّد» يفشل هنا بالضبط.
 *
 * يُعاد بناء المنطق بنفس ترتيب `src/utils/esharqPrefs.ts`؛ فأي تغيير هناك
 * يجب أن يُقابله تغيير هنا وإلّا سقط الاختبار — وهو المقصود.
 */

type Store = {
    esharq?: Record<string, unknown>;
    plugins?: Record<string, Record<string, unknown> | undefined>;
};

const LEGACY_KEY: Record<string, string> = { pluginsArabic: "arabicMode", arabicFont: "arabicFont" };

function inherited(plain: Store, key: string): unknown {
    const fromPlugin = plain.plugins?.DiscordArabicizer?.[key];
    if (fromPlugin !== undefined) return fromPlugin;
    return plain.plugins?.Settings?.[LEGACY_KEY[key]];
}

/** نفس منطق `read()`: العلامة تحكم، ثم الموروث، ثم ما في الموضع الجديد. */
function read(plain: Store, key: string): unknown {
    if (plain.esharq?.migrated === true) return plain.esharq[key];
    const value = inherited(plain, key);
    return value !== undefined ? value : plain.esharq?.[key];
}

/** ما سيُكتب عند الترحيل — يُنقل المفتاحان معاً، ثم تُرفع العلامة. */
function migrated(plain: Store): Record<string, unknown> {
    const carried: Record<string, unknown> = {};
    for (const key of ["pluginsArabic", "arabicFont"]) {
        const value = inherited(plain, key);
        if (value !== undefined) carried[key] = value;
    }
    return { ...(plain.esharq ?? {}), ...carried, migrated: true };
}

/** المخزن كما يبدو فعلاً بعد `mergeDefaults`: الافتراضيات **مكتوبة**. */
const DEFAULTS = { migrated: false, pluginsArabic: false, arabicFont: "tajawal" };

let failed = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failed++;
    console.log(`  ${ok ? "✔" : "✖"} ${label}${detail === undefined ? "" : ` — ${detail}`}`);
}

console.log("── ترحيل تفضيلات التعريب ──");

// 🔴 الحالة التي فشلت حيّاً: افتراضيات مكتوبة + تفضيل حقيقي في الموضع الوسيط.
const realCase: Store = {
    esharq: { ...DEFAULTS },
    plugins: { DiscordArabicizer: { pluginsArabic: true, arabicFont: "tajawal" } }
};
check("الافتراضيّ المكتوب لا يحجب التفضيل المحفوظ", read(realCase, "pluginsArabic") === true,
    `قُرئت ${String(read(realCase, "pluginsArabic"))}`);
check("الترحيل ينقل القيمة الحقيقية", migrated(realCase).pluginsArabic === true);
check("الترحيل يرفع العلامة", migrated(realCase).migrated === true);

// المفتاحان معاً: لو رُحّل أحدهما ورُفعت العلامة لضاع الآخر بلا أثر.
const bothCase: Store = {
    esharq: { ...DEFAULTS },
    plugins: { DiscordArabicizer: { pluginsArabic: true }, Settings: { arabicFont: "saudi" } }
};
const after = migrated(bothCase);
check("المفتاحان يُنقلان في كتابة واحدة", after.pluginsArabic === true && after.arabicFont === "saudi", JSON.stringify(after));

// بعد الترحيل: الموضع الجديد وحده هو المرجع، ولو خالفه القديم.
const doneCase: Store = {
    esharq: { migrated: true, pluginsArabic: false, arabicFont: "off" },
    plugins: { DiscordArabicizer: { pluginsArabic: true, arabicFont: "cairo" } }
};
check("بعد الترحيل يُقرأ الجديد لا القديم",
    read(doneCase, "pluginsArabic") === false && read(doneCase, "arabicFont") === "off");

// 🔴 `false` بعد الترحيل **قيمة** لا غياب: إطفاء المستخدم يجب أن يصمد.
check("إطفاء المستخدم يصمد ولا يُستبدل بالقديم", read(doneCase, "pluginsArabic") === false);

// مستخدم جديد تماماً: لا شيء قديم ⇒ الافتراضيات كما هي.
const freshCase: Store = { esharq: { ...DEFAULTS } };
check("مستخدم جديد ⇒ الافتراضي", read(freshCase, "pluginsArabic") === false && read(freshCase, "arabicFont") === "tajawal");
check("لا يُخترَع للمستخدم الجديد شيء", Object.keys(migrated(freshCase)).sort().join(",") === "arabicFont,migrated,pluginsArabic");

// السلسلة الكاملة: الوسيط يسبق الأقدم.
const chainCase: Store = {
    esharq: { ...DEFAULTS },
    plugins: { DiscordArabicizer: { pluginsArabic: false }, Settings: { arabicMode: true } }
};
check("الوسيط يسبق الأقدم", read(chainCase, "pluginsArabic") === false);

// أقدم مستخدم: قيمته في إضافة الإعدادات وحدها.
const oldestCase: Store = { esharq: { ...DEFAULTS }, plugins: { Settings: { arabicMode: true } } };
check("يقرأ الأقدم حين لا وسيط", read(oldestCase, "pluginsArabic") === true);

console.log(failed === 0 ? "\nprefs self-test: 0 error(s)" : `\nprefs self-test: ${failed} error(s)`);
process.exit(failed === 0 ? 0 : 1);
