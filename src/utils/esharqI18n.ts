/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";

/**
 * Frozen, per-session snapshot of the Arabic-mode flag. Captured once on the
 * first read taken AFTER the settings store is ready, then kept constant until
 * the next client restart. The `arabicMode` setting carries `restartNeeded`, so
 * toggling it takes effect on restart — at which point this re-reads the new
 * value. Freezing means EVERY `t()` call (whether evaluated at module load or at
 * render time) returns the same language, so translations can never end up in a
 * mixed half-Arabic/half-English state.
 */
let arabicModeSnapshot: boolean | undefined;

export function isArabicMode(): boolean {
    if (arabicModeSnapshot !== undefined) return arabicModeSnapshot;

    const pluginSettings = Settings.plugins as Record<string, Record<string, unknown>> | undefined;
    const value = pluginSettings?.Settings?.arabicMode === true;
    // Only lock in the snapshot once the settings store actually exists; before
    // that we return the best-effort default without freezing, so an early call
    // can't permanently capture the wrong value.
    if (pluginSettings?.Settings != null) arabicModeSnapshot = value;
    return value;
}

/**
 * Returns `ar` when Arabic mode is on, `en` otherwise. The result reflects the
 * language chosen at the last restart (see {@link isArabicMode}); changing the
 * setting applies after a restart. Because the language is frozen per session,
 * `t()` is safe to use anywhere — module-load object literals, render bodies,
 * settings descriptions, SELECT choices — without worrying about evaluation time.
 *
 * @example
 *   description: t("وصف عربي", "English description")
 */
export function t(ar: string, en: string): string {
    return isArabicMode() ? ar : en;
}
