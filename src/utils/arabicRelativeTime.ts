/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * تعريب المُدَد النسبية («منذ دقيقتين» · «استغرقت بضع ثوانٍ»).
 *
 * ── المشكلة كما ظهرت ──────────────────────────────────────────────────
 * رسالة مكالمة فائتة تُعرَض: «فاتتك مكالمة من فلان استغرقت a few seconds.»
 * الجملة مُعرَّبة والمدّة إنجليزية — لأنّها **ليست نصّاً في جدول ديسكورد**:
 * الجدول يحمل القالب `…that lasted {callDuration}.` والقيمة تُحسَب وقت العرض.
 *
 * ── من يُنتجها ────────────────────────────────────────────────────────
 * «a few seconds» بلا لاحقة هي حرفياً `relativeTime.s` في لغة moment
 * الإنجليزية، وهو ما يُخرجه `moment.duration(x).humanize()` لما دون 45 ثانية.
 * لا `Intl.RelativeTimeFormat` ولا أي مصدر آخر يُنتج هذه الصيغة.
 *
 * ── لماذا لا نُبدّل لغة moment إلى «ar» ───────────────────────────────
 * 🔴 `moment.locale("ar")` يُبدّل **كلّ شيء** معه: صيغ `L` و`LT` وأسماء
 * الشهور والأيام وربّما الأرقام الهندية. وطوابع ديسكورد تُعرَض الآن `12:13`
 * وهي مقبولة عند المالك؛ فتبديل اللغة كلّها يُغيّر ما لم يُشتَكَ منه ويخاطر
 * بشكل التوقيت في كلّ رسالة. ولغة `ar` قد لا تكون محمّلة أصلاً في حزمة
 * ديسكورد (العربية ليست من لغاته الرسمية)، فيسقط الطلب صامتاً إلى الإنجليزية.
 *
 * العلاج جراحيّ: يُستبدل **`relativeTime` وحده** في اللغة النشطة أياً كانت،
 * فتبقى الصيغ والأسماء والأرقام كما هي بالضبط، ولا يتغيّر إلّا ما كان
 * إنجليزياً وسط جملة عربية.
 */

type MomentLike = {
    locale(): string;
    updateLocale(name: string, config: Record<string, unknown>): unknown;
};

/**
 * جمع العربية أربع صور لا صورتان: مفرد ومثنّى وجمعُ قلّة (٣–١٠) وجمعُ كثرة
 * (١١+). و«١١ دقيقة» مفردةٌ لفظاً — وهذا ما يجعل جدولاً بسيطاً بصيغتين خطأً
 * يظهر في كلّ رقم تجاوز العشرة.
 */
function plural(
    n: number, withoutSuffix: boolean,
    one: string, twoNom: string, twoGen: string, few: string, singularNoun: string
) {
    if (n === 1) return one;
    // 🔴 المثنّى يتغيّر باللاحقة: «دقيقتان» وحدها، و«منذ دقيقتين» مجرورة.
    // بلا هذا يخرج «منذ دقيقتان» — ركيكٌ يراه كل من نظر إلى مكالمةٍ فائتة.
    // وmoment يمرّر `withoutSuffix` لهذا الغرض بالضبط.
    if (n === 2) return withoutSuffix ? twoNom : twoGen;
    if (n % 100 >= 3 && n % 100 <= 10) return `${n} ${few}`;
    // ١١ فما فوق: المعدود **مفردٌ منصوب** («١١ دقيقة») لا جمع.
    return `${n} ${singularNoun}`;
}

const unit = (one: string, twoNom: string, twoGen: string, few: string, singularNoun: string) =>
    (n: number, withoutSuffix: boolean) => plural(n, withoutSuffix, one, twoNom, twoGen, few, singularNoun);

/**
 * القيم بلا لاحقة: moment يضعها في `past`/`future` عند الحاجة، فلو حُشرت
 * «منذ» هنا لخرج «منذ منذ دقيقة» في المواضع التي تطلب اللاحقة.
 */
const RELATIVE_TIME = {
    future: "بعد %s",
    past: "منذ %s",
    s: "بضع ثوانٍ",
    ss: unit("ثانية واحدة", "ثانيتان", "ثانيتين", "ثوانٍ", "ثانية"),
    m: "دقيقة واحدة",
    mm: unit("دقيقة واحدة", "دقيقتان", "دقيقتين", "دقائق", "دقيقة"),
    h: "ساعة واحدة",
    hh: unit("ساعة واحدة", "ساعتان", "ساعتين", "ساعات", "ساعة"),
    d: "يوم واحد",
    dd: unit("يوم واحد", "يومان", "يومين", "أيّام", "يوماً"),
    w: "أسبوع واحد",
    ww: unit("أسبوع واحد", "أسبوعان", "أسبوعين", "أسابيع", "أسبوعاً"),
    M: "شهر واحد",
    MM: unit("شهر واحد", "شهران", "شهرين", "أشهر", "شهراً"),
    y: "عام واحد",
    yy: unit("عام واحد", "عامان", "عامين", "أعوام", "عاماً")
};

let applied = false;

/**
 * يُستدعى بعد إقلاع webpack (فـ`moment` بحثٌ كسول)، ولا يفعل شيئاً إن لم تكن
 * لغة ديسكورد عربية — فمن يستعمل إشراق بالإنجليزية لا شأن له بهذا.
 *
 * @returns `true` إن طُبّق فعلاً، ليُختبَر بلا تخمين.
 */
export function applyArabicRelativeTime(moment: unknown): boolean {
    if (applied) return true;

    const m = moment as MomentLike | undefined;
    if (typeof m?.updateLocale !== "function" || typeof m.locale !== "function") return false;

    try {
        // اللغة **النشطة** لا اسمٌ ثابت: ديسكورد قد يكون على `en-US` أو غيرها،
        // والتعديل يجب أن يُصيب ما يُستعمل فعلاً لا لغةً غير محمّلة.
        m.updateLocale(m.locale(), { relativeTime: RELATIVE_TIME });
        applied = true;
        return true;
    } catch {
        // فشلٌ هنا يعني بقاء المدّة إنجليزية — عيبٌ ظاهر لا انهيار.
        return false;
    }
}

/** للاختبار وحده: الجدول كما يراه moment. */
export const __arabicRelativeTime = RELATIVE_TIME;
