/*
 * ConsoleWatcher — أداة مطوّر لمراقبة أحداث الكونسول وجمعها للصيانة
 * Copyright (c) 2026 LOSTSTR
 *
 * مبنية على Equicord المرخّصة GPL-3.0-or-later وتخضع لنفس الرخصة.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ConsoleSource } from "./types";

// مُسلسِل آمن: يحوّل أي وسيطة كونسول إلى نصّ دون أن يرمي استثناءً.
// يكشف المراجع الدائرية، ويحدّ العمق/الطول/العدد، ويعالج الأنواع الخاصّة.
// لا يستخدم eval أو Function — مجرّد تكرار (recursion).

const MAX_DEPTH = 4;
const MAX_STRING_LEN = 10_000; // حدّ طول النص لكل وسيطة
const MAX_ARRAY_ITEMS = 100;
const MAX_OBJECT_KEYS = 100;

// الأنواع التي لا يُسلسِلها JSON بشكل مفيد → وصف نصّي مختصر
function describeSpecial(value: unknown): string | undefined {
    if (typeof value === "function")
        return `[Function${(value as Function).name ? ": " + (value as Function).name : ""}]`;
    if (typeof value === "symbol") return value.toString();
    if (typeof value === "bigint") return `${value}n`;
    if (value instanceof Error) return `[${value.name}: ${value.message}]`;
    if (typeof Node !== "undefined" && value instanceof Node) {
        const el = value as any;
        const tag = el.tagName?.toLowerCase?.() ?? el.nodeName?.toLowerCase?.() ?? "node";
        return `[HTMLElement <${tag}>]`;
    }
    return undefined;
}

// يبني نسخة "آمنة" (بدائيات/مصفوفات/كائنات عادية فقط) خالية من الدوران
function toSafe(value: unknown, depth: number, seen: WeakSet<object>): unknown {
    if (value === null) return null;

    const t = typeof value;
    if (t === "string") {
        const s = value as string;
        return s.length > MAX_STRING_LEN ? s.slice(0, MAX_STRING_LEN) + "…(truncated)" : s;
    }
    if (t === "number" || t === "boolean") return value;
    if (t === "undefined") return "undefined";

    const special = describeSpecial(value);
    if (special !== undefined) return special;

    // هنا القيمة كائن أو مصفوفة
    if (depth >= MAX_DEPTH) return Array.isArray(value) ? "[Array]" : "[Object]";

    const obj = value as object;
    if (seen.has(obj)) return "[Circular]"; // كشف الدورة الحقيقية
    seen.add(obj);
    try {
        if (Array.isArray(value)) {
            const out: unknown[] = [];
            const len = Math.min(value.length, MAX_ARRAY_ITEMS);
            for (let i = 0; i < len; i++) out.push(toSafe(value[i], depth + 1, seen));
            if (value.length > MAX_ARRAY_ITEMS) out.push(`…(+${value.length - MAX_ARRAY_ITEMS} more)`);
            return out;
        }

        const out: Record<string, unknown> = {};
        const keys = Object.keys(obj);
        const shown = Math.min(keys.length, MAX_OBJECT_KEYS);
        for (let i = 0; i < shown; i++) {
            const k = keys[i];
            try {
                out[k] = toSafe((obj as any)[k], depth + 1, seen);
            } catch {
                out[k] = "[Unserializable]";
            }
        }
        if (keys.length > MAX_OBJECT_KEYS) out["…"] = `(+${keys.length - MAX_OBJECT_KEYS} more)`;
        return out;
    } finally {
        // نزيله صعوداً: نسمح بتكرار الكائن في فروع شقيقة، ونمسك الدورة الحقيقية فقط
        seen.delete(obj);
    }
}

/** يحوّل وسيطة كونسول واحدة إلى نصّ آمن للعرض/النسخ. */
export function safeSerializeArg(value: unknown): string {
    // النص الخام يمرّ كما هو (أوضح في العرض)
    if (typeof value === "string")
        return value.length > MAX_STRING_LEN ? value.slice(0, MAX_STRING_LEN) + "…(truncated)" : value;
    try {
        const safe = toSafe(value, 0, new WeakSet<object>());
        if (typeof safe === "string") return safe;
        const json = JSON.stringify(safe);
        return json.length > MAX_STRING_LEN ? json.slice(0, MAX_STRING_LEN) + "…(truncated)" : json;
    } catch {
        return "[Unserializable]";
    }
}

/**
 * يزيل توجيهات `%c` وأنماط الـCSS التابعة من وسائط console المنسّقة. ديسكورد
 * يلوّن سجلّاته عبر `console.x("%c[Module]", "css...", msg)` — فننظّفها لقراءة أوضح.
 * يبقى السلوك كما هو إن لم تكن أول وسيطة نصّاً يحوي `%c`.
 */
export function cleanConsoleArgs(args: unknown[]): unknown[] {
    const first = args[0];
    if (typeof first !== "string" || !first.includes("%c")) return args;

    const cssCount = (first.match(/%c/g) ?? []).length; // كل %c يستهلك وسيطة CSS تابعة
    const cleanedFirst = first.replace(/%c/g, "").trim();
    const rest = args.slice(1 + cssCount); // أسقِط وسائط الـCSS
    return cleanedFirst ? [cleanedFirst, ...rest] : rest;
}

/**
 * يكتشف مصدر حدث الكونسول من نصوصه (بعد التنظيف) — heuristic مبنيّ على صيغة
 * Logger في Vencord (بعد إزالة %c يصبح "Equicord <اسم>") ووسوم وحدات ديسكورد.
 * ليست نسبةً مثاليةً (الأخطاء الخام بلا وسم تبقى unknown)، لكنها موثوقة للموسوم.
 */
export function detectSource(args: string[]): { source: ConsoleSource; pluginName?: string; } {
    // DiscordArabicizer: تستخدم وسم [DiscordArabicizer] صراحةً في سجلّاتها.
    if (args.some(a => a.includes("[DiscordArabicizer]")))
        return { source: "arabicizer", pluginName: "DiscordArabicizer" };

    const head = (args[0] ?? "").trim();

    // Vencord/Equicord Logger: بعد تنظيف %c تصبح البادئة "Equicord <اسم> ...".
    const eq = head.match(/^Equicord\s+(\S+)/);
    if (eq) return { source: "plugin", pluginName: eq[1] };

    // وحدة ديسكورد أساسية: سجلّ معنون بـ [ModuleName].
    if (/^\[[^\]]+\]/.test(head)) return { source: "discord" };

    return { source: "unknown" };
}
