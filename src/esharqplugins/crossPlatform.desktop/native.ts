/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

import type { HttpResult } from "./types";

/**
 * جسرٌ إلى العملية الرئيسة لطلبات المنصّات.
 *
 * 🔴 **ليس وكيلاً عامّاً.** لو قبِل أيّ عنوان لصار أيُّ كودٍ في الواجهة قادراً
 * على تجاوز CSP والوصول إلى الشبكة كلّها عبرنا. فالمضيفات مُثبَّتة هنا حصراً،
 * والبروتوكول https وحده، والجسم مقصوصٌ بسقف. توسيعُ هذه القائمة قرارٌ أمنيّ
 * يُراجَع، لا تفصيلَ تنفيذيّ.
 */
const ALLOWED_HOSTS = new Set([
    "api.steampowered.com",
    "api.hypixel.net",
    "api.twitch.tv"
]);

/** ترويسات يُسمح بتمريرها. المصادقة تحتاج هذه الثلاث لا غير. */
const ALLOWED_HEADERS = new Set(["authorization", "client-id", "api-key"]);

/** سقفُ ما نقرأه من الرد. ردود المنصّات هنا كيلوبايتات، والسقف يمنع إغراق الذاكرة. */
const MAX_BODY = 2 * 1024 * 1024;

const TIMEOUT_MS = 12_000;

export async function request(
    _: IpcMainInvokeEvent,
    url: string,
    headers: Record<string, string>
): Promise<HttpResult> {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return { status: -1, body: "عنوان غير صالح" };
    }

    if (parsed.protocol !== "https:") return { status: -1, body: "https وحده مسموح" };
    if (!ALLOWED_HOSTS.has(parsed.hostname)) return { status: -1, body: `مضيف غير مسموح: ${parsed.hostname}` };

    const safeHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        if (ALLOWED_HEADERS.has(key.toLowerCase())) safeHeaders[key] = value;
    }

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(parsed.href, { headers: safeHeaders, signal: abort.signal });
        const text = await res.text();
        return { status: res.status, body: text.length > MAX_BODY ? text.slice(0, MAX_BODY) : text };
    } catch (e) {
        return { status: -1, body: String(e) };
    } finally {
        clearTimeout(timer);
    }
}
