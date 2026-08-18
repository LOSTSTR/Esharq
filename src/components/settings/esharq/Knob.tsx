/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./voiceLab.css";

import { React, useCallback, useRef, useState } from "@webpack/common";

import { ACCENT } from "./tokens";

/** مدى الدوران: من ‎−135°‎ إلى ‎+135°‎ — أي 270° كما في تصميم المالك. */
const SWEEP = 270;
const HALF = SWEEP / 2;

/**
 * مقبض دوّار: يُسحَب في دائرة لضبط قيمة، ويستقرّ على أقرب درجة عند الإفلات.
 *
 * الزاوية تُحسَب من مركز القرص بـ`atan2`، فالقيمة تتبع **موضع الإصبع** لا
 * مقدار حركته — وهو ما يجعل السحب الدائري يعمل كما يتوقّعه البصر. وخارج
 * المدى (القوس السفلي المفتوح) تُقصّ الزاوية إلى أقرب طرف بدل أن تقفز
 * القيمة من أقصاها إلى أدناها.
 *
 * وهو **منزلق فعلاً** لقارئ الشاشة ولوحة المفاتيح (`role="slider"`): من لا
 * يستطيع السحب الدائري يضبط القيمة بالأسهم.
 */
export function Knob({ value, min, max, step, label, format, disabled, onChange }: {
    value: number;
    min: number;
    max: number;
    /** درجة الاستقرار عند الإفلات. */
    step: number;
    label: string;
    format?: (v: number) => string;
    disabled?: boolean;
    onChange: (v: number) => void;
}) {
    const [dragging, setDragging] = useState(false);
    // 🔴 الحالة وحدها لا تكفي: `pointerdown` و`pointermove` قد يقعان في نفس المهمّة،
    // فتُقرأ `dragging` القديمة (false) ويُهمَل الحدث. المرجع يُحدَّث فوراً.
    const draggingRef = useRef(false);
    const discRef = useRef<HTMLDivElement>(null);

    const clamp = (v: number) => Math.min(max, Math.max(min, v));
    const snap = (v: number) => clamp(Math.round(v / step) * step);

    const valueAt = useCallback((clientX: number, clientY: number): number => {
        const el = discRef.current;
        if (el == null) return value;
        const box = el.getBoundingClientRect();
        const dx = clientX - (box.left + box.width / 2);
        const dy = clientY - (box.top + box.height / 2);
        // 0° = أعلى القرص. `atan2` يقيس من محور +س، فنُضيف 90°.
        let deg = Math.atan2(dy, dx) * 180 / Math.PI + 90;
        if (deg > 180) deg -= 360;
        deg = Math.min(HALF, Math.max(-HALF, deg));
        return clamp(min + ((deg + HALF) / SWEEP) * (max - min));
    }, [min, max, value]);

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        draggingRef.current = true;
        setDragging(true);
        onChange(valueAt(e.clientX, e.clientY));
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current) return;
        onChange(valueAt(e.clientX, e.clientY));
    };

    // الاستقرار يُحسَب من **موضع الإفلات** لا من `value` المُغلَقة في هذا التصيير:
    // لو وصل الإفلات في نفس مهمّة آخر حركة لكانت القيمة المقروءة قديمة، فاستقرّ
    // المقبض على درجةٍ سبقت سحب المستخدم.
    const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current) return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        draggingRef.current = false;
        setDragging(false);
        onChange(snap(valueAt(e.clientX, e.clientY)));
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (disabled) return;
        const delta = e.key === "ArrowRight" || e.key === "ArrowUp" ? step
            : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step
                : e.key === "Home" ? min - value
                    : e.key === "End" ? max - value
                        : 0;
        if (delta === 0) return;
        e.preventDefault();
        onChange(clamp(value + delta));
    };

    const deg = ((clamp(value) - min) / (max - min)) * SWEEP - HALF;

    return (
        <div className="esharq-knob-wrap" style={{ ["--esharq-knob-accent" as any]: ACCENT, opacity: disabled ? 0.45 : 1 }}>
            <div className="esharq-knob-track">
                <span className="esharq-knob-zero" />
                <div
                    ref={discRef}
                    className={"esharq-knob" + (dragging ? " dragging" : "")}
                    style={{ transform: `rotate(${deg}deg)` }}
                    role="slider"
                    tabIndex={disabled ? -1 : 0}
                    aria-label={label}
                    aria-valuemin={min}
                    aria-valuemax={max}
                    aria-valuenow={Math.round(value)}
                    aria-disabled={disabled}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onKeyDown={onKeyDown}
                />
            </div>
            <div className="esharq-knob-value">{format ? format(value) : Math.round(value)}</div>
            <div className="esharq-knob-label">{label}</div>
        </div>
    );
}
