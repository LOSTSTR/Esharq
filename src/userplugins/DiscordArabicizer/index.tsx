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

import { collectMissing } from "./collector";
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

/** استبدال المتغيّرات في قالب عربي: "لديك {count} رسالة" + { count: 3 } → "لديك 3 رسالة". */
export function formatMessage(template: string, values?: Record<string, any>): string {
    if (values == null) return template;
    return template.replace(/\{(\w+)\}/g, (m, name) =>
        Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : m);
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
            collectMissing(tmpl);
            return diag(false, out);
        }
    }

    collectMissing(out);
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
        collectMissing(joined);
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
        collectMissing(core); // اجمع الجملة المفقودة نفسها (أنفع للحصاد من جمع القالب)
        return p;
    });
    if (changed) return perPart;

    collectMissing(template);
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
            collectMissing(tmpl);
            return diag(false, out);
        }
    }
    collectMissing(out);
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

// يلفّ دالة واحدة على مالكها: this-aware، محميّة بـtry/catch، مع منع اللفّ المزدوج.
function patchMethod(intlLike: any, name: string) {
    const kind = METHOD_KINDS[name];
    if (kind == null) return;
    const owner = findOwner(intlLike, name);
    if (owner == null || isPatched(owner, name)) return;

    const origRaw = owner[name] as (...a: any[]) => any;

    let wrapper: (...a: any[]) => any;
    if (kind === "withFormatters") {
        wrapper = function (this: any, ...args: any[]) {
            const result = origRaw.apply(this, args); // الأصل أولاً (سلوك مطابق)
            // الكائن الناتج: نلفّ دواله بالآلية نفسها. لو شارك prototype مَلفوفاً
            // فالـdedup يتخطّاه — فلا لفّ مزدوج ولا تكرار.
            if (result != null && typeof result === "object") {
                try { patchIntlObject(result); }
                catch (e) { if (settings.store.logErrors) console.debug("[DiscordArabicizer] withFormatters patch error:", e); }
            }
            return result;
        };
    } else {
        wrapper = function (this: any, msg: any, values?: any) {
            // نمرّر الأصل مربوطاً بـthis الفعلي (يدعم الكائن والكائنات المشتقّة منه).
            const boundOrig: StrFn = (m, v) => origRaw.call(this, m, v);
            try {
                if (kind === "string") return translateString(boundOrig, msg, values, name);
                if (kind === "format") return translateFormat(boundOrig, msg, values);
                return translateParts(boundOrig, msg, values); // "parts"
            } catch (e) {
                if (settings.store.logErrors) console.debug(`[DiscordArabicizer] translate error in ${name}:`, e);
                return origRaw.call(this, msg, values); // أمان مطلق: أي خطأ → الأصل
            }
        };
    }

    try {
        owner[name] = wrapper;
    } catch (e) {
        if (settings.store.logErrors) console.debug(`[DiscordArabicizer] patch-assign error for ${name}:`, e);
        return; // مالك مجمّد/غير قابل للكتابة — نتركه دون لفّ (لا ضرر)
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
    active = true;
}

function removePatch() {
    if (!active) return;
    // استعادة عكسية (الأحدث أولاً): كل (مالك، اسم) إلى أصله بالضبط.
    for (let i = patchedEntries.length - 1; i >= 0; i--) {
        const { owner, name, orig } = patchedEntries[i];
        try { owner[name] = orig; } catch { /* تجاهل */ }
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
