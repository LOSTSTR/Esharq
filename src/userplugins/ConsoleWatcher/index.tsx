/*
 * ConsoleWatcher — أداة مطوّر لمراقبة أحداث الكونسول وجمعها للصيانة
 * Copyright (c) 2026 LOSTSTR
 *
 * مبنية على Equicord المرخّصة GPL-3.0-or-later وتخضع لنفس الرخصة. تعترض دوال
 * الكونسول أثناء التسجيل النشط فقط، ثم تستعيد الأصل بالكامل عند الإيقاف — بلا
 * تسريب ذاكرة ولا تأثير على عملية main (تعمل في طرف العرض فقط).
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addHeaderBarButton, HeaderBarButton, removeHeaderBarButton } from "@api/HeaderBar";
import ErrorBoundary from "@components/ErrorBoundary";
import { gitHashShort } from "@shared/vencordUserAgent";
import { EquicordDevs } from "@utils/constants";
import { copyWithToast } from "@utils/discord";
import { t } from "@utils/esharqI18n";
import definePlugin from "@utils/types";
import type { RenderModalProps } from "@vencord/discord-types";
import { Button, Modal, openModal, useEffect, useState } from "@webpack/common";
import { getBuildNumber } from "@webpack/patcher";

import { settings } from "./settings";
import type { ConsoleEvent, ConsoleEventType } from "./types";
import { cleanConsoleArgs, safeSerializeArg } from "./utilities";

const BUTTON_ID = "ConsoleWatcher";

const HOOKED_METHODS = [
    "log", "warn", "error", "info", "debug", "trace",
    "table", "group", "groupCollapsed", "groupEnd",
    "time", "timeEnd", "clear"
] as const;
type HookedMethod = typeof HOOKED_METHODS[number];

const events: ConsoleEvent[] = [];
const original: Partial<Record<HookedMethod, (...a: any[]) => void>> = {};

let recording = false;
let hooked = false;
let capturing = false; // حارس إعادة الدخول — يمنع التكرار اللانهائي

// مستمعو إعادة رسم الزر (لتحديث لونه/تلميحه عند تبديل الحالة)
const buttonListeners = new Set<() => void>();
function notifyButton() {
    buttonListeners.forEach(l => l());
}

function clampMax(v: unknown): number {
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    return Number.isFinite(n) ? Math.min(5000, Math.max(50, Math.floor(n))) : 500;
}

function capture(type: ConsoleEventType, args: unknown[], detail?: string) {
    if (capturing) return; // لا نعيد الدخول إلى الالتقاط أبداً
    capturing = true;
    try {
        if (type === "log" && !settings.store.includeLog) return;
        if (type === "trace" && !settings.store.includeTrace) return;
        const cleaned = cleanConsoleArgs(args); // أزِل ضوضاء %c وأنماط الـCSS
        // التقط stack الخطأ إن مُرِّر كائن Error ضمن الوسائط (يساعد التشخيص)
        let stack = detail;
        if (!stack) {
            const err = cleaned.find(a => a instanceof Error) as Error | undefined;
            if (err?.stack) stack = err.stack;
        }
        events.push({ timestamp: Date.now(), type, args: cleaned.map(safeSerializeArg), detail: stack });
        const max = clampMax(settings.store.maxEvents);
        while (events.length > max) events.shift(); // احذف الأقدم عند تجاوز الحد
    } catch {
        // الالتقاط يجب ألّا يرمي استثناءً إلى كونسول ديسكورد — نبتلعه بصمت
    } finally {
        capturing = false; // يُنفَّذ حتى مع return أعلاه
    }
}

function hookConsole() {
    if (hooked) return;
    for (const m of HOOKED_METHODS) {
        if (!original[m]) original[m] = (console as any)[m]?.bind(console); // احفظ الأصل مرّة
        const orig = original[m];
        (console as any)[m] = (...args: any[]) => {
            // الأصل أولاً: الكونسول يبقى يعمل طبيعياً حتى لو فشل الالتقاط
            try { orig?.(...args); } catch { /* الأصل رمى — ليست مشكلتنا */ }
            capture(m, args);
        };
    }
    hooked = true;
}

function unhookConsole() {
    if (!hooked) return;
    for (const m of HOOKED_METHODS)
        if (original[m]) (console as any)[m] = original[m]; // استعادة نظيفة
    hooked = false;
}

// مراجع مسمّاة كي تعمل removeEventListener — ولا تدهس معالج ديسكورد (إضافية)
function onWindowError(e: ErrorEvent) {
    capture("window.onerror", [e.message], e.error?.stack ?? `${e.filename}:${e.lineno}:${e.colno}`);
}
function onUnhandledRejection(e: PromiseRejectionEvent) {
    const r = e.reason;
    capture(
        "unhandledrejection",
        [r instanceof Error ? r.message : r],
        r instanceof Error ? r.stack : undefined
    );
}

function startRecording() {
    if (recording) return;
    events.length = 0; // امسح أي بيانات سابقة
    hookConsole();
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    recording = true;
    notifyButton();
}

