/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./gateOverlay.css";

import { t } from "@utils/esharqI18n";
import { React, useEffect, useRef, useState } from "@webpack/common";

import { SlideToUnlock } from "./SlideToUnlock";

/**
 * **بوّابة صفحة كاملة** — لوح زجاجيّ لا يُرى خلفه شيء.
 *
 * 🔴 والصفحة **لا تُصيَّر أصلاً** ما دامت مقفلة، لا تُخفى بالأنماط. والفرق
 * جوهريّ: المُخفى بـ`display` أو بضبابٍ يبقى في الشجرة — يبلغه `Tab`، ويقرؤه
 * قارئ الشاشة، ويجده البحث في الصفحة. فتكون البوّابة ستارةً لا باباً.
 *
 * وهنا لا يوجد وراء اللوح إلّا الخلفية: لا أزرار ولا قوائم ولا نصّ.
 */
export function GateOverlay({ unlocked, onUnlock, title, subtitle, warnings, slideLabel }: {
    unlocked: boolean;
    onUnlock: () => void;
    title: string;
    subtitle: string;
    /** بنود التحذير — تُعرض حمراء، بندٌ في سطر. */
    warnings: readonly React.ReactNode[];
    slideLabel: string;
}) {
    const [latched, setLatched] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);

    if (unlocked) return null;

    return (
        <div className={"esharq-gate" + (latched ? " opening" : "")}>
            <div className="esharq-gate-glass" role="group" aria-label={title}>
                <div className="esharq-gate-lock" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="24" height="24">
                        <path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" fill="currentColor" />
                    </svg>
                </div>

                <h2 className="esharq-gate-title">{title}</h2>
                <p className="esharq-gate-sub">{subtitle}</p>

                <div className="esharq-gate-warn">
                    <div className="esharq-gate-warn-head">
                        <span aria-hidden="true">⚠</span>
                        {t("اقرأ قبل الفتح", "Read before opening")}
                    </div>
                    <ul>
                        {warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                </div>

                <SlideToUnlock
                    label={slideLabel}
                    unlockedLabel={t("مفتوح", "Unlocked")}
                    unlocked={latched}
                    onUnlock={() => {
                        setLatched(true);
                        // يستقرّ النابض ويُقرأ «مفتوح» قبل أن تظهر الصفحة —
                        // الكشف اللحظيّ يبتلع الحركة التي تُخبره أن سحبه نجح.
                        timer.current = setTimeout(onUnlock, 460);
                    }}
                />

                <p className="esharq-gate-foot">
                    {t("لا يُنفَّذ شيء بمجرّد الفتح — الفتح يُظهر الصفحة فقط.",
                        "Nothing runs just because you open this — it only reveals the page.")}
                </p>
            </div>
        </div>
    );
}
