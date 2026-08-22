/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * نوافذ ديسكورد إضافية — كلٌّ بجلستها المستقلّة.
 *
 * ── لماذا لا تُنسَخ التوكنات ──────────────────────────────────────────
 * النسخة التي في المستودعات الأخرى تقرأ `localStorage` كاملاً (`token`،
 * `multiaccount_tokens`، `login_token`…) وتحفظ خريطة «معرّف ← توكن» على القرص.
 * هذا يضع بيانات دخولك في **موضع ثانٍ غير مشفّر** يبقى بعد تسجيل الخروج، ويكرّر
 * النمط الذي حذفناه من إضافتين عندنا.
 *
 * هذه النسخة **لا تلمس توكناً إطلاقاً**: تفتح نافذة بقسم تخزين
 * (`partition`) مستقلّ، وديسكورد نفسه يتولّى تسجيل الدخول فيها كما يفعل في
 * متصفّح بملفّ تعريف جديد. فالجلسة الثانية تعيش في مخزن إلكترون الخاصّ بها،
 * ونحن لا نقرأ منه ولا نكتب فيه ولا ننقل شيئاً بين النوافذ.
 *
 * ── ما يُقيَّد هنا ───────────────────────────────────────────────────
 *  • **العنوان ثابت** لا يأتي من الواجهة — فلا يُفتَح موقعٌ عشوائيّ بامتياز.
 *  • اسم القسم يُفلتَر بمحارف التسمية وحدها: يدخل في مسار ملفّ على القرص،
 *    فاسمٌ فيه `../` يخرج من مجلّد الجلسات.
 *  • النافذة الجديدة **معزولة**: بلا Node وبلا preload خاصّ بنا — ديسكورد
 *    ويب لا أكثر. فلا تصل إليها إضافات إشراق ولا تصل هي إلى العملية الرئيسية.
 */

import { BrowserWindow, type IpcMainInvokeEvent, session, shell } from "electron";

const DISCORD_URL = "https://discord.com/app";
const PARTITION_PREFIX = "persist:esharq-instance-";
const MAX_INSTANCES = 5;

/** نوافذنا وحدها — لا تُخلط بنافذة ديسكورد الأصلية. */
const windows = new Map<string, BrowserWindow>();

/** اسمٌ يدخل مسار قرص: تُقبل التسمية وحدها، ولا نقطة ولا فاصل مسار. */
const isSafeName = (name: unknown): name is string =>
    typeof name === "string" && /^[a-z0-9][a-z0-9-]{0,23}$/i.test(name);

export async function openInstance(_event: IpcMainInvokeEvent, name: unknown) {
    if (!isSafeName(name)) return { ok: false, error: "invalid name" };

    const existing = windows.get(name);
    if (existing && !existing.isDestroyed()) {
        existing.show();
        existing.focus();
        return { ok: true, reused: true };
    }
    if (windows.size >= MAX_INSTANCES) return { ok: false, error: "too many instances" };

    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        title: `Discord — ${name}`,
        autoHideMenuBar: true,
        webPreferences: {
            // 🔴 جلسة مستقلّة تماماً: هنا يعيش تسجيل الدخول الثاني، ولا يراه
            // ديسكورد الأصلي ولا نراه نحن.
            partition: PARTITION_PREFIX + name,
            // بلا Node وبلا تكامل: النافذة صفحة ويب لا أكثر، فلو كُسرت لم
            // تصل إلى نظام الملفّات ولا إلى العملية الرئيسية.
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            backgroundThrottling: false
        }
    });

    windows.set(name, win);
    win.on("closed", () => windows.delete(name));

    // أي وجهة خارج ديسكورد تُفتَح في المتصفّح لا داخل نافذة بجلستنا.
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) shell.openExternal(url);
        return { action: "deny" };
    });
    win.webContents.on("will-navigate", (event, url) => {
        try {
            const host = new URL(url).hostname;
            if (!/(^|\.)discord\.com$/i.test(host)) {
                event.preventDefault();
                shell.openExternal(url);
            }
        } catch {
            event.preventDefault();
        }
    });

    await win.loadURL(DISCORD_URL);
    return { ok: true, reused: false };
}

export async function closeInstance(_event: IpcMainInvokeEvent, name: unknown) {
    if (!isSafeName(name)) return { ok: false, error: "invalid name" };
    const win = windows.get(name);
    if (win && !win.isDestroyed()) win.close();
    windows.delete(name);
    return { ok: true };
}

/**
 * يمسح جلسة نسخةٍ بالكامل — وهو الطريق الوحيد لتسجيل خروجها، لأنّنا لا نملك
 * توكنها أصلاً. تُغلَق النافذة أوّلاً وإلّا أُعيدت كتابة المخزن عند الإغلاق.
 */
export async function forgetInstance(_event: IpcMainInvokeEvent, name: unknown) {
    if (!isSafeName(name)) return { ok: false, error: "invalid name" };

    const win = windows.get(name);
    if (win && !win.isDestroyed()) win.destroy();
    windows.delete(name);

    try {
        // `session` يُستورَد أعلى الملفّ لا هنا: الاستيراد الديناميكيّ لـ"electron"
        // داخل الدالّة كان يفشل صامتاً في الحزمة، فترجع الدالّة `undefined`
        // ولا يُمسح شيء — قِيس على عميل حيّ: الحجم لم ينقص بايتاً.
        const partition = session.fromPartition(PARTITION_PREFIX + name);
        await partition.clearStorageData();
        await partition.clearCache();
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function listOpen(_event: IpcMainInvokeEvent) {
    return [...windows.entries()]
        .filter(([, w]) => !w.isDestroyed())
        .map(([name]) => name);
}
