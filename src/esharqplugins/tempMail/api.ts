/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PluginNative } from "@utils/types";

const BASE = "https://api.mail.tm";

/**
 * 🔴 كلّ الطلبات تمرّ بالعملية الرئيسة، ولا تُنادى `fetch` من الواجهة البتّة.
 *
 * السبب مقيسٌ لا مفترَض: `fetch("https://api.mail.tm/…")` من داخل العميل يفشل
 * بـ`TypeError: Failed to fetch`، بينما ينجح من خارج المتصفّح تماماً
 * (`GET /domains` ← 200، و`POST /accounts` ← 201، و`POST /token` ← 200).
 * والفحص يقول لماذا: mail.tm يردّ على طلب ما قبل التحقّق بترويسات
 * `access-control-allow-methods` و`-headers` **بلا
 * `access-control-allow-origin`** — فيحجب المتصفّحُ الردّ. لم يتعطّل شيءٌ في
 * كودنا؛ الخادم غيّر ترويساته فماتت الإضافة صامتةً.
 *
 * والعملية الرئيسة ليست سياق متصفّح، فلا CORS عليها. ينظر `native.ts`.
 */
const Native = VencordNative.pluginHelpers.TempMail as PluginNative<typeof import("./native")>;

export interface TmAccount {
    id: string;
    address: string;
    token: string;
}

export interface TmMessage {
    id: string;
    from: { address: string; name: string; };
    subject: string;
    intro: string;
    createdAt: string;
    seen: boolean;
}

export interface TmMessageFull extends TmMessage {
    html: string[];
    text: string;
}

export interface TmDomain {
    id: string;
    domain: string;
    isActive: boolean;
}

/**
 * يُرجع الجسم مُحلَّلاً، ويرمي برسالةٍ يفهمها المستخدم عند الفشل.
 *
 * الرمي مقصود: الطبقة الأعلى كانت تبتلع الأخطاء، فكان العطل يظهر للمستخدم
 * قائمةً فارغة بلا سبب. رسالةٌ صريحة أفضل من صمت.
 */
async function call(path: string, method: "GET" | "POST" | "DELETE", token?: string, payload?: unknown): Promise<any> {
    const headers: Record<string, string> = {};
    if (payload !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await Native.request(
        `${BASE}${path}`,
        method,
        headers,
        payload === undefined ? undefined : JSON.stringify(payload)
    );

    if (res.status === -1) throw new Error(`تعذّر الاتصال بخدمة البريد المؤقّت: ${res.body}`);
    if (res.status === 401) throw new Error("انتهت صلاحية هذا البريد. أنشئ واحداً جديداً.");
    if (res.status === 422) throw new Error("العنوان مستعمَل أو غير مقبول. جرّب اسماً آخر.");
    if (res.status === 429) throw new Error("طلباتٌ كثيرة بسرعة. انتظر قليلاً ثمّ أعد المحاولة.");
    if (res.status < 200 || res.status >= 300) throw new Error(`ردٌّ غير متوقَّع من الخدمة (${res.status}).`);

    if (res.body === "") return null;
    try {
        return JSON.parse(res.body);
    } catch {
        throw new Error("ردٌّ غير قابل للقراءة من الخدمة.");
    }
}

// ── Domain helpers ────────────────────────────────────────────────────────────
export async function getDomains(): Promise<TmDomain[]> {
    const data = await call("/domains?page=1", "GET");
    return data?.["hydra:member"] ?? [];
}

// ── Account ───────────────────────────────────────────────────────────────────
export async function createAccount(address: string, password: string): Promise<{ id: string; address: string; }> {
    return await call("/accounts", "POST", undefined, { address, password });
}

export async function getToken(address: string, password: string): Promise<string> {
    const data = await call("/token", "POST", undefined, { address, password });
    return data.token;
}

export async function deleteAccount(id: string, token: string): Promise<void> {
    await call(`/accounts/${encodeURIComponent(id)}`, "DELETE", token);
}

// ── Messages ──────────────────────────────────────────────────────────────────
export async function getMessages(token: string, page = 1): Promise<TmMessage[]> {
    const data = await call(`/messages?page=${page}`, "GET", token);
    return data?.["hydra:member"] ?? [];
}

export async function getMessage(id: string, token: string): Promise<TmMessageFull> {
    return await call(`/messages/${encodeURIComponent(id)}`, "GET", token);
}

export async function deleteMessage(id: string, token: string): Promise<void> {
    await call(`/messages/${encodeURIComponent(id)}`, "DELETE", token);
}

// ── Utility ───────────────────────────────────────────────────────────────────
export function randomString(len = 10): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
