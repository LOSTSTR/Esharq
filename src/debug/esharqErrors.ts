/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * **سجلّ المشاكل** — ما انكسر فعلاً في هذه الجلسة، على جهاز صاحبه وحده.
 *
 * ## المشكلة التي يحلّها
 *
 * حين تنكسر رقعة بعد تحديث ديسكورد، أو تنفجر إضافة عند بدئها، أو يفشل باحث
 * webpack — يُطبع سطر في كونسول المطوّر ثمّ **يضيع**. لا يفتح المستخدم
 * الكونسول، ولا يصل إلينا شيء. فالعطل الذي يراه هو «الميزة توقّفت» بلا سبب،
 * والذي نراه نحن لا شيء أصلاً.
 *
 * ## المصيدة: `Logger` وحده
 *
 * كل بلاغ خطأ في إشراق يمرّ بـ`Logger._log`، وقد تُتُبِّعت المواضع:
 * - رقعة بلا أثر ⇒ `logger.warn` (`webpack/patchWebpack.ts:580`)
 * - رقعة انفجرت ⇒ `logger.error` (`patchWebpack.ts:631`)
 * - إضافة فشل بدؤها ⇒ `logger.error` (`api/PluginManager.ts:273`)
 * - باحث لم يجد وحدته ⇒ `logger.error` (`webpack/webpack.ts:218`)
 * - مكوّن انهار ⇒ `logger.error` (`components/ErrorBoundary.tsx:76`)
 *
 * ⇒ نقطة واحدة تلتقطها كلّها، بلا حارس بناء: **البناء المشحون هو المقصود**.
 *
 * ## وما لا يلتقطه — قصداً
 *
 * أخطاء ديسكورد نفسه لا تدخل هنا: هي تُطبع بـ`console.error` مباشرةً ولا
 * تمرّ بـ`Logger`. وهذا مقصود — سجلّ يخلط أعطال ديسكورد بأعطالنا يُوجّه كل
 * تشخيص إلى الوجهة الخطأ.
 *
 * والمُلتقِطان العامّان (`unhandledrejection` و`error`) **يُسقطان ما لا
 * يثبت أنه منّا**: يُقارَن أثر الخطأ بملفّ حزمتنا نفسها، فإن تعذّر تحديده
 * لم يُسجَّل شيء. الفشل هنا يميل إلى الصمت لا إلى الاتّهام.
 *
 * ## الحدود، مقولةً لا مخفيّة
 *
 * - **في الذاكرة فقط.** لا قرص ولا شبكة ولا سطر يغادر الجهاز. وانهيار
 *   العميل يمحوه — ولذلك تنصيفُ الانهيار أداةٌ أخرى مستقلّة.
 * - **سقف مئة بلاغ مميّز**، والمتكرّر يُعَدّ لا يُكرَّر. وما سقط بعد
 *   الامتلاء يُعلَن عدده بدل أن يُبتلع صامتاً.
 */

export type IssueLevel = "error" | "warn";

/** تصنيف البلاغ — يُشتقّ من نصّه، لأن `Logger` لا يحمل نوعاً. */
export type IssueKind = "patch" | "find" | "start" | "render" | "other";

export interface Issue {
    level: IssueLevel;
    kind: IssueKind;
    /** اسم المُسجِّل: إضافة، أو نظام فرعيّ مثل `WebpackPatcher`. */
    source: string;
    /** الإضافة المسؤولة إن أمكن استخراجها من النصّ. */
    plugin?: string;
    message: string;
    /** كم مرّة تكرّر البلاغ نفسه. */
    count: number;
    /** منذ بدء تحميل الصفحة، بالميلي ثانية. */
    firstAt: number;
    lastAt: number;
}

const MAX_ISSUES = 100;
const MAX_MESSAGE = 500;
const MAX_ARG = 220;

const issues = new Map<string, Issue>();
let droppedCount = 0;

/**
 * ملفّ حزمتنا، يُستخرج من أثر خطأٍ نصنعه هنا.
 *
 * 🔴 يُقرأ الإطار الثاني لا الأوّل: أوّل سطر في أثر V8 هو `Error` نفسه لا
 * موضعاً. وإن لم يُفهم الشكل بقيت القيمة `null` — ومعناها أن المُلتقِط
 * العامّ لا يسجّل شيئاً، لا أنه يسجّل كل شيء.
 */
const OWN_SOURCE = ((): string | null => {
    try {
        const frame = (new Error().stack ?? "").split("\n")[1] ?? "";
        return /(?:\(|@|\s)([^\s()]+):\d+:\d+\)?$/.exec(frame.trim())?.[1] ?? null;
    } catch {
        return null;
    }
})();

