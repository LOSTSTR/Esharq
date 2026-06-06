/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { t } from "@utils/esharqI18n";
import { formatDurationMs } from "@utils/text";
import { saveFile } from "@utils/web";
import { ChannelStore, UserStore } from "@webpack/common";

import { AggregatedStats, shortDayLabel } from "./types";

// ── Canvas constants ──────────────────────────────────────────

const W = 600;
const PAD = 24;
const SCALE = 2;
const FONT = '"gg sans", "Noto Sans", system-ui, sans-serif';

const C = {
    bg: "#0b0b0f",
    card: "#161620",
    section: "#1c1c27",
    border: "#242432",
    accent: "#e02244",
    blurple: "#5865f2",
    green: "#3ba55c",
    gold: "#faa81a",
    pink: "#eb459e",
    t1: "#f0f0f8",
    t3: "#9494b0",
    t5: "#3a3a52",
} as const;

// ── Drawing helpers ───────────────────────────────────────────

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function txt(
    ctx: CanvasRenderingContext2D,
    str: string,
    x: number,
    y: number,
    size: number,
    color: string,
    weight = "400",
    align: CanvasTextAlign = "left",
): void {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(str, x, y);
    ctx.textAlign = "left";
}

function label(ctx: CanvasRenderingContext2D, text: string, y: number): void {
    txt(ctx, text, PAD, y, 10, C.t5, "700");
}

// ── Section renderers ─────────────────────────────────────────

