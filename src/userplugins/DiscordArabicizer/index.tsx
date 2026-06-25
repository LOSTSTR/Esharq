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
import { i18n } from "@webpack/common";

import { collectMissing as rawCollect } from "./collector";
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
function normalize(s: string): string {
    return s.replace(/[‘’‛]/g, "'").replace(/[“”]/g, '"');
}

// خريطة مُطبَّعة (مفتاح مُطبَّع → عربي) تُبنى مرّة واحدة من القاموس.
const NORM = new Map<string, string>();
for (const k of Object.keys(AR)) NORM.set(normalize(k), AR[k]);

function lookup(text: string): string | undefined {
    return NORM.get(normalize(text));
}

// عدد الترجمات في القاموس (للإحصائيات في الإعدادات).
export const translationCount = NORM.size;

// وضع تشخيصي: يُعلّم المُترجَم بـ🟢 وغير المُترجَم بـ🔴 (للمطوّر فقط — يُطفأ عند الإطلاق).
function diag(ok: boolean, text: string): string {
    return settings.store.diagnosticMode ? (ok ? "🟢" : "🔴") + text : text;
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
const WEEKDAYS_AR: Record<string, string> = {
    Sunday: "الأحد", Monday: "الاثنين", Tuesday: "الثلاثاء", Wednesday: "الأربعاء",
    Thursday: "الخميس", Friday: "الجمعة", Saturday: "السبت"
};

// قوالب رقمية «مخبوزة»: ديسكورد يُدمج العدد عبر صيغ الجمع ICU فيخرج النصّ جاهزاً
// ("12 Mutual Friends") — فلا يستعيده recoverTemplate ولا يُطابِق القاموس. نطابقه بنمط
// مضبوط ونُعيد صياغته بالعربية. قائمة قصيرة جداً ومُقيّدة بـ ^…$ لتفادي أي مطابقة خاطئة.
// نُبقي الاسم العَلَم (قناة/رتبة/مستخدم) بالإنجليزية ونُعرّب التسمية المحيطة فقط.
const NUMERIC_PATTERNS: { re: RegExp; ar: (m: RegExpMatchArray) => string }[] = [
    { re: /^(\d+) Mutual Friends$/, ar: m => `${m[1]} صديق مشترك` },
    { re: /^(\d+) Mutual Servers$/, ar: m => `${m[1]} خادم مشترك` },
    { re: /^(\d+) Boosts?$/, ar: m => `${m[1]} تعزيز` },
    { re: /^(\d+)\+ Boosts?$/, ar: m => `${m[1]}+ تعزيز` },
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
    // عدّاد أسئلة الإعداد ("Questions (1/5)")
    { re: /^Questions \((\d+)\/(\d+)\)$/, ar: m => `أسئلة (${m[1]}/${m[2]})` },
    // تقدّم المهمة ("Quest progress: 0%".."99%"؛ الـ100% مفتاح في القاموس)
    { re: /^Quest progress: (\d+)%$/, ar: m => `تقدّم المهمة: ${m[1]}%` },
    // رصيد سيُطبَّق في تاريخ مخبوز ("Credit will be applied on Jun 22, 2026.") — نُبقي التاريخ كصيغة ديسكورد
    { re: /^Credit will be applied on (.+)\.$/, ar: m => `سيُطبَّق الرصيد في ${m[1]}.` },
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
    { re: /^Spectators - (\d+)$/, ar: m => `المتفرّجون - ${m[1]}` },
    { re: /^Created on (.+) by (.+)$/, ar: m => `أُنشئ في ${m[1]} بواسطة ${m[2]}` },
    // ── مدد / أوقات نسبية مخبوزة ──
    { re: /^For (\d+) Hours?$/, ar: m => `لمدّة ${m[1]} ساعة` },
    { re: /^in (\d+)h$/, ar: m => `خلال ${m[1]} ساعة` },
    { re: /^in (\d+)m$/, ar: m => `خلال ${m[1]} دقيقة` },
    // ── طوابع زمنية مطلقة ("Today at 9:00am" / "Monday at 9:00am") ──
    { re: /^Today at (.+)$/, ar: m => `اليوم في ${m[1]}` },
    { re: /^Yesterday at (.+)$/, ar: m => `أمس في ${m[1]}` },
    { re: /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday) at (.+)$/, ar: m => `${WEEKDAYS_AR[m[1]]} في ${m[2]}` }
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
function rebuildFromTemplate(translated: string, placeholders: any[]): any[] {
    const result: any[] = [];
    const re = /\{(\d+)\}/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(translated)) != null) {
        if (m.index > last) result.push(translated.slice(last, m.index));
        result.push(placeholders[Number(m[1])] ?? "");
        last = m.index + m[0].length;
    }
    if (last < translated.length) result.push(translated.slice(last));
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// منطق الترجمة المشترك (يُستخدَم على intl الأساسي وعلى الكائنات الناتجة عن withFormatters)
// ─────────────────────────────────────────────────────────────────────────────

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
            if (arTmpl != null) return diag(true, formatMessage(arTmpl, values));
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

    // (ج) ترجمة كل جزء نصّي على حدة (يحلّ الأوصاف ذات الروابط)، مع حفظ المسافات والعناصر.
    let changed = false;
    const perPart = parts.map(p => {
        if (typeof p !== "string") return p;
        const mt = p.match(/^(\s*)([\s\S]*?)(\s*)$/);
        const lead = mt?.[1] ?? "";
        const core = mt?.[2] ?? p;
        const trail = mt?.[3] ?? "";
        if (core.length < 2) return p;
        const t = lookup(core);
        if (t != null) { changed = true; return lead + t + trail; }
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
            if (arTmpl != null) return diag(true, formatMessage(arTmpl, values));
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
