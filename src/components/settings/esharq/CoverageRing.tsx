/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./motion.css";

import { React } from "@webpack/common";

import { ACCENT, SURFACE } from "./tokens";

/**
 * حلقة تقدّم — **النسبة تُرى قبل أن تُقرأ**.
 *
 * «5,848 من 22,489» رقمان يحتاجان قسمةً في رأس القارئ؛ والحلقة تقول «الربع»
 * في لمحة، ويبقى الرقمان لمن يريد الدقّة.
 *
 * 🔴 يتحرّك `stroke-dashoffset` لا العرض ولا نصف القطر: الأوّل يُنفَّذ بلا
 * إعادة تخطيط، والثاني يُعيد حساب الصفحة في كل إطار.
 */
export function CoverageRing({ percent, size = 92 }: { percent: number; size?: number; }) {
    const stroke = 8;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;

    // القيمة تبدأ من الصفر ثم تُحدَّث بعد الرسم، فيقع الانتقال المرئي.
    const [shown, setShown] = React.useState(0);
    React.useEffect(() => {
        const id = setTimeout(() => setShown(percent), 30);
        return () => clearTimeout(id);
    }, [percent]);

    const clamped = Math.max(0, Math.min(100, shown));

    return (
        <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
            <svg className="esharq-ring" width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke={SURFACE[3]} strokeWidth={stroke}
                />
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke={ACCENT} strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - clamped / 100)}
                />
            </svg>
            <div style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontWeight: 700,
                color: ACCENT
            }}>
                {Math.round(clamped)}%
            </div>
        </div>
    );
}
