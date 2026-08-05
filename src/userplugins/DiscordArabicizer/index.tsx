/*
 * DiscordArabicizer — تعريب واجهة ديسكورد إلى العربية
 * Copyright (c) 2026 LOSTSTR
 *
 * مبنية على Equicord المرخّصة GPL-3.0-or-later وتخضع لنفس الرخصة. تعترض دوال
 * i18n.intl لترجمة نصوص واجهة ديسكورد إلى العربية، مع الإبقاء على الأسماء
 * العَلَم (الألعاب والثيمات وأسماء المستخدمين) بلغتها الأصلية.
 *
 * «اشراق / Esharq» وشعاراته وشاراته علامات محفوظة لصاحبها، ولا تشملها رخصة GPL.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin from "@utils/types";
import { i18n, React } from "@webpack/common";

import { collectMissing as rawCollect, sessionStats } from "./collector";
import { startDomFallback, stopDomFallback } from "./domFallback";
import { settings } from "./settings";
import { translations as AR } from "./translations";

// نوع معالجة كل دالة intl: نصّ بسيط (مطابقة مباشرة)، أو format، أو formatToParts،
// أو withFormatters (تُرجِع كائناً مُشتقّاً نلفّ دواله بدوره).
const METHOD_KINDS: Record<string, "string" | "format" | "parts" | "withFormatters"> = {
    string: "string",
    formatToPlainString: "string",
    formatToMarkdownString: "string",
    format: "format",
    formatToParts: "parts",
    withFormatters: "withFormatters"
};

// علامات خاصّة (Private Use Area) لاستعادة القوالب الديناميكية — لا تظهر في نصوص حقيقية.
const PH_OPEN = String.fromCharCode(0xE000);
const PH_CLOSE = String.fromCharCode(0xE001);
const PH_RE = new RegExp(PH_OPEN + "([^" + PH_CLOSE + "]+)" + PH_CLOSE, "g");

type StrFn = (msg: any, values?: any) => any;

// سجلّ ما لُفّ: لكل (مالك، اسم) نحفظ الأصل لاستعادته بدقّة عند الإيقاف.
interface PatchedEntry { owner: any; name: string; orig: (...a: any[]) => any; }
const patchedEntries: PatchedEntry[] = [];
// خريطة هوية (مالك → أسماء مَلفوفة): تمنع اللفّ المزدوج/التكرار عند مشاركة prototype.
let patchedByOwner = new WeakMap<object, Set<string>>();
let active = false;

// تطبيع: ديسكورد يستخدم فواصل/علامات اقتباس منحنية (’ ‘ “ ”) — نوحّدها بالمستقيمة
// فتُطابِق مفاتيح القاموس بصرف النظر عن شكل الفاصلة (يحلّ فئة كاملة من عدم المطابقة).
// نقصّ المسافات أيضاً: المُجمِّع كان يقصّها والبحث لا يقصّها، فأي نصّ يرسله ديسكورد
// بمسافة أو سطر زائد يفشل بحثه في القاموس ثم يُجمَع مقصوصاً — فيظهر في قائمة الناقص
// وهو مترجَم أصلاً. مفاتيح القاموس بلا مسافات زائدة، فالقصّ لا يغيّرها.
function normalize(s: string): string {
    return s.replace(/[‘’‛]/g, "'").replace(/[“”]/g, '"').trim();
}

// خريطة مُطبَّعة (مفتاح مُطبَّع → عربي) تُبنى مرّة واحدة من القاموس.
const NORM = new Map<string, string>();
for (const k of Object.keys(AR)) NORM.set(normalize(k), AR[k]);

function lookup(text: string): string | undefined {
    return NORM.get(normalize(text));
}

// عدد الترجمات في القاموس (للإحصائيات في الإعدادات).
export const translationCount = NORM.size;

// عزل ثنائي الاتجاه (bidi): نغلّف كل نصّ عربي مُترجَم بعازل RTL (RLI U+2067 … PDI U+2069)
// فيُعرَض من اليمين لليسار بصرف النظر عن اتجاه حاوية ديسكورد (كثير منها LTR فتتشوّه العربية)،
// مع بقاء أي مقطع لاتيني/رقمي بداخله (اسم/اختصار) LTR في مكانه الصحيح عبر خوارزمية bidi.
// حرفان غير مرئيّين فقط — يحلّان تشوّه ترتيب العربية المختلطة بلا أي أثر آخر.
const HAS_ARABIC = /[؀-ۿ]/;
const RLI = String.fromCharCode(0x2067); // RIGHT-TO-LEFT ISOLATE
const PDI = String.fromCharCode(0x2069); // POP DIRECTIONAL ISOLATE
function rtl(s: string): string {
    return HAS_ARABIC.test(s) ? RLI + s + PDI : s;
}

// وضع تشخيصي: يُعلّم المُترجَم بـ🟢 وغير المُترجَم بـ🔴 (للمطوّر فقط — يُطفأ عند الإطلاق).
function diag(ok: boolean, text: string): string {
    if (ok) sessionStats.hits++; else sessionStats.misses++;
    const out = ok ? rtl(text) : text; // نعزل المُترجَم فقط (غير المُترجَم إنجليزي يبقى كما هو)
    return settings.store.diagnosticMode ? (ok ? "🟢" : "🔴") + out : out;
}

// جمع النصوص غير المترجَمة للحصاد — لا يعمل تلقائياً (طلب المالك: لا تخزين خلفي صامت).
// يبدأ الجمع فقط عند تشغيل «الوضع التشخيصي». مكان واحد يُقيّد كل مواضع النداء أدناه.
function collect(text: string): void {
    if (settings.store.diagnosticMode) rawCollect(text);
}

/** استبدال المتغيّرات في قالب عربي: "لديك {count} رسالة" + { count: 3 } → "لديك 3 رسالة". */
export function formatMessage(template: string, values?: Record<string, any>): string {
    if (values == null) return template;
    return template.replace(/\{(\w+)\}/g, (m, name) =>
        Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : m);
}

// أسماء أيام الأسبوع (للطوابع الزمنية «Monday at 9:00am»).
// الصيغة المفردة للوقت النسبيّ ("an hour ago" → «منذ ساعة»).
const AGO_ONE: Record<string, string> = {
    second: "منذ ثانية", minute: "منذ دقيقة", hour: "منذ ساعة", day: "منذ يوم",
    week: "منذ أسبوع", month: "منذ شهر", year: "منذ سنة"
};

const WEEKDAYS_AR: Record<string, string> = {
    Sunday: "الأحد", Monday: "الاثنين", Tuesday: "الثلاثاء", Wednesday: "الأربعاء",
    Thursday: "الخميس", Friday: "الجمعة", Saturday: "السبت"
};

