/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// ─── Layer 1: Scanner (data extraction ONLY — no scoring, no rendering) ──────
// One synchronous pass over the plugin registry, reading existing in-memory
// fields. No loops, no listeners, no persistent allocations.

import { isPluginEnabled } from "@api/PluginManager";
import Plugins from "~plugins";

/**
 * continuous = runs/renders in the background throughout the session (Flux,
 * patches, message listeners, member-list/message/profile render surfaces,
 * header-bar/user-area/profile-badge injects).
 * ondemand   = does nothing until the user acts (slash commands, context
 * menus, message-popover button, chat-bar button) — no persistent cost.
 */
export type PluginType = "continuous" | "ondemand";

export interface RawPluginStat {
    name: string;
    patches: number;     // webpack code patches
    listeners: number;   // Flux events + message listeners
    uiInjects: number;   // context menus + every declarative UI surface
    hooks: number;       // slash commands
    type: PluginType;    // continuous (background) vs on-demand (user-triggered)
}

/** Single synchronous snapshot of every enabled plugin's footprint. */
export function scanPlugins(): RawPluginStat[] {
    const out: RawPluginStat[] = [];

    for (const name of Object.keys(Plugins)) {
        if (!isPluginEnabled(name)) continue;

        const p = Plugins[name];
        if (!p) continue;

        const patches = p.patches?.length ?? 0;
        const hooks = p.commands?.length ?? 0;

        // Flux events + the message listeners (each runs on a recurring event,
        // so they belong with Flux subscriptions, not the UI surfaces below).
        let listeners = p.flux ? Object.keys(p.flux).length : 0;
        if (p.onMessageClick) listeners++;
        if (p.onBeforeMessageSend) listeners++;
        if (p.onBeforeMessageEdit) listeners++;

        // Count context menus + every UI surface a plugin can declare
        // (mirrors the declarative fields on PluginDef in src/utils/types.ts).
        let uiInjects = p.contextMenus ? Object.keys(p.contextMenus).length : 0;
        if (p.userProfileBadge) uiInjects++;
        if (p.userProfileBadges) uiInjects++;
        if (p.messagePopoverButton) uiInjects++;
        if (p.chatBarButton) uiInjects++;
        if (p.chatBarButtonWrapper) uiInjects++;
        if (p.headerBarButton) uiInjects++;
        if (p.userAreaButton) uiInjects++;
        if (p.renderMessageAccessory) uiInjects++;
        if (p.renderMessageDecoration) uiInjects++;
        if (p.renderMemberListDecorator) uiInjects++;
        if (p.renderNicknameIcon) uiInjects++;
        if (p.renderProfileSection) uiInjects++;
        if (p.renderProfileCollection) uiInjects++;
        if (p.toolboxActions) uiInjects++;

        // Classify: continuous if it has any background-running signal. `listeners`
        // already folds in flux + onMessage* hooks, `patches` the webpack patches;
        // the rest are the always-rendering surfaces. Everything else (commands,
        // context menus, message-popover/chat-bar buttons) is purely on-demand.
        const isContinuous =
            patches > 0 ||
            listeners > 0 ||
            !!(p.renderMessageAccessory || p.renderMessageDecoration || p.renderMemberListDecorator ||
                p.renderNicknameIcon || p.renderProfileSection || p.renderProfileCollection ||
                p.headerBarButton || p.userAreaButton || p.userProfileBadge || p.userProfileBadges);
        const type: PluginType = isContinuous ? "continuous" : "ondemand";

        out.push({ name, patches, listeners, uiInjects, hooks, type });
    }

    return out;
}

/** Optional single heap sample in MB. Returns null if the API is unavailable. */
export function sampleHeapMB(): number | null {
    const mem = (performance as { memory?: { usedJSHeapSize?: number; }; }).memory;
    const used = mem?.usedJSHeapSize;
    return typeof used === "number" ? Math.round(used / 1048576) : null;
}
