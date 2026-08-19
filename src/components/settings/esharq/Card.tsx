/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./motion.css";

import { React } from "@webpack/common";

import { stagger } from "./motion";
import { ACCENT, ACCENT_SOFT, RADIUS, SURFACE, UNIT } from "./tokens";

/**
 * بطاقة إشراق — **الوحدة البنائية لكل صفحة**.
 *
 * كانت مكرّرة في صفحة اللغة وحدها، ثم احتاجتها صفحة النسخ والاستعادة.
 * ونسخُها مرّةً ثانية يعني أن أي تعديل في الشكل يجب أن يُتذكَّر في موضعين —
 * وهو ما لا يحدث أبداً.
 */
/**
 * نبرة الوسم: اللون يحمل المعنى **مع النصّ لا بدلاً منه** — فمن لا يميّز
 * الألوان يقرأ الحال مكتوباً كما هو.
 *
 * `ok` ما يعمل · `danger` ما لا يعمل أو ينقص · `warn` ما يحتاج انتباهاً ·
 * `info` وصفٌ محايد (اختياري · المنصّة · عدد) — وهو الافتراضي.
 */
export type BadgeTone = "ok" | "danger" | "warn" | "info";

const BADGE_TONES: Record<BadgeTone, { fg: string; bg: string; }> = {
    ok: { fg: "var(--status-positive, #23a55a)", bg: "rgb(35 165 90 / 14%)" },
    danger: { fg: "var(--status-danger, #f23f43)", bg: "rgb(242 63 67 / 14%)" },
    warn: { fg: ACCENT, bg: ACCENT_SOFT },
    info: { fg: "var(--text-muted)", bg: SURFACE[3] }
};

export function Card({ title, subtitle, badge, badgeTone = "info", index = 0, children }: {
    title: string;
    subtitle?: string;
    /** وسم صغير في زاوية العنوان — لحال أو صيغة. */
    badge?: string;
    badgeTone?: BadgeTone;
    index?: number;
    children?: React.ReactNode;
}) {
    const tone = BADGE_TONES[badgeTone];
    return (
        <div className="esharq-rise" style={{
            ...stagger(index),
            background: SURFACE[1],
            borderRadius: RADIUS,
            padding: UNIT * 3,
            marginBottom: UNIT * 2.5
        }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: UNIT * 2 }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
                {badge !== undefined && (
                    <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: `2px ${UNIT}px`,
                        borderRadius: 999,
                        background: tone.bg,
                        color: tone.fg,
                        whiteSpace: "nowrap"
                    }}>
                        {badge}
                    </span>
                )}
            </div>
            {subtitle !== undefined && (
                <div style={{ opacity: 0.6, fontSize: 13, marginTop: UNIT / 2 }}>{subtitle}</div>
            )}
            {children !== undefined && (
                <div style={{ marginTop: UNIT * 2, paddingTop: UNIT * 2, borderTop: `1px solid ${SURFACE[3]}` }}>
                    {children}
                </div>
            )}
        </div>
    );
}

/**
 * صفّ لوحات أرقام — قيمة كبيرة فوق تسمية صغيرة.
 *
 * يُستعمل حيث تُلخّص الصفحة حالتها في أرقام قليلة قبل التفاصيل: القارئ يرى
 * الجواب أوّلاً، ثم يقرأ إن أراد. و`minmax` تمنع اللوحة من الانكماش تحت
 * نصّها فينكسر السطر في نافذة ضيّقة.
 */
export function StatRow({ items }: { items: readonly { label: string; value: string; }[]; }) {
    return (
        <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fit, minmax(${UNIT * 20}px, 1fr))`,
            gap: UNIT * 1.5
        }}>
            {items.map(item => (
                // `esharq-lift` يرفع اللوحة قليلاً عند التحويم — نفس ما يفعله
                // رأس صفحة الإضافات، فتُقرأ اللوحات لغةً واحدة عبر الصفحات.
                <div key={item.label} className="esharq-lift" style={{
                    background: SURFACE[2],
                    borderRadius: RADIUS / 1.5,
                    padding: `${UNIT * 1.5}px ${UNIT * 2}px`
                }}>
                    <div style={{ fontSize: 15, fontWeight: 600, wordBreak: "break-word" }}>{item.value}</div>
                    <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2 }}>{item.label}</div>
                </div>
            ))}
        </div>
    );
}

/**
 * سطر حالة: تسمية ووصف على جهة، وشارة ملوّنة على الأخرى.
 *
 * اللون يحمل المعنى، والنصّ يحمله أيضاً — فمن لا يميّز الألوان يقرأ الحال
 * نفسه مكتوباً.
 */
export function StatusRow({ title, detail, state, index = 0 }: {
    title: string;
    detail?: string;
    state: { text: string; tone: "ok" | "warn" | "idle"; };
    index?: number;
}) {
    const color = state.tone === "ok"
        ? "var(--status-positive, #23a55a)"
        : state.tone === "warn" ? ACCENT : "var(--text-muted)";

    return (
        <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: UNIT * 2,
            paddingTop: index === 0 ? 0 : UNIT * 1.5,
            marginTop: index === 0 ? 0 : UNIT * 1.5,
            borderTop: index === 0 ? undefined : `1px solid ${SURFACE[2]}`
        }}>
            <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14 }}>{title}</div>
                {detail !== undefined && (
                    <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2, wordBreak: "break-word" }}>{detail}</div>
                )}
            </div>
            <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: UNIT,
                fontSize: 12,
                whiteSpace: "nowrap",
                color
            }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: color }} />
                {state.text}
            </span>
        </div>
    );
}

/**
 * شريط تنبيه — حدّه على **بداية السطر** لا يساره، فينقلب مع العربية.
 *
 * `tone` يميّز «اعلم هذا» من «هذا يُتلف شيئاً»: توحيدهما يجعل القارئ
 * يتخطّى الاثنين.
 */
export function NoticeStrip({ tone = "info", children }: {
    tone?: "info" | "danger";
    children: React.ReactNode;
}) {
    const color = tone === "danger" ? "var(--status-danger, #f23f43)" : ACCENT;
    return (
        <div style={{
            borderInlineStart: `3px solid ${color}`,
            background: tone === "danger" ? "rgb(242 63 67 / 7%)" : "rgb(201 162 39 / 8%)",
            borderRadius: RADIUS / 2,
            padding: `${UNIT * 1.5}px ${UNIT * 2}px`,
            fontSize: 13,
            marginBottom: UNIT * 2.5,
            lineHeight: 1.6
        }}>
            {children}
        </div>
    );
}
