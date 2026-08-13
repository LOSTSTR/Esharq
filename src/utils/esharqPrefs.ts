/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Esharq — تفضيلا التعريب: لغة الإضافات، والخطّ العربي.
 *
 * ## أين يسكنان، ولماذا انتقلا مرّتين
 *
 *   1. `Settings.arabicMode` / `Settings.arabicFont`             ← الأصل
 *   2. `plugins.DiscordArabicizer.pluginsArabic` / `.arabicFont`
 *   3. `esharq.pluginsArabic` / `esharq.arabicFont`               ← الآن
 *
 * الانتقال الثاني كان صحيحاً حين كانت واجهتهما داخل تلك الإضافة. ولمّا
 * انتقلت الواجهة إلى صفحة «اللغة» صار بقاء التخزين داخل إضافة **مصيدة**:
 * من يقرأ الكود يظنّ التفضيل ملك الإضافة، وحذفها أو إعادة تسميتها تُسقطه.
 *
 * ## 🔴 لماذا علامة `migrated` ولا يكفي «غير محدَّد»
 *
 * `mergeDefaults` يكتب الافتراضيات في المخزن عند الإقلاع، فتصير
 * `esharq.pluginsArabic` موجودةً بقيمة `false` **قبل أن يقرأها أحد**. فلو
 * اعتمدنا على غيابها دليلاً على أن المستخدم لم يختر بعد، لرأى الترحيل قيمةً
 * «محدَّدة» فلم يُرحّل شيئاً — وعاد تفضيل المستخدم إلى الافتراضي بلا خطأ.
 * وقع هذا فعلاً في أوّل تجربة حيّة: قُرئت `false` ومحفوظه `true`.
 *
 * ولذلك أيضاً **لا تُحذف المفاتيح القديمة**: تركها لا يكلّف شيئاً، وحذفها
 * يعني أن نسخة أقدم من إشراق تقرأ بعدها فراغاً.
 */

import { PlainSettings, Settings } from "@api/Settings";

const PLUGIN = "DiscordArabicizer";
const LEGACY_PLUGIN = "Settings";

type PluginStore = Record<string, Record<string, unknown> | undefined> | undefined;
type PrefKey = "pluginsArabic" | "arabicFont";

/** قيمة مخزّنة صراحةً في إضافة (أو undefined إن لم يلمسها المستخدم قط). */
function storedInPlugin(plugin: string, key: string): unknown {
    return (PlainSettings.plugins as PluginStore)?.[plugin]?.[key];
}

/** المفتاح المقابل في الموضع الأقدم — اسمه مختلف للغة، ومطابق للخطّ. */
const LEGACY_KEY: Record<PrefKey, string> = {
    pluginsArabic: "arabicMode",
    arabicFont: "arabicFont"
};

/** أحدث موضع قديم فيه قيمة صريحة لهذا المفتاح. */
function inheritedValue(key: PrefKey): unknown {
    const fromPlugin = storedInPlugin(PLUGIN, key);
    if (fromPlugin !== undefined) return fromPlugin;
    return storedInPlugin(LEGACY_PLUGIN, LEGACY_KEY[key]);
}

/**
 * هل جهز سجلّ الإضافات؟ القراءة عبر الوكيل تُنشئ كائن الإضافة فور جهوز
 * السجلّ، وقبله تُرجِع undefined — وهي الإشارة الوحيدة الموثوقة لجهوز مخزن
 * الإعدادات.
 */
export function prefsReady(): boolean {
    return (Settings.plugins as PluginStore)?.[LEGACY_PLUGIN] != null;
}

/** الكتابة في موضع إشراق — كائن كامل، فلا تضيع بقيّة مفاتيحه. */
export function writeEsharqPref(key: PrefKey, value: unknown): void {
    try {
        const store = Settings as Record<string, any>;
        store.esharq = { ...(store.esharq ?? {}), [key]: value };
    } catch { /* مخزن غير جاهز — يُعاد المحاولة عند القراءة التالية */ }
}

/**
 * ترحيل **المفتاحين معاً مرّة واحدة**، ثم تُرفع العلامة.
 *
 * 🔴 معاً لا مفتاحاً مفتاحاً: لو رُفعت العلامة بعد أوّلهما لاعتُبر الثاني
 * مُرحَّلاً وهو لم يُنقَل، فيضيع أحد التفضيلين وحده — وهو أخبث من ضياعهما
 * معاً لأنه يبدو نجاحاً.
 */
function migrateOnce(): void {
    const store = Settings as Record<string, any>;
    const carried: Record<string, unknown> = {};

    for (const key of ["pluginsArabic", "arabicFont"] as PrefKey[]) {
        const inherited = inheritedValue(key);
        if (inherited !== undefined) carried[key] = inherited;
    }

    try {
        store.esharq = { ...(store.esharq ?? {}), ...carried, migrated: true };
    } catch { /* مخزن غير جاهز — تُقرأ القيم من موضعها القديم حتى المرّة القادمة */ }
}

/** القيمة السارية: المُرحَّلة إن تمّ الترحيل، وإلّا الموروثة من موضعها القديم. */
function read(key: PrefKey): unknown {
    const { esharq } = (PlainSettings as Record<string, any>);

    if (esharq?.migrated === true) return esharq[key];

    // لم يُرحَّل بعد: القيمة القديمة هي الصادقة، ونُرحّل فور جهوز المخزن.
    const inherited = inheritedValue(key);
    if (prefsReady()) migrateOnce();
    return inherited !== undefined ? inherited : esharq?.[key];
}

/** تعريب أسماء/أوصاف الإضافات ولوحة إشراق. */
export function readPluginsArabic(): boolean {
    return read("pluginsArabic") === true;
}

/**
 * الخطّ العربي المختار (مفتاح نصّي). القيمة غير المحدَّدة تعني الافتراضي،
 * ويتولّى `normalizeFontKey` ترجمة القيم القديمة (منها منطقيّة قديمة).
 */
export function readArabicFont(): unknown {
    return read("arabicFont");
}