function stripAssetUrls(s: string): string {
    return s.replace(/https?:\/\/\S+\/assets\//g, "");
}

/**
 * وصف قيمة بلا أن ترمي.
 *
 * 🔴 `JSON.stringify` يرمي على `BigInt`، وديسكورد يخزّن الصلاحيات به. فكل
 * نداء محروس، والقيمة المستعصية تُوصف ولا تُسقط البلاغ.
 */
function describe(value: unknown): string {
    if (typeof value === "string") return value;
    if (value === null) return "null";
    if (value === undefined) return "undefined";

    if (value instanceof Error) {
        const head = `${value.name}: ${value.message}`;
        const frames = (value.stack ?? "").split("\n").slice(1, 3).map(f => f.trim()).filter(Boolean);
        return frames.length === 0 ? head : `${head}\n${frames.join("\n")}`;
    }

    switch (typeof value) {
        case "number":
        case "boolean":
        case "bigint":
        case "symbol":
            return String(value);
        case "function":
            return `[function ${value.name || "anonymous"}]`;
    }

    try {
        return JSON.stringify(value) ?? "[object]";
    } catch {
        return "[unserialisable]";
    }
}

function format(args: readonly unknown[]): string {
    return stripAssetUrls(
        args
            .map(arg => describe(arg).slice(0, MAX_ARG))
            .join(" ")
    )
        // تُبقى الأسطر — أثر الخطأ يُقرأ سطراً سطراً — وتُطوى المسافات وحدها.
        .replace(/[ \t]+/g, " ")
        .replace(/\n{2,}/g, "\n")
        .trim()
        .slice(0, MAX_MESSAGE);
}

/** النصوص المطابَقة هنا مقروءة من مواضعها، لا مُخمَّنة. */
function classify(source: string, message: string): { kind: IssueKind; plugin?: string; } {
    const patched = /^Patch by (\S+) (?:had no effect|errored)/.exec(message);
    if (patched !== null) return { kind: "patch", plugin: patched[1] };

    // اسم الـ`find` قد يحوي « by » بنفسه، فيُؤخذ آخر مطابقة قبل «because».
    const undone = /^Undoing patch group .* by (\S+) because/.exec(message);
    if (undone !== null) return { kind: "patch", plugin: undone[1] };

    const failed = /^Failed to start (\S+)/.exec(message);
    if (failed !== null) return { kind: "start", plugin: failed[1] };

    if (message.includes("found no module")) return { kind: "find" };
    if (source === "React ErrorBoundary") return { kind: "render" };

    return { kind: "other" };
}

/**
 * يُنادى من `Logger._log` لكل بلاغ خطأ أو تحذير.
 *
 * 🔴 لا يرمي أبداً: سجلّ الأخطاء الذي يصير مصدر خطأ يُسقط ما جاء ليصفه.
 */
export function recordIssue(level: IssueLevel, source: string, args: readonly unknown[]): void {
    try {
        const message = format(args);
        if (message === "") return;

        const key = `${level} ${source} ${message}`;
        const now = performance.now();

        const existing = issues.get(key);
        if (existing !== undefined) {
            existing.count++;
            existing.lastAt = now;
            return;
        }

        if (issues.size >= MAX_ISSUES) {
            droppedCount++;
            return;
        }

        const { kind, plugin } = classify(source, message);
        issues.set(key, { level, kind, source, plugin, message, count: 1, firstAt: now, lastAt: now });
    } catch {
        // مقصود: لا شيء هنا يستحقّ أن يُسقط ما يُبلَّغ عنه.
    }
}

/** الأحدث أوّلاً — ما وقع الآن أولى بالقراءة ممّا وقع عند الإقلاع. */
export function getIssues(): Issue[] {
    return [...issues.values()].sort((a, b) => b.lastAt - a.lastAt);
}

/** كم بلاغاً مميّزاً سقط بعد امتلاء السقف. */
export function getDroppedIssueCount(): number {
    return droppedCount;
}

export function clearIssues(): void {
    issues.clear();
    droppedCount = 0;
}

function isOurs(error: unknown): boolean {
    // يميل إلى الصمت: بلا ملفٍّ معروف لا نَنسب إلى أنفسنا شيئاً.
    if (OWN_SOURCE === null) return false;
    if (!(error instanceof Error)) return false;
    return typeof error.stack === "string" && error.stack.includes(OWN_SOURCE);
}

/**
 * وعدٌ مرفوض بلا مُمسِك، أو خطأ غير مُلتقَط — من شيفرتنا وحدها.
 *
 * هذان لا يمرّان بـ`Logger`: خطأ داخل `setTimeout` أو داخل `then` بلا
 * `catch` لا يعرف به أحد. وهما بالضبط صنف «تعمل عندي ولا تعمل عنده».
 */
function installGlobalHandlers(): void {
    if (typeof window === "undefined") return;

    window.addEventListener("unhandledrejection", event => {
        if (!isOurs(event.reason)) return;
        recordIssue("error", "Unhandled rejection", [event.reason]);
    });

    window.addEventListener("error", event => {
        if (!isOurs(event.error)) return;
        recordIssue("error", "Uncaught error", [event.error]);
    });
}

installGlobalHandlers();