function drawHeader(ctx: CanvasRenderingContext2D, username: string, weekStart: string, h: number): void {
    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, W, h);
    grad.addColorStop(0, "#1a0a10");
    grad.addColorStop(0.5, "#0f0f1a");
    grad.addColorStop(1, "#0e0e1c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, h);

    // Crimson glow orb (top-right decoration)
    const glow = ctx.createRadialGradient(W - 60, 30, 0, W - 60, 30, 80);
    glow.addColorStop(0, "rgba(224,34,68,0.25)");
    glow.addColorStop(1, "rgba(224,34,68,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(W - 140, 0, 140, h);

    // Blurple glow orb (bottom-left)
    const glow2 = ctx.createRadialGradient(40, h, 0, 40, h, 70);
    glow2.addColorStop(0, "rgba(88,101,242,0.2)");
    glow2.addColorStop(1, "rgba(88,101,242,0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, h - 70, 110, 70);

    // Top accent stripe
    const stripe = ctx.createLinearGradient(0, 0, W, 0);
    stripe.addColorStop(0, C.accent);
    stripe.addColorStop(0.5, C.blurple);
    stripe.addColorStop(1, C.pink);
    ctx.fillStyle = stripe;
    ctx.fillRect(0, 0, W, 4);

    // Title
    txt(ctx, "Personal Analytics", PAD, 44, 22, C.t1, "700");

    // Subtitle — username + week
    txt(ctx, `${username}  •  Week of ${weekStart}`, PAD, 68, 13, C.t3, "400");

    // Small chart icon (right side)
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    rr(ctx, W - PAD - 42, 18, 42, 42, 10);
    ctx.fill();
    txt(ctx, "📊", W - PAD - 32, 48, 22, "white", "400", "left");
}

function drawStatCards(ctx: CanvasRenderingContext2D, y: number, stats: AggregatedStats): void {
    const cards = [
        { icon: "💬", value: stats.totalMessages.toLocaleString(), label: t("الرسائل", "Messages"), accent: C.blurple },
        { icon: "🎙️", value: formatDurationMs(stats.totalVoiceMs), label: t("الصوت", "Voice"), accent: C.green },
        { icon: "⭐", value: String(stats.totalReactionsGiven), label: t("التفاعلات", "Reactions"), accent: C.gold },
        { icon: "📅", value: `${stats.activeDays}/7`, label: t("الأيام النشطة", "Active days"), accent: C.pink },
    ];
    const cw = (W - PAD * 2 - 10 * 3) / 4;
    for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (!card) continue;
        const cx = PAD + i * (cw + 10);

        // Card bg
        ctx.fillStyle = C.card;
        rr(ctx, cx, y, cw, 78, 10);
        ctx.fill();

        // Accent left edge
        ctx.fillStyle = card.accent;
        rr(ctx, cx, y, 3, 78, 2);
        ctx.fill();

        // Icon
        txt(ctx, card.icon, cx + 12, y + 24, 16, "white");
        // Value
        txt(ctx, card.value, cx + 12, y + 48, 18, C.t1, "700");
        // Label
        txt(ctx, card.label, cx + 12, y + 66, 10, C.t3, "400");
    }
}

function drawBarChart(ctx: CanvasRenderingContext2D, y: number, data: Array<{ date: string; count: number; }>): number {
    const CH = 100; // chart height
    const barW = (W - PAD * 2 - 6 * 6) / 7;
    const max = Math.max(...data.map(d => d.count), 1);

    // Chart background
    ctx.fillStyle = C.card;
    rr(ctx, PAD, y, W - PAD * 2, CH + 24, 10);
    ctx.fill();

    for (let i = 0; i < data.length; i++) {
        const d = data[i];
        if (!d) continue;
        const bx = PAD + 8 + i * (barW + 6);
        const bh = d.count > 0 ? Math.max((d.count / max) * (CH - 16), 6) : 2;
        const by = y + CH - bh;

        // Bar gradient
        const barGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
        barGrad.addColorStop(0, C.blurple);
        barGrad.addColorStop(1, "rgba(88,101,242,0.4)");
        ctx.fillStyle = barGrad;
        rr(ctx, bx, by, barW, bh, 3);
        ctx.fill();

        // Day label
        txt(ctx, shortDayLabel(d.date).slice(0, 2), bx + barW / 2, y + CH + 15, 9, C.t3, "400", "center");
    }

    return CH + 24;
}

function drawChannels(ctx: CanvasRenderingContext2D, y: number, channels: Array<{ id: string; count: number; }>): number {
    const maxCount = channels[0]?.count ?? 1;
    const ROW = 26;
    const barTrackW = 120;

    for (let i = 0; i < channels.length; i++) {
        const ch = channels[i];
        if (!ch) continue;
        const ry = y + i * ROW;
        const chName = ChannelStore.getChannel(ch.id)?.name ?? ch.id;

        // Rank
        txt(ctx, `#${i + 1}`, PAD, ry + 14, 10, C.t5, "700");
        // Channel name
        txt(ctx, `#${chName}`, PAD + 24, ry + 14, 12, C.t3, "400");

        // Bar track
        const trackX = W - PAD - barTrackW - 36;
        ctx.fillStyle = C.section;
        rr(ctx, trackX, ry + 7, barTrackW, 5, 3);
        ctx.fill();

        // Bar fill
        const fillW = (ch.count / maxCount) * barTrackW;
        ctx.fillStyle = C.accent;
        rr(ctx, trackX, ry + 7, fillW, 5, 3);
        ctx.fill();

        // Count
        txt(ctx, String(ch.count), W - PAD, ry + 14, 11, C.t3, "600", "right");
    }
    return channels.length * ROW;
}

function drawHeatmap(ctx: CanvasRenderingContext2D, y: number, hours: number[]): void {
    const cellW = (W - PAD * 2 - 23 * 3) / 24;
    const cellH = 20;
    const max = Math.max(...hours, 1);

    for (let h = 0; h < 24; h++) {
        const cx = PAD + h * (cellW + 3);
        const alpha = (hours[h] ?? 0) > 0 ? 0.15 + ((hours[h] ?? 0) / max) * 0.85 : 0.07;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = C.accent;
        rr(ctx, cx, y, cellW, cellH, 3);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Hour labels
    const labelHours = [{ h: 0, label: "12am" }, { h: 6, label: "6am" }, { h: 12, label: "12pm" }, { h: 18, label: "6pm" }, { h: 23, label: "11pm" }];
    for (const { h, label: lbl } of labelHours) {
        const lx = PAD + h * (cellW + 3);
        txt(ctx, lbl, lx, y + cellH + 13, 9, C.t5, "400");
    }
}

function drawFooter(ctx: CanvasRenderingContext2D, y: number): void {
    // Divider
    ctx.fillStyle = C.border;
    ctx.fillRect(PAD, y, W - PAD * 2, 1);

    // Logo dot
    ctx.fillStyle = C.accent;
    ctx.beginPath();
    ctx.arc(PAD + 5, y + 18, 3, 0, Math.PI * 2);
    ctx.fill();

    txt(ctx, "PersonalAnalytics for Equicord", PAD + 14, y + 22, 10, C.t5, "400");
    txt(ctx, new Date().toLocaleDateString(), W - PAD, y + 22, 10, C.t5, "400", "right");
}

// ── Main entry ────────────────────────────────────────────────

export async function generateAndSave(stats: AggregatedStats, weekStart: string): Promise<void> {
    const user = UserStore.getCurrentUser();
    const username = user?.globalName ?? user?.username ?? "Unknown";

    // Calculate total canvas height
    const hasChannels = stats.topChannels.length > 0;
    const channelsH = hasChannels ? 16 + 14 + stats.topChannels.length * 26 + 12 : 0;
    const H = 96 + 14 + 88 + 16 + 14 + 124 + 12 + channelsH + 16 + 14 + 36 + 14 + 24 + 20;

    const canvas = document.createElement("canvas");
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;

    const rawCtx = canvas.getContext("2d");
    if (!rawCtx) return;
    rawCtx.scale(SCALE, SCALE);

    const ctx = rawCtx;

    // Fill base background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Draw sections, advancing y
    const headerH = 88;
    drawHeader(ctx, username, weekStart, headerH);

    let y = headerH + 14;

    drawStatCards(ctx, y, stats);
    y += 88;

    y += 16;
    label(ctx, "DAILY ACTIVITY", y);
    y += 14;
    y += drawBarChart(ctx, y, stats.dailyMessages);

    if (hasChannels) {
        y += 12;
        label(ctx, "TOP CHANNELS", y);
        y += 14;
        y += drawChannels(ctx, y, stats.topChannels);
    }

    y += 16;
    label(ctx, "ACTIVITY BY HOUR", y);
    y += 14;
    drawHeatmap(ctx, y, stats.aggHours);
    y += 36;

    y += 14;
    drawFooter(ctx, y);

    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => {
            if (b) resolve(b);
            else reject(new Error("Failed to generate image"));
        }, "image/png");
    });

    saveFile(new File([blob], `analytics-${weekStart.replace(/[^\w]/g, "-")}.png`, { type: "image/png" }));
}
