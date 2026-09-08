/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

/**
 * جسرٌ إلى العملية الرئيسة لطلبات mail.tm.
 *
 * 🔴 **لماذا وُجد أصلاً** — مقيسٌ لا مفترَض: صار `fetch` من الواجهة يفشل
 * بـ`TypeError: Failed to fetch`، بينما ينجح من خارج المتصفّح تماماً
 * (`POST /accounts` ← 201). والسبب أنّ mail.tm يردّ على طلب ما قبل التحقّق
 * بـ`access-control-allow-methods` و`-headers` **بلا
 * `access-control-allow-origin`** — فيحجب المتصفّحُ الردّ. لا شيء في كودنا
 * تعطّل؛ الخادم غيّر ترويساته، فماتت الإضافة صامتةً.
 *
 * والعملية الرئيسة ليست سياق متصفّح، فلا CORS عليها.
 *
 * 🔴 **وليس وكيلاً عامّاً**: مضيفٌ واحدٌ مثبَّت، https وحده، وترويستان لا
 * غير — وإلا صار أيُّ كودٍ في الواجهة قادراً على بلوغ الشبكة كلّها عبرنا.
 */
const ALLOWED_HOST = "api.mail.tm";
const ALLOWED_HEADERS = new Set(["content-type", "authorization"]);
const MAX_BODY = 2 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

export interface MailResult {
    /** `-1` تعني فشلاً قبل الشبكة؛ وما عداها رمز حالة حقيقيّ. */
    status: number;
    body: string;
}

export async function request(
    _: IpcMainInvokeEvent,
    url: string,
    method: string,
    headers: Record<string, string>,
    body?: string
): Promise<MailResult> {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return { status: -1, body: "عنوان غير صالح" };
    }

    if (parsed.protocol !== "https:") return { status: -1, body: "https وحده مسموح" };
    if (parsed.hostname !== ALLOWED_HOST) return { status: -1, body: `مضيف غير مسموح: ${parsed.hostname}` };
    if (!["GET", "POST", "DELETE"].includes(method)) return { status: -1, body: `طريقة غير مسموحة: ${method}` };

    const safeHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        if (ALLOWED_HEADERS.has(key.toLowerCase())) safeHeaders[key] = value;
    }

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(parsed.href, { method, headers: safeHeaders, body, signal: abort.signal });
        const text = await res.text();
        return { status: res.status, body: text.length > MAX_BODY ? text.slice(0, MAX_BODY) : text };
    } catch (e) {
        return { status: -1, body: String(e) };
    } finally {
        clearTimeout(timer);
    }
}