// قوالب رقمية «مخبوزة»: ديسكورد يُدمج العدد عبر صيغ الجمع ICU فيخرج النصّ جاهزاً
// ("12 Mutual Friends") — فلا يستعيده recoverTemplate ولا يُطابِق القاموس. نطابقه بنمط
// مضبوط ونُعيد صياغته بالعربية. قائمة قصيرة جداً ومُقيّدة بـ ^…$ لتفادي أي مطابقة خاطئة.
// نُبقي الاسم العَلَم (قناة/رتبة/مستخدم) بالإنجليزية ونُعرّب التسمية المحيطة فقط.
// صيغة العدد في العربية تختلف عن الإنجليزية: ١ مفرد بلا رقم، ٢ مثنى بلا رقم،
// ٣–١٠ جمع مع الرقم، ١١ فأكثر مفرد مع الرقم. من دونها يخرج "3 إشارة جديدة" وهو خطأ.
function arCount(n: number, one: string, two: string, few: string, many: string): string {
    if (n === 1) return one;
    if (n === 2) return two;
    const rest = n % 100;
    return rest >= 3 && rest <= 10 ? `${n} ${few}` : `${n} ${many}`;
}

// دورات الفوترة كما تصل مفردةً داخل جُمل الاشتراك ("every year" / "every month").
// في الصيغة المختلطة تصل نائبةً ({1}) لا كلمةً، فنُعيدها كما هي ليملأها rebuildFromTemplate.
const PERIOD_AR: Record<string, string> = {
    year: "سنة", month: "شهر", week: "أسبوع", day: "يوم"
};

