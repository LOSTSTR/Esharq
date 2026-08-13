/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./motion.css";

import { React } from "@webpack/common";

import { stagger } from "./motion";
import { ACCENT, RADIUS, SURFACE, UNIT } from "./tokens";

/**
 * بطاقة إشراق — **الوحدة البنائية لكل صفحة**.
 *
 * كانت مكرّرة في صفحة اللغة وحدها، ثم احتاجتها صفحة النسخ والاستعادة.
 * ونسخُها مرّةً ثانية يعني أن أي تعديل في الشكل يجب أن يُتذكَّر في موضعين —
 * وهو ما لا يحدث أبداً.
 */
export function Card({ title, subtitle, badge, index = 0, children }: {
    title: string;
    subtitle?: string;
    /** وسم صغير في زاوية العنوان — لحال أو صيغة. */
    badge?: string;
    index?: number;
    children?: React.ReactNode;
}) {
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
                        padding: `2px ${UNIT}px`,
                        borderRadius: 999,
                        background: SURFACE[3],
                        color: "var(--text-muted)",
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
