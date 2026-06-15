/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// ─── Layer 2: Processing (risk scoring + aggregation — pure, no I/O) ─────────

import type { RawPluginStat } from "./scanner";

export type RiskLevel = "low" | "medium" | "high";

export interface ScoredPlugin extends RawPluginStat {
    risk: number;
    level: RiskLevel;
}

/** riskScore = (patches*2) + (listeners*3) + (uiInjects*1.5) */
export function scorePlugin(s: RawPluginStat): ScoredPlugin {
    const risk = (s.patches * 2) + (s.listeners * 3) + (s.uiInjects * 1.5);
    const level: RiskLevel = risk <= 10 ? "low" : risk <= 25 ? "medium" : "high";
    return { ...s, risk: Math.round(risk * 10) / 10, level };
}

/** Score every row and pre-sort by risk (descending). */
export function processSnapshot(raw: RawPluginStat[]): ScoredPlugin[] {
    return raw.map(scorePlugin).sort((a, b) => b.risk - a.risk);
}

export interface SnapshotSummary {
    total: number;        // total scanned plugins
    continuous: number;   // how many run in the background
    totalRisk: number;    // sum of every plugin's load (rough total footprint)
}

/** Aggregate footer stats — pure, derived from the already-scored rows. */
export function summarize(rows: ScoredPlugin[]): SnapshotSummary {
    let continuous = 0;
    let totalRisk = 0;
    for (const r of rows) {
        if (r.type === "continuous") continuous++;
        totalRisk += r.risk;
    }
    return { total: rows.length, continuous, totalRisk: Math.round(totalRisk * 10) / 10 };
}
