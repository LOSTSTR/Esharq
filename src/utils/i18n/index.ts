/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isArabicMode } from "@utils/esharqI18n";

import pluginI18n from "~i18n";

import type { LocalizedString } from "./types";

/**
 * Drift tracker. Records only DRIFT — a plugin that HAS an overlay entry but is
 * missing the specific key being requested (e.g. upstream added an option and
 * the translation lagged). Plain absence (no overlay entry at all) is NOT
 * tracked: it is a permitted, often-intentional state, not an actionable gap.
 *
 * Strictly local: an in-memory deduped Set, surfaced only via getMissedI18nKeys
 * for a local debug view. Never transmitted anywhere.
 */
const missedKeys = new Set<string>();

function trackDrift(key: string): void {
    if (missedKeys.has(key)) return;
    missedKeys.add(key);
    if (IS_DEV) console.warn(`[Esharq i18n] drift — overlay exists but key missing: ${key}`);
}

// عزل ثنائي الاتجاه: نغلّف كل نصّ عربي (وصف/خيار/تسمية إضافة) بعازل RTL (RLI U+2067 …
// PDI U+2069) فيُعرَض من اليمين لليسار مهما كان اتجاه حاوية الإعدادات، مع بقاء الأسماء
// اللاتينية بداخله (Esharq/MicPro/AGC…) LTR في مكانها — يحلّ تشوّه العربية المختلطة.
const HAS_ARABIC = /[؀-ۿ]/;
const RLI = String.fromCharCode(0x2067);
const PDI = String.fromCharCode(0x2069);
function rtl(s: string): string {
    return HAS_ARABIC.test(s) ? RLI + s + PDI : s;
}

function pick(str: LocalizedString, original: string): string {
    return isArabicMode() ? rtl(str.ar) : (str.en ?? original);
}

/**
 * Resolve a plugin's description. Returns the overlay translation when present,
 * otherwise the original string the plugin already ships (override-or-original).
 * Never throws — a missing overlay degrades silently to the original.
 */
export function resolvePluginDescription(pluginName: string, original: string): string {
    const desc = pluginI18n[pluginName]?.description;
    return desc ? pick(desc, original) : original;
}

/**
 * Resolve a single option's description. Same override-or-original contract.
 * Fires the drift tracker only when the plugin has an options overlay but this
 * specific key is absent from it.
 */
export function resolvePluginOption(pluginName: string, key: string, original: string): string {
    const entry = pluginI18n[pluginName];
    const opt = entry?.options?.[key];
    if (!opt) {
        if (entry?.options && !(key in entry.options)) trackDrift(`${pluginName}.options.${key}`);
        return original;
    }
    return pick(opt, original);
}

/**
 * Resolve a single SELECT choice's display label, keyed by the choice `value`
 * (stable id). Same override-or-original contract: returns the overlay
 * translation when present, otherwise the original English label — so
 * brand/format choices (Catbox, JSON, png, font names…) that have no entry
 * stay English untouched. Called per-render so it toggles with the language.
 */
export function resolvePluginSelectLabel(pluginName: string, key: string, value: string, original: string): string {
    const choice = pluginI18n[pluginName]?.options?.[key]?.choices?.[value];
    return choice ? pick(choice, original) : original;
}

/**
 * Resolve a `toolboxActions` label (the toolbox quick-action menu), keyed by
 * the original English label. Override-or-original: a label with no overlay
 * entry stays English. Called per-render so it toggles with the language.
 */
export function resolvePluginToolboxAction(pluginName: string, label: string): string {
    const entry = pluginI18n[pluginName]?.toolboxActions?.[label];
    return entry ? pick(entry, label) : label;
}

/** Local-only snapshot of drifted keys observed this session, for a debug view. */
export const getMissedI18nKeys = (): string[] => [...missedKeys];
