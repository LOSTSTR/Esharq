/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./slideToUnlock.css";

import { React, useCallback, useEffect, useRef, useState } from "@webpack/common";

/** حشوة المسار حول المقبض ومقاسه — منهما تُحسب أقصى إزاحة. */
const PAD = 5;
const THUMB = 46;

/** نسبة المسار التي يجب تجاوزها ليُثبَّت الفتح؛ ما دونها يعود المقبض نابضاً. */
const LATCH = 0.85;

/**
 * **اسحب لتفتح** — بوّابة قصدٍ لا زرّ.
 *
 * الفرق عن زرّ «موافق» ليس شكلياً: الزرّ يُضغط بحركة واحدة قد تقع سهواً أو
 * على عجل، والسحب عبر المسار كلّه **حركة لا تقع بالخطأ**. فما وراءها لا
 * يُفتح إلّا بقصد.
 *
 * ## قواعد الحركة (تصميم المالك)
 *
 *   • أثناء السحب يلاحق المقبض المؤشّر **1:1** — والانتقال يُلغى، وإلّا تأخّر
 *     عن الإصبع فبدا ثقيلاً.
 *   • عند الإفلات: تجاوزَ 85% ⇒ يستقرّ مفتوحاً في أقصى المسار؛ وإلّا رجع
 *     إلى بدايته بنابض `cubic-bezier(0.34, 1.56, 0.64, 1)`.
 *
 * ## 🔴 لماذا يُقاس الموضع من المسار في كل حدث
 *
 * لا من مجموع الإزاحات: `pointerdown` و`pointermove` قد يقعان في مهمّة
 * واحدة فتُقرأ حالةٌ قديمة وتضيع أوّل حركة — وهو العطب نفسه الذي عولج في
 * المقبض الدوّار. وكذلك موضع الإفلات يُحسب من حدث الإفلات نفسه لا من الحالة
 * المُغلَقة في هذا التصيير.
 *
 * وهو **مفتوحٌ للوحة المفاتيح** أيضاً: من لا يستطيع السحب يفتحه بـ`Enter`
 * أو المسافة أو `End` — فبوّابة القصد لا يجوز أن تكون بوّابة إقصاء.
 */
export function SlideToUnlock({ label, unlockedLabel, unlocked, onUnlock }: {
    /** ما يُقرأ داخل المسار وهو مقفل — وهو نفسه تسمية قارئ الشاشة. */
    label: string;
    /** ما يُقرأ بعد الفتح. */
    unlockedLabel: string;
    unlocked: boolean;
    onUnlock: () => void;
}) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [max, setMax] = useState(0);
    const [x, setX] = useState(0);
    const [dragging, setDragging] = useState(false);
    // الحالة وحدها لا تكفي — انظر التعليق أعلاه.
    const draggingRef = useRef(false);
    /** مسافة الإمساك داخل المقبض، كي لا يقفز تحت الإصبع عند أول حركة. */
    const grabRef = useRef(0);

    // أقصى إزاحة تُقاس من المسار حيّاً: لوحة الإعدادات تتغيّر عرضاً مع النافذة،
    // فقياسٌ مرّة واحدة يترك المقبض المفتوح معلّقاً في منتصف مسارٍ صار أعرض.
    useEffect(() => {
        const el = trackRef.current;
        if (el == null) return;
        const measure = () => setMax(Math.max(0, el.clientWidth - THUMB - PAD * 2));
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    /** المفتوح يبقى في أقصى المسار مهما تغيّر عرضه. */
    const at = unlocked ? max : x;

    const xAt = useCallback((clientX: number) => {
        const el = trackRef.current;
        if (el == null) return 0;
        const box = el.getBoundingClientRect();
        return Math.min(max, Math.max(0, clientX - box.left - PAD - grabRef.current));
    }, [max]);

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (unlocked) return;
        grabRef.current = e.clientX - e.currentTarget.getBoundingClientRect().left;
        e.currentTarget.setPointerCapture(e.pointerId);
        draggingRef.current = true;
        setDragging(true);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current) return;
        setX(xAt(e.clientX));
    };

    const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current) return;
        // موضع الإفلات من حدث الإفلات نفسه: لو قُرئ من الحالة لكان أحياناً
        // أقدم من آخر حركة، فيرتدّ سحبٌ بلغ آخر المسار.
        const end = xAt(e.clientX);
        e.currentTarget.releasePointerCapture(e.pointerId);
        draggingRef.current = false;
        setDragging(false);
        if (max > 0 && end / max >= LATCH) {
            setX(max);
            onUnlock();
        } else {
            setX(0);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (unlocked) return;
        if (e.key !== "Enter" && e.key !== " " && e.key !== "ArrowRight" && e.key !== "End") return;
        e.preventDefault();
        setX(max);
        onUnlock();
    };

    // النصّ يبهت مع تقدّم السحب فيكشف ما تحته — وأسرع من التقدّم قليلاً كي
    // يختفي قبل أن يبلغه المقبض بدل أن يُقرأ من تحته.
    const progress = max > 0 ? at / max : 0;
    const labelOpacity = unlocked ? 1 : Math.max(0, 1 - progress * 1.7);

    return (
        <div className={"esharq-slide" + (dragging ? " dragging" : "") + (unlocked ? " unlocked" : "")}>
            <div className="esharq-slide-track" ref={trackRef}>
                {/* 🔴 الملء بمقاس المقبض تماماً وفي حشوته نفسها، فيختفي خلفه عند
                    السكون. حين كان بارتفاع المسار كلّه بقي منه هلالٌ أخضر يطلّ من
                    فوق المقبض وتحته ومن يساره — فيبدو المقفل مفتوحاً. وعند
                    الاستقرار يمتدّ إلى المسار كلّه (صنف `unlocked` في الأنماط). */}
                <i className="esharq-slide-fill" style={{ inlineSize: unlocked ? "100%" : at + THUMB }} />
                <span className="esharq-slide-text" style={{ opacity: labelOpacity }}>
                    {unlocked ? unlockedLabel : label}
                </span>
                <div
                    className="esharq-slide-thumb"
                    style={{ left: PAD + at }}
                    role="button"
                    tabIndex={unlocked ? -1 : 0}
                    aria-label={label}
                    aria-pressed={unlocked}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onKeyDown={onKeyDown}
                >
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                        <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2"
                            strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            </div>
        </div>
    );
}
