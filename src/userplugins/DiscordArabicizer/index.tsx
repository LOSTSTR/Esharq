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

// دوال intl النصّية البسيطة (مطابقة مباشرة). "format" و"formatToParts" لهما منطق خاصّ.
const STRING_METHODS = ["string", "formatToPlainString", "formatToMarkdownString"];

// علامات خاصّة (Private Use Area) لاستعادة القوالب الديناميكية — لا تظهر في نصوص حقيقية.
const PH_OPEN = String.fromCharCode(0xE000);
const PH_CLOSE = String.fromCharCode(0xE001);
const PH_RE = new RegExp(PH_OPEN + "([^" + PH_CLOSE + "]+)" + PH_CLOSE, "g");

type StrFn = (msg: any, values?: any) => any;
const originals = new Map<string, StrFn>();
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
// لفّ دوال intl الأساسي
// ─────────────────────────────────────────────────────────────────────────────

function wrapMethod(intl: any, name: string) {
    if (typeof intl[name] !== "function" || originals.has(name)) return;
    const orig = intl[name].bind(intl) as StrFn;
    originals.set(name, orig);
    intl[name] = (msg: any, values?: any) => translateString(orig, msg, values, name);
}

function wrapFormat(intl: any) {
    if (typeof intl.format !== "function" || originals.has("format")) return;
    const orig = intl.format.bind(intl) as StrFn;
    originals.set("format", orig);
    intl.format = (msg: any, values?: any) => translateFormat(orig, msg, values);
}

function wrapFormatToParts(intl: any) {
    if (typeof intl.formatToParts !== "function" || originals.has("formatToParts")) return;
    const orig = intl.formatToParts.bind(intl) as StrFn;
    originals.set("formatToParts", orig);
    intl.formatToParts = (msg: any, values?: any) => translateParts(orig, msg, values);
}

// ─────────────────────────────────────────────────────────────────────────────
// لفّ withFormatters: ديسكورد يستدعيها لرسم النصوص الغنيّة (الأوصاف ذات الروابط).
// تُرجِع كائن intl جديداً — نُغلّفه بـProxy فتمرّ كل دواله عبر الترجمة نفسها.
// ─────────────────────────────────────────────────────────────────────────────

function wrapIntlLikeProxy(obj: any): any {
    return new Proxy(obj, {
        get(target, prop) {
            const v = (target as any)[prop];
            if (typeof v !== "function" || typeof prop === "symbol") return v;
            const name = prop as string;
            const bound = v.bind(target) as StrFn;
            if (name === "string" || name === "formatToPlainString" || name === "formatToMarkdownString")
                return (msg: any, values?: any) => translateString(bound, msg, values, name);
            if (name === "format")
                return (msg: any, values?: any) => translateFormat(bound, msg, values);
            if (name === "formatToParts")
                return (msg: any, values?: any) => translateParts(bound, msg, values);
            if (name === "withFormatters")
                return (...a: any[]) => {
                    const r = (bound as any)(...a);
                    return (r != null && typeof r === "object") ? wrapIntlLikeProxy(r) : r;
                };
            return bound;
        }
    });
}

function wrapWithFormatters(intl: any) {
    if (typeof intl.withFormatters !== "function" || originals.has("withFormatters")) return;
    const orig = intl.withFormatters.bind(intl) as StrFn;
    originals.set("withFormatters", orig);
    intl.withFormatters = (...args: any[]) => {
        const result = (orig as any)(...args);
        return (result != null && typeof result === "object") ? wrapIntlLikeProxy(result) : result;
    };
}

function applyPatch() {
    if (active) return;
    const intl = (i18n as any).intl;
    if (intl == null || typeof intl.string !== "function") {
        console.warn("[DiscordArabicizer] تعذّر إيجاد نظام intl في ديسكورد — أُلغي التطبيق.");
        return;
    }

    console.log("[DiscordArabicizer] دوال intl المتاحة:", discoverMethods(intl).join(", "));

    for (const name of STRING_METHODS) wrapMethod(intl, name);
    wrapFormat(intl);
    wrapFormatToParts(intl);
    wrapWithFormatters(intl);

    console.log("[DiscordArabicizer] i18n.intl patched. (لُفّت:",
        [...originals.keys()].join(", "), ")");
    active = true;
}

function removePatch() {
    if (!active) return;
    const intl = (i18n as any).intl;
    if (intl != null) {
        for (const [name, orig] of originals) intl[name] = orig;
    }
    originals.clear();
    active = false;
}

export default definePlugin({
    name: "DiscordArabicizer",
    description: t(
        "تعريب واجهة ديسكورد بالكامل — حصري لاشراق.",
        "Full Arabic localization of Discord's UI — exclusive to Esharq."
    ),
    authors: [EquicordDevs.LOSTSTR],
    settings,

    start() {
        console.log("[DiscordArabicizer] Plugin loaded.");
        if (!settings.store.enabled) return;
        applyPatch();
    },

    stop() {
        removePatch();
    }
});