// يفكّ كل شيء بلا فتح نافذة — يُستعمل عند تعطيل الإضافة
function teardownRecording() {
    unhookConsole();
    window.removeEventListener("error", onWindowError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    recording = false;
    notifyButton();
}

function stopRecording() {
    if (!recording) return;
    const snapshot = events.slice(); // لقطة ثابتة للنافذة
    teardownRecording();
    openEventsModal(snapshot);
}

const ERROR_TYPES = new Set<ConsoleEventType>(["error", "window.onerror", "unhandledrejection"]);

// ضوضاء متصفّح معروفة غير ضارّة — نستبعدها من «الأخطاء فقط»
function isNoise(e: ConsoleEvent): boolean {
    return e.args.some(a => a.includes("ResizeObserver loop"));
}

function formatEvents(list: ConsoleEvent[]): string {
    return list
        .map(e => {
            const ts = new Date(e.timestamp).toISOString().slice(11, 23); // HH:MM:SS.mmm
            const head = `[${ts}] [${e.type}] ${e.args.join(" ")}`;
            return e.detail ? `${head}\n    ${e.detail}` : head;
        })
        .join("\n");
}

// ترويسة سياق تلقائية — تختصر أسئلة التشخيص (إصدار/بناء/نظام/أعداد)
function buildReportHeader(list: ConsoleEvent[]): string {
    const errors = list.filter(e => ERROR_TYPES.has(e.type)).length;
    const warnings = list.filter(e => e.type === "warn").length;
    let build = "?";
    try {
        const b = getBuildNumber();
        if (b && b !== -1) build = String(b);
    } catch { /* غير متاح — نتجاهل */ }
    return [
        "=== ConsoleWatcher report ===",
        `Time:          ${new Date().toISOString()}`,
        `Equicord:      v${VERSION} (${gitHashShort})`,
        `Discord build: ${build}`,
        `Client:        ${navigator.userAgent}`,
        `Events:        total=${list.length}  errors=${errors}  warnings=${warnings}`,
        "============================="
    ].join("\n");
}

function EventsModal({ modalProps, snapshot }: { modalProps: RenderModalProps; snapshot: ConsoleEvent[]; }) {
    const header = buildReportHeader(snapshot);
    const errorEvents = snapshot.filter(e => ERROR_TYPES.has(e.type) && !isNoise(e));

    const fullText = `${header}\n\n${snapshot.length ? formatEvents(snapshot) : t("لا أحداث.", "No events.")}`;
    const errorsText = `${header}\n\n${errorEvents.length ? formatEvents(errorEvents) : t("لا أخطاء.", "No errors.")}`;

    return (
        <Modal
            {...modalProps}
            size="lg"
            title={t(
                `سجلّ الكونسول (${snapshot.length} حدثاً · ${errorEvents.length} خطأ)`,
                `Console log (${snapshot.length} events · ${errorEvents.length} errors)`
            )}
        >
            <div className="cw-body">
                <pre className="cw-pre">{fullText}</pre>
            </div>
            <div className="cw-footer">
                <Button
                    color={Button.Colors.RED}
                    onClick={() => copyWithToast(errorsText, t("✓ نُسخت الأخطاء", "✓ Errors copied"))}
                >
                    {t(`نسخ الأخطاء فقط (${errorEvents.length})`, `Copy errors only (${errorEvents.length})`)}
                </Button>
                <Button onClick={() => copyWithToast(fullText, t("✓ نُسخ السجلّ", "✓ Log copied"))}>
                    {t("نسخ الكل", "Copy all")}
                </Button>
            </div>
        </Modal>
    );
}

function openEventsModal(snapshot: ConsoleEvent[]) {
    openModal(props => (
        <ErrorBoundary>
            <EventsModal modalProps={props} snapshot={snapshot} />
        </ErrorBoundary>
    ));
}

// أيقونة عين/نقطة تسجيل — لونها currentColor فتتلوّن أحمر عبر .cw-recording في CSS
function RecordIcon({ width = 18, height = 18, color = "currentColor" }: { width?: number; height?: number; color?: string; size?: string; }) {
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" fill="none">
            <path d="M12 5C6.5 5 3 9.5 3 12s3.5 7 9 7 9-4.5 9-7-3.5-7-9-7Z" stroke={color} strokeWidth="2" />
            <circle cx="12" cy="12" r="3.25" fill={color} />
        </svg>
    );
}

function ConsoleWatcherButton() {
    const [, force] = useState(0);
    useEffect(() => {
        const l = () => force(n => n + 1);
        buttonListeners.add(l);
        return () => void buttonListeners.delete(l);
    }, []);

    return (
        <HeaderBarButton
            icon={RecordIcon}
            tooltip={recording
                ? t("إيقاف تسجيل الكونسول وعرض السجلّ", "Stop recording & show log")
                : t("بدء تسجيل الكونسول", "Start console recording")}
            className={recording ? "cw-button cw-recording" : "cw-button"}
            selected={recording}
            aria-label={t("مراقب الكونسول", "Console Watcher")}
            onClick={() => (recording ? stopRecording() : startRecording())}
        />
    );
}

export default definePlugin({
    name: "ConsoleWatcher",
    description: t(
        "أداة مطوّر: تسجّل أحداث الكونسول والأخطاء أثناء التسجيل النشط فقط ثم تعرضها للنسخ — للصيانة.",
        "Developer tool: records console events & errors only while recording, then shows them for copying — for maintenance."
    ),
    authors: [EquicordDevs.LOSTSTR],
    dependencies: ["HeaderBarAPI"],
    settings,

    start() {
        addHeaderBarButton(BUTTON_ID, () => <ConsoleWatcherButton />);
    },

    stop() {
        if (recording) teardownRecording(); // لا نفتح نافذة عند تعطيل الإضافة
        events.length = 0;
        removeHeaderBarButton(BUTTON_ID);
    }
});
