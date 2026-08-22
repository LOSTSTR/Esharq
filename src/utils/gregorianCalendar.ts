/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * فرض التقويم الميلاديّ على تنسيق التواريخ بالعربية.
 *
 * ── المشكلة كما ظهرت ──────────────────────────────────────────────────
 * طابع رسالة يُعرَض `24/02/48`. قِيس: هذا `1448/02/24` هجريّاً، أي
 * **2026-08-06** ميلاديّاً. فالتاريخ صحيح والتقويم خطأ.
 *
 * ── لماذا يحدث ────────────────────────────────────────────────────────
 * `Intl.DateTimeFormat("ar")` بلا منطقة يُكمل المنطقة من إعداد النظام. فإن
 * كانت المنطقة عربيةً حلّ إلى `ar-SA` وما شابهها، وتقويمها الافتراضي في
 * إصدارات CLDR الأقدم `islamic-umalqura`. وإلكترون الذي يحمله ديسكورد يحمل
 * نسخة ICU أقدم من متصفّح النظام — ولذلك **لا تُعاد المشكلة في المتصفّح**:
 * قِست `ar` و`ar-SA` في Node وChromium الحديثَين فأعطيا `gregory` كلاهما.
 * أي أنّ اختبار المتصفّح يُكذّب وجود العلّة، والعلّة قائمة عند المستخدم.
 *
 * ── العلاج ───────────────────────────────────────────────────────────
 * تُلَفّ `Intl.DateTimeFormat` ودوالّ `toLocale*String` فيُضاف
 * `-u-ca-gregory` **للغات العربية وحدها** حين لا يكون التقويم محدَّداً سلفاً.
 * ولا يُلمس نظام الأرقام: من اختار العربية يرى أرقاماً عربية إن اختارها
 * ديسكورد، وهذا ليس ممّا اشتُكي منه.
 *
 * يُستدعى **مرّة عند الاستيراد** مثل تثبيت جدول الرسائل: ديسكورد ينسّق تواريخ
 * قبل تشغيل الإضافات، فالتأخير إلى `start()` يترك أوّل ما يُرسَم هجريّاً.
 */

const ARABIC = /^ar\b/i;
const HAS_CALENDAR = /-u-(?:[a-z0-9]+-)*ca-/i;

/** يضيف التقويم الميلاديّ إلى وسم لغة عربيّ لا تقويم فيه. */
function withGregory(tag: string): string {
    if (!ARABIC.test(tag) || HAS_CALENDAR.test(tag)) return tag;
    // امتداد موجود ⇒ يُلحَق به مفتاحٌ جديد؛ وإلّا يُفتَح امتداد.
    return tag.includes("-u-") ? `${tag}-ca-gregory` : `${tag}-u-ca-gregory`;
}

type Locales = string | string[] | undefined;

function fixLocales(locales: Locales): Locales {
    if (typeof locales === "string") return withGregory(locales);
    if (Array.isArray(locales)) return locales.map(l => (typeof l === "string" ? withGregory(l) : l));
    return locales;
}

let applied = false;

export function forceGregorianForArabic() {
    if (applied || typeof Intl === "undefined") return;
    applied = true;

    try {
        const Original = Intl.DateTimeFormat;

        // بديلٌ يعمل مع `new` وبدونها — كلا الاستدعاءين مشروع في المواصفة،
        // وديسكورد يستعمل الاثنين.
        const Patched = function (this: unknown, locales?: Locales, options?: Intl.DateTimeFormatOptions) {
            const opts = options && (options as any).calendar
                ? options
                : { ...(options ?? {}) };
            return new (Original as any)(fixLocales(locales), opts);
        } as unknown as typeof Intl.DateTimeFormat;

        Patched.supportedLocalesOf = Original.supportedLocalesOf.bind(Original);
        // `prototype` للقراءة فقط في النوع، والإسناد لازمٌ حتى يبقى
        // `instanceof` صحيحاً لمن يفحصه. يُكتب عبر `defineProperty`.
        Object.defineProperty(Patched, "prototype", {
            value: Original.prototype, writable: false, enumerable: false, configurable: false
        });
        Intl.DateTimeFormat = Patched;

        // `toLocaleDateString` وأخواتها لا تمرّ بـ`Intl.DateTimeFormat` أعلاه:
        // المواصفة تصف سلوكها بالبناء **الداخلي**، فلا يراه اللفّ.
        for (const name of ["toLocaleDateString", "toLocaleString", "toLocaleTimeString"] as const) {
            const original = Date.prototype[name];
            if (typeof original !== "function") continue;
            Object.defineProperty(Date.prototype, name, {
                configurable: true,
                writable: true,
                value: function (this: Date, locales?: Locales, options?: Intl.DateTimeFormatOptions) {
                    return original.call(this, fixLocales(locales) as any, options);
                }
            });
        }
    } catch {
        // فشل اللفّ يعني بقاء التقويم كما كان — عيبٌ ظاهر لا انهيار.
        applied = false;
    }
}