const NUMERIC_PATTERNS: { re: RegExp; ar: (m: RegExpMatchArray) => string }[] = [
    // ── شارة الإشارات غير المقروءة ──
    // ديسكورد يرسلها بحروف عادية ("3 New Mentions") ويرفعها CSS إلى حروف كبيرة، فلا
    // تُطابق مفتاح "New Mentions" في القاموس لأن العدد مدموج فيها.
    {
        re: /^(\d+) New Mentions?$/,
        ar: m => arCount(+m[1], "إشارة جديدة", "إشارتان جديدتان", "إشارات جديدة", "إشارة جديدة")
    },
    // شارة العدّ غير المقروء بجانب قنوات المنتدى في الشريط الجانبي ("256 New").
    { re: /^(\d+) New$/, ar: m => `${m[1]} جديد` },
    // فاصل «الرسائل الجديدة» فوق أول رسالة غير مقروءة.
    {
        re: /^(\d+) new messages? since (.+)$/s,
        ar: m => `${arCount(+m[1], "رسالة جديدة", "رسالتان جديدتان", "رسائل جديدة", "رسالة جديدة")} منذ ${m[2]}`
    },
    // الوضع البطيء مع المدّة المدموجة.
    {
        re: /^Slowmode is enabled\. Members can send one message every (.+)\.$/,
        ar: m => `الوضع البطيء مفعّل. يمكن للأعضاء إرسال رسالة واحدة كل ${m[1]}.`
    },
    { re: /^Tomorrow at (.+)$/, ar: m => `غداً في ${m[1]}` },
    { re: /^(\d+) Mutual Friends?$/, ar: m => `${m[1]} صديق مشترك` },
    { re: /^(\d+) Mutual Servers?$/, ar: m => `${m[1]} خادم مشترك` },
    // الملف الشخصي الخاص (يبقى اسم المستخدم، مع دعم الفاصلة المنحنية والمستقيمة).
    { re: /^(.+?)['’]s profile is private, so some info is hidden\. Add them as a friend to see more\.$/, ar: m => `الملف الشخصي لـ${m[1]} خاصّ، لذا بعض المعلومات مخفيّة. أضِفه صديقاً لرؤية المزيد.` },
    { re: /^(\d+) Boosts?$/, ar: m => `${m[1]} تعزيز` },
    { re: /^(\d+)\+ Boosts?$/, ar: m => `${m[1]}+ تعزيز` },
    // نافذة «أوشكت على الوصول» للتعزيز — العدد متغيّر واسم المكافأة (يبقى كما هو).
    {
        re: /^Just (\d+) more Boosts? to help unlock (.+?) for everyone\.$/,
        ar: m => `${arCount(+m[1], "تعزيز واحد إضافي", "تعزيزان إضافيّان", "تعزيزات إضافية", "تعزيزاً إضافيّاً")} فقط لمساعدة الجميع على فتح ${m[2]}.`
    },
    // عدّاد الفعاليّات ("1 Event" / "2 Events")
    { re: /^(\d+) Events?$/, ar: m => arCount(+m[1], "فعالية واحدة", "فعاليتان", "فعاليات", "فعالية") },
    // مدّة الاشتراك بالأشهر ("2 Months")
    { re: /^(\d+) Months?$/, ar: m => arCount(+m[1], "شهر واحد", "شهران", "أشهر", "شهراً") },
    { re: /^(\d+) of (\d+) users$/, ar: m => `${m[1]} من ${m[2]} مستخدم` },
    // مدد زمنية مخبوزة (وقت تشغيل البثّ، مدّة المكالمة…) — صيغة مبسّطة مقبولة
    { re: /^(\d+) hours?$/, ar: m => `${m[1]} ساعة` },
    { re: /^(\d+) minutes?$/, ar: m => `${m[1]} دقيقة` },
    { re: /^(\d+) seconds?$/, ar: m => `${m[1]} ثانية` },
    { re: /^(\d+) days?$/, ar: m => `${m[1]} يوم` },
    // وقت نسبيّ مختصر ("25m ago")
    { re: /^(\d+)s ago$/, ar: m => `قبل ${m[1]} ثانية` },
    { re: /^(\d+)m ago$/, ar: m => `قبل ${m[1]} دقيقة` },
    { re: /^(\d+)h ago$/, ar: m => `قبل ${m[1]} ساعة` },
    { re: /^(\d+)d ago$/, ar: m => `قبل ${m[1]} يوم` },
    { re: /^(\d+)w ago$/, ar: m => `قبل ${m[1]} أسبوع` },
    { re: /^(\d+)y ago$/, ar: m => `قبل ${m[1]} سنة` },
    // وقت نسبيّ بالصيغة الطويلة ("6 hours ago") — يملأ به ديسكورد {timeAgo} في
    // "Active {timeAgo}"، فلولا هذه الأنماط يبقى «نشط 6 hours ago» مختلطاً.
    { re: /^(\d+) seconds? ago$/, ar: m => `منذ ${arCount(+m[1], "ثانية", "ثانيتين", "ثوانٍ", "ثانية")}` },
    { re: /^(\d+) minutes? ago$/, ar: m => `منذ ${arCount(+m[1], "دقيقة", "دقيقتين", "دقائق", "دقيقة")}` },
    { re: /^(\d+) hours? ago$/, ar: m => `منذ ${arCount(+m[1], "ساعة", "ساعتين", "ساعات", "ساعة")}` },
    { re: /^(\d+) days? ago$/, ar: m => `منذ ${arCount(+m[1], "يوم", "يومين", "أيام", "يوماً")}` },
    { re: /^(\d+) weeks? ago$/, ar: m => `منذ ${arCount(+m[1], "أسبوع", "أسبوعين", "أسابيع", "أسبوعاً")}` },
    { re: /^(\d+) months? ago$/, ar: m => `منذ ${arCount(+m[1], "شهر", "شهرين", "أشهر", "شهراً")}` },
    { re: /^(\d+) years? ago$/, ar: m => `منذ ${arCount(+m[1], "سنة", "سنتين", "سنوات", "سنة")}` },
    // الصيغة المفردة التي يخرجها moment.js ("an hour ago" / "a day ago").
    { re: /^an? (second|minute|hour|day|week|month|year) ago$/, ar: m => AGO_ONE[m[1]] },
    { re: /^a few seconds ago$/, ar: () => "منذ لحظات" },
    { re: /^just now$/i, ar: () => "الآن" },
    // عدّاد أسئلة الإعداد ("Questions (1/5)")
    { re: /^Questions \((\d+)\/(\d+)\)$/, ar: m => `أسئلة (${m[1]}/${m[2]})` },
    // تقدّم المهمة ("Quest progress: 0%".."99%"؛ الـ100% مفتاح في القاموس)
    { re: /^Quest progress: (\d+)%$/, ar: m => `تقدّم المهمة: ${m[1]}%` },
    // رصيد سيُطبَّق في تاريخ مخبوز ("Credit will be applied on Jun 22, 2026.") — نُبقي التاريخ كصيغة ديسكورد
    { re: /^Credit will be applied on (.+)\.$/, ar: m => `سيُطبَّق الرصيد في ${m[1]}.` },
    // جزء من جملة الاشتراك المتأخّر ("...and will end on August 21, 2026") — يصل نائبةً مستقلّة.
    { re: /^end on (.+)$/, ar: m => `ينتهي في ${m[1]}` },
    { re: /^for (\d+) months?\. Keep it with Nitro!$/, ar: m => `لمدّة ${arCount(+m[1], "شهر واحد", "شهرين", "أشهر", "شهراً")}. احتفظ به مع Nitro!` },
    // ── عدّادات مخبوزة بفواصل الآلاف (قائمة الخوادم/الاكتشاف) ──
    // هذه بالمئات في الحصاد؛ نمط واحد يغنيها كلّها بدل إضافة كل رقم للقاموس يدوياً.
    { re: /^([\d,]+) Members?$/, ar: m => `${m[1]} عضو` },
    { re: /^([\d,]+) Online$/, ar: m => `${m[1]} متصل` },
    { re: /^([\d,]+) (?:Person|People)$/, ar: m => `${m[1]} شخص` },
    { re: /^([\d,]+) servers?$/, ar: m => `${m[1]} خادم` },
    // النسخة الصغيرة من "Months" (النمط الأعلى يطابق الكبيرة فقط)
    { re: /^(\d+) months?$/, ar: m => arCount(+m[1], "شهر واحد", "شهران", "أشهر", "شهراً") },
    // «و4 آخرين» في قوائم الأسماء المختصرة
    { re: /^, and (\d+) others?$/, ar: m => `، و${m[1]} آخرين` },
    { re: /^\{0\}, \{1\}, and (\d+) others?$/, ar: m => `{0}، {1}، و${m[1]} آخرين` },
    // «يقول:» في معاينة الرسالة (يبقى اسم المستخدم كما هو)
    { re: /^(.+) says:$/, ar: m => `${m[1]} يقول:` },
    // عدّاد الأيام حتى الإسقاط التالي
    { re: /^(\d+) days? until your next$/, ar: m => `${arCount(+m[1], "يوم واحد", "يومان", "أيام", "يوماً")} حتى` },
    { re: /^(\d+) days? until your next \{0\} drop$/, ar: m => `${arCount(+m[1], "يوم واحد", "يومان", "أيام", "يوماً")} حتى إسقاط {0} التالي` },
    // ── الإعداد التمهيدي / دليل الخادم / الأذونات ──
    { re: /^Question (\d+)$/, ar: m => `السؤال ${m[1]}` },
    { re: /^Available Answers — (\d+) of (\d+)$/, ar: m => `الإجابات المتاحة — ${m[1]} من ${m[2]}` },
    { re: /^@everyone currently has (\d+) risky permissions? enabled$/, ar: m => `يملك @everyone حالياً ${m[1]} صلاحية خطرة مفعّلة` },
    { re: /^\((\d+) words?, (\d+) regexe?s?\)$/, ar: m => `(${m[1]} كلمة، ${m[2]} نمط)` },
    { re: /^\((\d+) words?\)$/, ar: m => `(${m[1]} كلمة)` },
    // ── رسائل بداية القناة / الترحيب (يبقى اسم القناة كما هو) ──
    { re: /^This is the start of the #(.+) channel\.$/, ar: m => `هذه بداية قناة #${m[1]}.` },
    { re: /^Welcome to #(.+)!$/, ar: m => `مرحباً بك في #${m[1]}!` },
    { re: /^in #(.+)$/, ar: m => `في #${m[1]}` },
    // ── ترويسات الرتب في قائمة الأعضاء (يبقى اسم الرتبة كما هو) ──
    { re: /^(.+), (\d+) members?$/, ar: m => `${m[1]}، ${m[2]} عضو` },
    // ── الملفات الشخصية / المتفرّجون (يبقى الاسم كما هو) ──
    { re: /^(.+?)['’]s profile$/, ar: m => `الملف الشخصي لـ${m[1]}` },
    // «المشاهدون» لا «المتفرّجون»: القاموس يستعمل الأولى في مفاتيح Spectators الثلاثة،
    // والنمط كان يستعمل الثانية — فما إن يعمل النمط حتى يظهر "المشاهدون - 1" بجوار
    // "المتفرّجون - 2" في الشاشة نفسها.
    { re: /^Spectators - (\d+)$/, ar: m => `المشاهدون - ${m[1]}` },
    { re: /^Created on (.+) by (.+)$/, ar: m => `أُنشئ في ${m[1]} بواسطة ${m[2]}` },
    // ── مدد / أوقات نسبية مخبوزة ──
    { re: /^For (\d+) Hours?$/, ar: m => `لمدّة ${m[1]} ساعة` },
    { re: /^in (\d+)h$/, ar: m => `خلال ${m[1]} ساعة` },
    { re: /^in (\d+)m$/, ar: m => `خلال ${m[1]} دقيقة` },
    // ── طوابع زمنية مطلقة ("Today at 9:00am" / "Monday at 9:00am") ──
    { re: /^Today at (.+)$/, ar: m => `اليوم في ${m[1]}` },
    { re: /^Yesterday at (.+)$/, ar: m => `أمس في ${m[1]}` },
    { re: /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday) at (.+)$/, ar: m => `${WEEKDAYS_AR[m[1]]} في ${m[2]}` },
    // ── طبقة الألعاب (يبقى اسم اللعبة كما هو) ──
    { re: /^Enable Overlay for (.+)$/, ar: m => `تفعيل الطبقة للعبة ${m[1]}` },
    { re: /^Enable Legacy overlay for (.+)$/, ar: m => `تفعيل الطبقة القديمة للعبة ${m[1]}` },
    // ── نشاط الصوت في قائمة الأعضاء (يبقى اسم المستخدم كما هو) ──
    { re: /^(.+) joined voice$/, ar: m => `انضم ${m[1]} إلى الصوت` },
    // ── الدولة/المنطقة (يبقى اسم الدولة بصيغة ديسكورد) ──
    { re: /^Country\/Region: (.+)$/, ar: m => `الدولة/المنطقة: ${m[1]}` },
    // ── الإعداد التمهيدي: قنوات ناقصة + عدّادا القنوات ──
    { re: /^(\d+) public channels? are missing from Questions and Default Channels\.$/, ar: m => `${m[1]} قناة عامة غير مضافة إلى الأسئلة أو القنوات الافتراضية.` },
    { re: /^(\d+) CHATTABLE$/, ar: m => `${m[1]} قابلة للدردشة` },
    { re: /^(\d+) TOTAL$/, ar: m => `${m[1]} الإجمالي` },
    // ── المهام والمتجر: استلام الزينة، تواريخ الانتهاء، الأسعار (تبقى العملة/التاريخ بصيغة ديسكورد) ──
    { re: /^\{0\} claimed on (\d+\/\d+)$/, ar: m => `{0} استُلمت في ${m[1]}` },
    { re: /^claimed on (\d+\/\d+)$/, ar: m => `استُلمت في ${m[1]}` },
    { re: /^Ends (\d+\/\d+)$/, ar: m => `تنتهي في ${m[1]}` },
    { re: /^Price: (.+) after (\d+)% discount$/, ar: m => `السعر: ${m[1]} بعد خصم ${m[2]}%` },
    { re: /^Price: (.+)$/, ar: m => `السعر: ${m[1]}` },
    { re: /^(.+) has been added to your collection\.$/, ar: m => `أُضيفت ${m[1]} إلى مجموعتك.` },
    // ── تعليمات المهام (يبقى اسم اللعبة/العملة كما هو) ──
    { re: /^for (\d+) minutes and win (\d+) Orbs\.$/, ar: m => `لمدة ${m[1]} دقيقة واربح ${m[2]} Orbs.` },
    { re: /^for (\d+) minutes with your Discord client open and win (\d+) Orbs\.$/, ar: m => `لمدة ${m[1]} دقيقة مع فتح عميل ديسكورد واربح ${m[2]} Orbs.` },
    { re: /^Use (.+) for (\d+) minutes with your Discord client open and win (\d+) Orbs\.$/, ar: m => `استخدم ${m[1]} لمدة ${m[2]} دقيقة مع فتح عميل ديسكورد واربح ${m[3]} Orbs.` },
    { re: /^Watch the video to win (\d+) Orbs!$/, ar: m => `شاهد الفيديو واربح ${m[1]} Orbs!` },
    // ── سجلّ المكالمات (يبقى اسم المتصل كما هو) ──
    { re: /^\{0\} started a call that lasted (\d+) minutes?\.$/, ar: m => `بدأ {0} مكالمة استمرت ${m[1]} دقيقة.` },
    { re: /^started a call that lasted (\d+) minutes?\.$/, ar: m => `بدأ مكالمة استمرت ${m[1]} دقيقة.` },
    // ── عودة صديق بعد غياب ──
    { re: /^Returning after (\d+) months?$/, ar: m => `عائد بعد ${m[1]} شهر` },
    // ── بدايات القنوات: النسخ المبتورة/ذات {0} التي لا يغطيها نمط "channel." الكامل ──
    { re: /^This is the start of the #(.+) channel\. \{0\}$/, ar: m => `هذه بداية قناة #${m[1]}. {0}` },
    { re: /^This is the start of the #(.+)$/, ar: m => `هذه بداية قناة #${m[1]}` },
    // ── تسمية منطقة الدردشة لقارئ الشاشة ("X chat" — يبقى اسم القناة كما هو) ──
    { re: /^(.+) chat$/, ar: m => `دردشة ${m[1]}` },
    // ── إعداد الأمان: "N of M enabled" + متجر الخادم + مزايا التعزيز (يبقى اسم اللعبة/الحجم) ──
    { re: /^(\d+) of (\d+) enabled$/, ar: m => `مفعّل ${m[1]} من ${m[2]}` },
    { re: /^Explore the latest drops from (.+)!$/, ar: m => `استكشف أحدث الإصدارات من ${m[1]}!` },
    { re: /^Let everyone share bigger files in this server, up to (\d+)MB\.$/, ar: m => `دَع الجميع يشاركون ملفات أكبر في هذا الخادم، حتى ${m[1]}MB.` },
    // ── مشاركة النشاط / رؤية الملف الشخصي (العدد متغيّر) ──
    { re: /^You may be sharing activity from (\d+) games you play, including$/, ar: m => `قد تشارك نشاط ${m[1]} لعبة تلعبها، منها` },
    { re: /^Your full profile is visible to friends and any server you join with (\d+) or fewer members\. Everyone else sees a limited version\.$/, ar: m => `ملفك الشخصي الكامل ظاهر لأصدقائك ولأي خادم تنضمّ إليه بـ${m[1]} عضواً أو أقل. أما البقية فيرون نسخة محدودة.` },
    { re: /^Your activity is shared with friends and any server you join with (\d+) or fewer members\.$/, ar: m => `يُشارَك نشاطك مع أصدقائك ومع أي خادم تنضمّ إليه بـ${m[1]} عضواً أو أقل.` },
    { re: /^Show (\d+) more items?$/, ar: m => `عرض ${m[1]} عنصراً إضافياً` },
    // بطاقة نشاط البثّ: العدد مخبوز في النصّ فيلزمه نمط لا مدخل قاموس.
    { re: /^In a party of (\d+)$/, ar: m => `في مجموعة من ${m[1]}` },
    // ── عدّادات وأسماء مخبوزة (طلبات الصداقة · الطرد · تفويض التطبيقات) ──
    { re: /^\+ (\d+) more$/, ar: m => `+${m[1]} أخرى` },
    { re: /^(\d+) others$/, ar: m => `${m[1]} آخرين` },
    { re: /^Pending, (\d+) new$/, ar: m => `قيد الانتظار، ${m[1]} جديد` },
    { re: /^Used in ([\d,]+) servers$/, ar: m => `مُستخدَم في ${m[1]} خادم` },
    { re: /^Active since (.+)$/, ar: m => `نشِط منذ ${m[1]}` },
    { re: /^This will allow the developer of (.+) to:$/, ar: m => `سيتيح هذا لمطوّر ${m[1]} أن:` },
    { re: /^Are you sure you want to kick @(.+) from the server\? They will be able to rejoin again with a new invite\.$/, ar: m => `هل تريد فعلاً طرد @${m[1]} من الخادم؟ سيتمكّن من الانضمام مجدّداً بدعوة جديدة.` },
    // ── متجر Nitro والمنشورات: العدد أو الوقت مخبوز في النصّ ──
    { re: /^(\d+) Orbs$/, ar: m => `${m[1]} Orbs` },
    { re: /^(\d+) Orbs earned$/, ar: m => `رُبِحت ${m[1]} Orbs` },
    { re: /^Watch the video to win (\d+) Orbs!$/, ar: m => `شاهِد الفيديو لتربح ${m[1]} Orbs!` },
    { re: /^for (\d+) minutes and win (\d+) Orbs\.$/, ar: m => `لمدّة ${m[1]} دقيقة وتربح ${m[2]} Orbs.` },
    { re: /^for (\d+) minutes with your Discord client open and win (\d+) Orbs\.$/, ar: m => `لمدّة ${m[1]} دقيقة مع إبقاء ديسكورد مفتوحاً وتربح ${m[2]} Orbs.` },
    { re: /^(\d+) Active Posts?$/, ar: m => arCount(+m[1], "منشور نشِط واحد", "منشوران نشِطان", "منشورات نشِطة", "منشوراً نشِطاً") },
    { re: /^(\d+)\+ new messages since (.+)$/, ar: m => `أكثر من ${m[1]} رسالة جديدة منذ ${m[2]}` },
    // أصوات التصويت + تذكيرات متأخّرة + خصم مستقل
    { re: /^(\d+) votes?$/, ar: m => arCount(+m[1], "صوت واحد", "صوتان", "أصوات", "صوتاً") },
    { re: /^(\d+) overdue reminders?$/, ar: m => arCount(+m[1], "تذكير متأخّر واحد", "تذكيران متأخّران", "تذكيرات متأخّرة", "تذكيراً متأخّراً") },
    { re: /^(\d+)% discount$/, ar: m => `خصم ${m[1]}%` },
    { re: /^(.+), NaN members$/, ar: m => `${m[1]}، الأعضاء` },
    { re: /^You have NaN days left to get (.+) off Nitro Yearly$/, ar: m => `بقيت لك أيام للحصول على خصم ${m[1]} على Nitro السنوي` },
    // ── عدّادات صفحات الخصوصية والارتباطات (العدد مخبوز في النصّ) ──
    { re: /^(\d+) Permissions? enabled$/, ar: m => arCount(+m[1], "إذن واحد مفعّل", "إذنان مفعّلان", "أذونات مفعّلة", "إذناً مفعّلاً") },
    { re: /^(\d+) accounts?$/, ar: m => arCount(+m[1], "حساب واحد", "حسابان", "حسابات", "حساباً") },
    { re: /^(\d+) connections?$/, ar: m => arCount(+m[1], "ارتباط واحد", "ارتباطان", "ارتباطات", "ارتباطاً") },
    { re: /^You may also be sharing activity from (\d+) games you play, including$/, ar: m => `قد تشارك أيضاً نشاط ${m[1]} لعبة تلعبها، منها` },
    // ── إقرار الاشتراك المتجدّد (السعر والتاريخ والدورة مخبوزة → لا يصلح مفتاح قاموس) ──
    // يصل بصيغتين: نصّاً كاملاً، أو قالباً مختلطاً فيه نائبتان ({0} زرّ التأكيد، {1} الدورة)؛
    // نمط واحد يغطّيهما لأنّ PERIOD_AR يُعيد النائبة كما هي حين لا تكون كلمة دورة.
    {
        re: /^By clicking ['‘’](.+?)['‘’], you are signing up for a recurring subscription\. You['‘’]ll be charged (.+?) today, then (.+?) plus applicable taxes every (\S+) starting (.+?) until you cancel\. Prices subject to change\. Cancel anytime in your Settings\.$/,
        ar: m => `بالنقر على «${lookup(m[1]) ?? m[1]}»، أنت تشترك في اشتراك متجدّد تلقائياً. سيُخصم منك ${m[2]} اليوم، ثم ${m[3]} زائد الضرائب المطبَّقة كل ${PERIOD_AR[m[4]] ?? m[4]} ابتداءً من ${m[5]} حتى تُلغي. الأسعار عرضة للتغيير. يمكنك الإلغاء في أي وقت من الإعدادات.`
    },
    // شارة التوفير على الخطّة السنوية ("2 months free!")
    { re: /^(\d+) months? free!$/, ar: m => `${arCount(+m[1], "شهر واحد", "شهران", "أشهر", "شهراً")} مجاناً!` },
    // سطر التسويات في فاتورة الشراء (المبلغ مخبوز)
    { re: /^Total adjustments (.+)$/, ar: m => `إجمالي التسويات ${m[1]}` },
    // تاريخ تأسيس الخادم في بطاقته ("Est. Oct 2024") — يبقى التاريخ بصيغة ديسكورد
    { re: /^Est\. (.+)$/, ar: m => `تأسّس ${m[1]}` },
    // مدد قصيرة في قوائم الإشراف الآلي/الوضع البطيء
    { re: /^\((\d+) secs?\)$/, ar: m => `(${m[1]} ثانية)` },
    { re: /^(\d+) secs?$/, ar: m => `${m[1]} ثانية` },
    { re: /^(\d+)-day$/, ar: m => `${m[1]} يوماً` },
    // اسم قاعدة الإشراف الآلي في قائمة السياق ("Filter (1 Word)")
    { re: /^Filter \((\d+) Words?\)$/, ar: m => `تصفية (${m[1]} كلمة)` },

    // ── دفعة ٥١: عدّادات نتائج البحث والوسائط ──
    // «38,179 Results» — الفاصلة جزء من الرقم فتُلتقط معه
    { re: /^([\d,]+) Results?$/, ar: m => `${m[1]} نتيجة` },
    { re: /^(\d+) Messages? ›$/, ar: m => `${m[1]} رسالة ›` },
    { re: /^(\d+) lines?$/, ar: m => `${m[1]} سطر` },
    { re: /^(\d+) images?$/, ar: m => `${m[1]} صورة` },
    { re: /^Uploading (\d+) Files?$/, ar: m => `جارٍ رفع ${m[1]} ملف` },
    { re: /^Filters \((\d+)\)$/, ar: m => `المرشّحات (${m[1]})` },
    // عدّاد تنازلي مضغوط في المهامّ («14D 18H»)
    { re: /^(\d+)D (\d+)H$/, ar: m => `${m[1]} يوم و${m[2]} ساعة` },
    { re: /^Want to make it easier to follow this chain of (\d+) replies\?$/, ar: m => `أتريد تسهيل متابعة سلسلة الردود هذه البالغة ${m[1]} ردود؟` },

    // ⚠️ يمرّر ديسكورد أحياناً NaN بدل العدد (خلل عنده) — نقبله كما هو بدل أن يبقى السطر إنجليزيّاً
    { re: /^(.+?), (.+?), and (\d+|NaN) others are currently in voice$/, ar: m => `${m[1]} و${m[2]} و${m[3]} آخرون في الصوت حالياً` },
    { re: /^(.+?), (.+?), (.+?), and (\d+|NaN) others$/, ar: m => `${m[1]} و${m[2]} و${m[3]} و${m[4]} آخرون` },
    { re: /^Added (.+?)\. (\d+|NaN) recipients selected\.$/, ar: m => `أُضيف ${m[1]}. ${m[2]} مستلماً محدَّداً.` },
    { re: /^(\d+|NaN) mentions, (.+?) \(announcement channel\)$/, ar: m => `${m[1]} إشارة، ${m[2]} (قناة إعلانات)` },
    { re: /^You have (\d+|NaN) hours? left to get (.+?) off Nitro Yearly$/, ar: m => `أمامك ${m[1]} ساعة للحصول على خصم ${m[2]} على نيترو السنوي` }
];

function numericTemplate(text: string): string | null {
    for (const { re, ar } of NUMERIC_PATTERNS) {
        const m = text.match(re);
        if (m != null) return ar(m);
    }
    return null;
}

/** يكشف كل الدوال المتاحة على كائن intl (own + prototype) لنعرف ماذا نلفّ بلا تخمين. */
function discoverMethods(intl: any): string[] {
    const names = new Set<string>();
    let obj = intl;
    for (let depth = 0; obj != null && depth < 4; depth++) {
        for (const k of Object.getOwnPropertyNames(obj)) {
            try {
                if (typeof intl[k] === "function") names.add(k);
            } catch { /* getters قد ترمي — تجاهل */ }
        }
        obj = Object.getPrototypeOf(obj);
    }
    return [...names];
}

// هل كل قيم النصّ الديناميكي بسيطة (لا عناصر React)؟ (الغنيّة تمرّ عبر formatToParts)
function allPrimitive(values: any): boolean {
    for (const k of Object.keys(values)) {
        const v = values[k];
        if (v != null && (typeof v === "object" || typeof v === "function")) return false;
    }
    return true;
}

/** يستعيد القالب الديناميكي بإدخال علامات مكان القيم: "View 132 Members" → "View {count} Members". */
function recoverTemplate(orig: StrFn, msg: any, realValues: any): string | null {
    try {
        const marker = new Proxy(realValues, {
            get(target, prop) {
                if (typeof prop === "symbol") return (target as any)[prop];
                return PH_OPEN + String(prop) + PH_CLOSE;
            }
        });
        const out = orig(msg, marker);
        if (typeof out !== "string" || out.indexOf(PH_OPEN) === -1) return null;
        return out.replace(PH_RE, (_, k) => `{${k}}`);
    } catch {
        return null;
    }
}

// يُعيد بناء مصفوفة الأجزاء من ترجمة فيها نوائب {0}، مع إدراج العناصر الأصلية في مكانها.
// ── ترجمة النصّ داخل النوائب (عناصر React) ───────────────────────────────────
// rebuildFromTemplate كان يُدرج النوائب كما هي. فإن كانت النائبة عنصر React يحوي
// نصّاً إنجليزيّاً (‎<strong>past due</strong>‎ أو رابط "Learn more") بقي إنجليزيّاً
// وسط جملة عربية — وهذا ما ظهر في صفحة الاشتراكات:
//   «اشتراكك past due وسوف end on August 21, 2026. Learn more.»
// القالب نفسه كان مُترجَماً، والمفتاح "Learn more" موجوداً في القاموس؛ العطب أن
// محتوى النائبة لم يُمَسّ أصلاً. نترجم هنا أبناء العنصر النصّيين باستنساخه
// (عناصر React غير قابلة للتعديل في مكانها) مع حدّ عمق يمنع أي تكرار غير منتهٍ.
function translateNode(node: any, depth = 0): any {
    if (depth > 4 || node == null) return node;

    if (typeof node === "string") {
        const core = node.trim();
        if (core.length < 2) return node;
        const ar = lookup(core) ?? numericTemplate(core);
        if (ar == null) { collect(core); return node; }
        return node.replace(core, ar); // نحافظ على المسافات المحيطة
    }

    if (Array.isArray(node)) {
        let changed = false;
        const out = node.map(n => {
            const r = translateNode(n, depth + 1);
            if (r !== n) changed = true;
            return r;
        });
        return changed ? out : node;
    }

    const kids = node?.props?.children;
    if (kids == null) return node;
    const newKids = translateNode(kids, depth + 1);
    if (newKids === kids) return node;
    try { return React.cloneElement(node, undefined, newKids); } catch { return node; }
}

function rebuildFromTemplate(translated: string, placeholders: any[]): any[] {
    const result: any[] = [];
    const re = /\{(\d+)\}/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(translated)) != null) {
        if (m.index > last) result.push(translated.slice(last, m.index));
        result.push(translateNode(placeholders[Number(m[1])] ?? ""));
        last = m.index + m[0].length;
    }
    if (last < translated.length) result.push(translated.slice(last));
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// منطق الترجمة المشترك (يُستخدَم على intl الأساسي وعلى الكائنات الناتجة عن withFormatters)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * يترجم قيم العناصر النائبة التي تُطابق نمطاً رقمياً قبل حقنها في القالب.
 * ضروري لأنّ "Active {timeAgo}" يُترجَم إلى «نشط {timeAgo}»، لكن ديسكورد يملأ
 * timeAgo بالنصّ الإنجليزي «6 hours ago» فيخرج «نشط 6 hours ago» مختلطاً.
 * نقتصر على numericTemplate (أنماط مُثبَّتة بـ ^…$: وقت/عدّ) حتى لا نُترجم اسم
 * مستخدم أو قناة يُمرَّر كقيمة {user}/{channel}.
 */
function translateValues(values: any): any {
    if (values == null || typeof values !== "object") return values;
    let out: Record<string, any> | null = null;
    for (const k in values) {
        const v = values[k];
        if (typeof v !== "string") continue;
        const tr = numericTemplate(v.trim());
        if (tr != null) (out ??= { ...values })[k] = tr;
    }
    return out ?? values;
}

function translateString(orig: StrFn, msg: any, values: any, methodName: string): any {
    const out = orig(msg, values);
    if (typeof out !== "string") return out;

    const direct = lookup(out);
    if (direct != null) return diag(true, direct);

    // استعادة قالب ديناميكي ("Kick sd.9" → "Kick {user}") لدوال النصّ أيضاً، لا format فقط —
    // فقوائم سياق الأعضاء (Kick/Ban/Timeout {اسم}) تمرّ عبر string/formatToPlainString.
    if (values != null && typeof values === "object" && allPrimitive(values)) {
        const tmpl = recoverTemplate(orig, msg, values);
        if (tmpl != null && tmpl !== out) {
            const arTmpl = lookup(tmpl);
            if (arTmpl != null) return diag(true, formatMessage(arTmpl, translateValues(values)));
            collect(tmpl);
            return diag(false, out);
        }
    }

    // قوالب رقمية مخبوزة (Mutual Friends/Servers، Boosts، عدد المستخدمين) — تُطابَق بنمط.
    const num = numericTemplate(out);
    if (num != null) return diag(true, num);

    collect(out);
    if (settings.store.logMissingKeys) {
        console.log(`[DiscordArabicizer DEBUG] ${methodName} (غير مترجَم):`, JSON.stringify(out));
    }
    return diag(false, out);
}

// منطق مشترك لترجمة مصفوفة أجزاء (نصّ + عناصر React) — يخدم format و formatToParts معاً.
// كلاهما قد يُرجِع مصفوفة للأوصاف الغنيّة بروابط؛ نوحّد المعالجة هنا لتفادي التكرار/الفجوات.
function translatePartsArray(parts: any[]): any {
    if (parts.length === 0) return parts;

    // (أ) كل الأجزاء نصّية → نترجم النصّ المُجمَّع.
    if (parts.every(p => typeof p === "string")) {
        const joined = parts.join("");
        const ar = lookup(joined);
        if (ar != null) return [diag(true, ar)];
        // Baked-number strings ("3 New Mentions", "257 New") arrive here as all-string parts.
        // This was the ONE translation path that skipped the numeric patterns, so those
        // badges stayed English despite matching a pattern. Trimmed because the patterns are
        // ^…$-anchored and the joined text may carry surrounding whitespace.
        const num = numericTemplate(joined.trim());
        if (num != null) return [diag(true, num)];
        collect(joined);
        return settings.store.diagnosticMode ? [diag(false, joined)] : parts;
    }

    // (ب) أجزاء مختلطة — القالب الكامل أولاً (نصّ + نوائب {0}).
    let template = "";
    const placeholders: any[] = [];
    for (const p of parts) {
        if (typeof p === "string") template += p;
        else { template += `{${placeholders.length}}`; placeholders.push(p); }
    }
    const arTmpl = lookup(template);
    if (arTmpl != null) return rebuildFromTemplate(arTmpl, placeholders);

    // نمط رقمي على *القالب* نفسه: القوالب المختلطة التي فيها سعر/تاريخ/عدد مخبوز لا تصلح
    // مفاتيحَ قاموس (القيمة تتغيّر)، وكان هذا المسار الوحيد الذي لا يجرّب الأنماط — فتُقطَّع
    // الجملة إلى شظايا في المسار (ج) ويخرج ترتيبها العربي مقلوباً. الأنماط التي تُنتج {0}
    // موجودة أصلاً في القائمة أعلاه، وهذا يجعلها تعمل هنا أيضاً بترتيب صحيح.
    const numTmpl = numericTemplate(template);
    if (numTmpl != null) return rebuildFromTemplate(numTmpl, placeholders);

    // (ج) ترجمة كل جزء نصّي على حدة (يحلّ الأوصاف ذات الروابط)، مع حفظ المسافات والعناصر.
    let changed = false;
    const perPart = parts.map(p => {
        // العناصر (روابط/عريض) قد تحوي نصّاً إنجليزيّاً بدورها — نفس عطب النوائب أعلاه.
        if (typeof p !== "string") {
            const r = translateNode(p);
            if (r !== p) changed = true;
            return r;
        }
        const mt = p.match(/^(\s*)([\s\S]*?)(\s*)$/);
        const lead = mt?.[1] ?? "";
        const core = mt?.[2] ?? p;
        const trail = mt?.[3] ?? "";
        if (core.length < 2) return p;
        const t = lookup(core);
        if (t != null) { changed = true; return lead + t + trail; }
        // احتياطي الأنماط الرقمية — كان مستدعىً في translateString وtranslateFormat وغائباً
        // عن هذا المسار وحده. فكانت نصوص مثل "Spectators - 2" الواصلة ضمن مصفوفة أجزاء
        // تُجمَع «مفقودةً» رغم وجود نمطها، فعُولجت بإضافة كل رقم للقاموس يدوياً (0 ثمّ 1…)
        // — وهي مطاردة لا تنتهي: كل عدد جديد يعود بالإنجليزية حتى يُضاف بيده.
        const num = numericTemplate(core);
        if (num != null) { changed = true; return lead + num + trail; }
        collect(core); // اجمع الجملة المفقودة نفسها (أنفع للحصاد من جمع القالب)
        return p;
    });
    if (changed) return perPart;

    collect(template);
    return settings.store.diagnosticMode ? ["🔴", ...parts] : parts;
}

function translateFormat(orig: StrFn, msg: any, values: any): any {
    const out = orig(msg, values);

    // (1) ناتج مصفوفة: نصّ غنيّ بروابط (الأوصاف تحت الخيارات) — نمرّره عبر منطق الأجزاء.
    if (Array.isArray(out)) return translatePartsArray(out);

    if (typeof out !== "string") return out;

    // (2) ناتج نصّي بسيط — مطابقة مباشرة ثمّ استعادة قالب ديناميكي.
    const direct = lookup(out);
    if (direct != null) return diag(true, direct);

    if (values != null && typeof values === "object" && allPrimitive(values)) {
        const tmpl = recoverTemplate(orig, msg, values);
        if (tmpl != null && tmpl !== out) {
            const arTmpl = lookup(tmpl);
            if (arTmpl != null) return diag(true, formatMessage(arTmpl, translateValues(values)));
            collect(tmpl);
            return diag(false, out);
        }
    }

    // قوالب رقمية مخبوزة (تظهر أيضاً عبر دالة format لا string فقط) — تُطابَق بنمط.
    const num = numericTemplate(out);
    if (num != null) return diag(true, num);

    collect(out);
    return diag(false, out);
}

function translateParts(orig: StrFn, msg: any, values: any): any {
    const parts = orig(msg, values);
    if (!Array.isArray(parts)) return parts;
    return translatePartsArray(parts);
}

// ─────────────────────────────────────────────────────────────────────────────
// لفّ دوال intl على «مالكها» الفعلي (الكائن نفسه أو الـprototype). لفّ الـprototype
// يُترجِم رجعياً كل الكائنات المشتركة فيه — بما فيها المُنسِّقات المُخزَّنة التي أنشأتها
// وحدات ديسكورد عبر withFormatters قبل التفعيل (سبب رجوع بعض النصوص للإنجليزية).
// كل نداء داخل try/catch → أي خطأ يُرجِع الأصل فوراً (لا شاشة بيضاء، لا تعطّل).
// ─────────────────────────────────────────────────────────────────────────────

// يجد الكائن الذي يملك الدالة فعلياً (الكائن نفسه أو أحد آبائه في سلسلة prototype).
function findOwner(obj: any, name: string): any | null {
    for (let o = obj, depth = 0; o != null && depth < 8; o = Object.getPrototypeOf(o), depth++) {
        if (Object.prototype.hasOwnProperty.call(o, name) && typeof o[name] === "function") return o;
    }
    return null;
}

function isPatched(owner: object, name: string): boolean {
    return patchedByOwner.get(owner)?.has(name) === true;
}

function markPatched(owner: object, name: string) {
    let names = patchedByOwner.get(owner);
    if (names == null) { names = new Set(); patchedByOwner.set(owner, names); }
    names.add(name);
}

// علامة على ملفوفاتنا — تمنع اللفّ المزدوج وتُتيح التشخيص عبر intl.string.__arabicizerPatched.
const PATCH_MARK = "__arabicizerPatched";

// يبني ملفوفاً this-aware محميّاً بـtry/catch حول الدالة الأصلية المُعطاة، موسوماً بعلامتنا.
function makeWrapper(origRaw: (...a: any[]) => any, name: string, kind: "string" | "format" | "parts" | "withFormatters"): (...a: any[]) => any {
    let wrapper: (...a: any[]) => any;
    if (kind === "withFormatters") {
        wrapper = function (this: any, ...args: any[]) {
            const result = origRaw.apply(this, args); // الأصل أولاً (سلوك مطابق)
            // الكائن الناتج: نلفّ دواله بالآلية نفسها (dedup يمنع التكرار/اللفّ المزدوج).
            if (result != null && typeof result === "object") {
                try { patchIntlObject(result); }
                catch (e) { if (settings.store.logErrors) console.debug("[DiscordArabicizer] withFormatters patch error:", e); }
            }
            return result;
        };
    } else {
        wrapper = function (this: any, msg: any, values?: any) {
            const boundOrig: StrFn = (m, v) => origRaw.call(this, m, v); // this الفعلي (يدعم المشتقّات)
            try {
                // خطّاف تشخيص اختياري: يعمل فقط أثناء تسجيل EsharqDiagnostics (الخطّاف العام
                // موجود)، وإلا فالمسار مطابق تماماً للأصل عدا قراءة خاصّية واحدة — صفر تكلفة فعلياً.
                const prof = (globalThis as any).__esharqProf;
                if (prof) {
                    const t0 = performance.now();
                    const r = kind === "string" ? translateString(boundOrig, msg, values, name)
                        : kind === "format" ? translateFormat(boundOrig, msg, values)
                            : translateParts(boundOrig, msg, values);
                    prof.hit("DiscordArabicizer.intl." + name, performance.now() - t0);
                    return r;
                }
                if (kind === "string") return translateString(boundOrig, msg, values, name);
                if (kind === "format") return translateFormat(boundOrig, msg, values);
                return translateParts(boundOrig, msg, values); // "parts"
            } catch (e) {
                if (settings.store.logErrors) console.debug(`[DiscordArabicizer] translate error in ${name}:`, e);
                return origRaw.call(this, msg, values); // أمان مطلق: أي خطأ → الأصل
            }
        };
    }
    (wrapper as any)[PATCH_MARK] = true;
    return wrapper;
}

// ترقيع «لاصق»: نلفّ الدالة على مالكها عبر defineProperty (get/set). لو أعاد ديسكورد
// إسناد الدالة لاحقاً (سبب ارتداد بعض النصوص للإنجليزية بعد فترة) يلتقطها الـsetter
// ويلفّ الجديدة فوراً — فيبقى التعريب ثابتاً مع الوقت.
function patchMethod(intlLike: any, name: string) {
    const kind = METHOD_KINDS[name];
    if (kind == null) return;
    const owner = findOwner(intlLike, name);
    if (owner == null || isPatched(owner, name)) return;

    const origRaw = owner[name] as (...a: any[]) => any;
    let wrapped = makeWrapper(origRaw, name, kind);

    try {
        Object.defineProperty(owner, name, {
            configurable: true,
            enumerable: true,
            get() { return wrapped; },
            set(v) {
                // إن كان المُسنَد ملفوفنا أصلاً نُبقيه؛ وإلا نلفّ الجديد (يصمد أمام إعادة الإسناد).
                wrapped = (typeof v === "function" && (v as any)[PATCH_MARK]) ? v : makeWrapper(v, name, kind);
            }
        });
    } catch (e) {
        if (settings.store.logErrors) console.debug(`[DiscordArabicizer] defineProperty failed for ${name}:`, e);
        return; // غير قابل لإعادة التعريف (مجمّد) — نتركه دون لفّ (لا ضرر)
    }
    patchedEntries.push({ owner, name, orig: origRaw });
    markPatched(owner, name);
}

function patchIntlObject(intlLike: any) {
    for (const name of Object.keys(METHOD_KINDS)) patchMethod(intlLike, name);
}

function applyPatch() {
    if (active) return;
    const intl = (i18n as any).intl;
    if (intl == null || typeof intl.string !== "function") {
        console.warn("[DiscordArabicizer] تعذّر إيجاد نظام intl في ديسكورد — أُلغي التطبيق.");
        return;
    }

    console.log("[DiscordArabicizer] دوال intl المتاحة:", discoverMethods(intl).join(", "));
    patchIntlObject(intl);

    // تشخيص: أين لُفّت كل دالة (own = على الكائن نفسه، proto = على النموذج الأولي).
    console.log("[DiscordArabicizer] i18n.intl patched (prototype-aware). لُفّت:",
        patchedEntries.map(e => `${e.name}[${e.owner === intl ? "own" : "proto"}]`).join(", "));

    // طبقة احتياطية للنصوص التي تتجاوز intl (تُفعَّل بالخيار، تُفصَل عند الإيقاف).
    if (settings.store.domFallback) startDomFallback();
    active = true;
}

function removePatch() {
    if (!active) return;
    stopDomFallback();
    // استعادة عكسية (الأحدث أولاً): نُعيد كل خاصية إلى «قيمة بيانات» عادية بأصلها بالضبط.
    // (الإسناد العادي owner[name]=orig سيستدعي الـsetter لا يستعيد — لذا defineProperty.)
    for (let i = patchedEntries.length - 1; i >= 0; i--) {
        const { owner, name, orig } = patchedEntries[i];
        try {
            Object.defineProperty(owner, name, { value: orig, writable: true, configurable: true, enumerable: true });
        } catch { /* تجاهل */ }
    }
    patchedEntries.length = 0;
    patchedByOwner = new WeakMap(); // إفراغ خريطة الهوية
    active = false;
}

export default definePlugin({
    name: "DiscordArabicizer",
    description: t(
        "تعريب شامل لواجهة ديسكورد إلى العربية — من تطوير اشراق.",
        "Comprehensive Arabic localization of Discord's UI — by Esharq."
    ),
    authors: [EquicordDevs.LOSTSTR],
    settings,
    // الترقيع يلفّ دوال i18n.intl؛ يجب أن يكون حاضراً من بداية الجلسة قبل أن تلتقط وحدات
    // ديسكورد مراجع تلك الدوال أو ترسم نصوصها — وإلا بقيت بعض النصوص إنجليزية. لذا نطلب
    // إعادة التشغيل عند تبديل الإضافة فلا تُطبَّق وسط الجلسة (تطبيقاً جزئياً غير ثابت).
    restartNeeded: true,

    start() {
        console.log("[DiscordArabicizer] Plugin loaded.");
        if (!settings.store.enabled) return;
        applyPatch();
    },

    stop() {
        removePatch();
    }
});
