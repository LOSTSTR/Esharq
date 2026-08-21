/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * عميلٌ رفيع لمكتبة الثيمات.
 *
 * القراءة والتنزيل يجريان في العملية الرئيسية (`src/main/themeLibrary.ts`):
 * 🔴 `betterdiscord.app` **لا يُرسل ترويسة CORS**، فالمُصيَّر لا يستطيع قراءة
 * جوابه مهما سُمح له في سياسة المحتوى — قِيس بعد إعادة تشغيلٍ كاملة.
 *
 * أمّا المصغّرات فتبقى هنا: `<img>` لا تحتاج CORS، فلا تعبر ميغابايتاتها IPC.
 */

import type { LibraryTheme } from "@main/themeLibrary";

export type CatalogueTheme = LibraryTheme;

export type LoadResult =
    | { status: "ok"; themes: CatalogueTheme[]; }
    | { status: "error"; reason: "offline" | "http" | "shape"; };

export async function loadCatalogue(): Promise<LoadResult> {
    try {
        const result = await (window as any).VencordNative?.themeLibrary?.list?.();
        if (result?.ok) return { status: "ok", themes: result.themes };
        return { status: "error", reason: result?.reason ?? "offline" };
    } catch {
        return { status: "error", reason: "offline" };
    }
}

export type InstallResult =
    | { ok: true; fileName: string; }
    | { ok: false; reason: "download" | "empty" | "save"; };

export async function installTheme(theme: CatalogueTheme): Promise<InstallResult> {
    try {
        const result = await (window as any).VencordNative?.themeLibrary?.install?.(theme.id, theme.name);
        if (result?.ok) return { ok: true, fileName: result.fileName };
        return { ok: false, reason: result?.reason === "empty" ? "empty" : result?.reason === "save" ? "save" : "download" };
    } catch {
        return { ok: false, reason: "download" };
    }
}

export function openThemePage(theme: CatalogueTheme): void {
    (window as any).VencordNative?.themeLibrary?.openPage?.(theme.id);
}
