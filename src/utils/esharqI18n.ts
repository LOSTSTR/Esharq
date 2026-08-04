/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { prefsReady, readPluginsArabic } from "./esharqPrefs";

/**
 * Frozen, per-session snapshot of the plugin-localization flag. Captured once on
 * the first read taken AFTER the settings store is ready, then kept constant until
 * the next client restart. The setting carries `restartNeeded`, so toggling it
 * takes effect on restart — at which point this re-reads the new value. Freezing
 * means EVERY `t()` call (whether evaluated at module load or at render time)
 * returns the same language, so translations can never end up in a mixed
 * half-Arabic/half-English state.
 *
 * المفتاح يسكن الآن في إعدادات DiscordArabicizer (باسم `pluginsArabic`) بدل إضافة
 * Settings؛ يتكفّل esharqPrefs بالقراءة وبالترحيل من المفتاح القديم.
 */
let arabicModeSnapshot: boolean | undefined;

export function isArabicMode(): boolean {
    if (arabicModeSnapshot !== undefined) return arabicModeSnapshot;

    const value = readPluginsArabic();
    // Only lock in the snapshot once the settings store actually exists; before
    // that we return the best-effort default without freezing, so an early call
    // can't permanently capture the wrong value.
    if (prefsReady()) arabicModeSnapshot = value;
    return value;
}

// عزل ثنائي الاتجاه: نغلّف كل نصّ عربي بعازل RTL (RLI U+2067 … PDI U+2069) فيُعرَض من
// اليمين لليسار مهما كان اتجاه حاوية ديسكورد (LTR افتراضاً)، مع بقاء الكلمات اللاتينية
// المضمّنة (Esharq / QuickCSS / Ctrl+Q …) LTR في مكانها — يحلّ تشوّه العربية المختلطة في
// كامل واجهة إشراق. نفس التحسين المطبَّق على القاموس والـoverlay، لكن هنا يشمل كل نصوص t().
const HAS_ARABIC = /[؀-ۿ]/;
const RLI = String.fromCharCode(0x2067);
const PDI = String.fromCharCode(0x2069);

/**
 * Returns `ar` (bidi-isolated) when Arabic mode is on, `en` otherwise. The result
 * reflects the language chosen at the last restart (see {@link isArabicMode}); changing
 * the setting applies after a restart. Because the language is frozen per session, `t()`
 * is safe to use anywhere — module-load object literals, render bodies, settings
 * descriptions, SELECT choices — without worrying about evaluation time.
 *
 * @example
 *   description: t("وصف عربي", "English description")
 */
export function t(ar: string, en: string): string {
    if (!isArabicMode()) return en;
    // RLI…PDI يفرض اتجاه RTL ويعزل ما بداخله عن اتجاه الحاوية (يعالج النص المختلط عربي/لاتيني).
    return HAS_ARABIC.test(ar) ? RLI + ar + PDI : ar;
}
