/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./motion.css";

import { Button } from "@components/Button";
import { CopyIcon } from "@components/Icons";
import { copyWithToast } from "@utils/discord";
import { t } from "@utils/esharqI18n";
import { React, useCallback, useEffect, useRef, useState } from "@webpack/common";

import { UNIT } from "./tokens";

/**
 * زرّ نسخ يُبدّل أيقونته إلى علامة صحّ ثم يعود.
 *
 * ## لماذا التبديل بدل الإشعار وحده
 *
 * `copyWithToast` يرفع إشعاراً في زاوية الشاشة — بعيداً عن الزرّ الذي ضغطه
 * المستخدم، فتنتقل عينه لتقرأ تأكيداً عن فعلٍ حدث في مكان آخر. والتأكيد
 * **في موضع الفعل** يُقرأ بلا انتقال، ويختفي وحده فلا يترك أثراً يُغلَق.
 *
 * ## 🔴 الأيقونتان متراكبتان لا متجاورتين
 *
 * `position: absolute` لكلتيهما داخل صندوق ثابت المقاس: لو تجاورتا لتغيّر
 * عرض الزرّ عند التبديل فقفز ما بعده. والتراكب يجعل التبديل **في مكانه**.
 *
 * 🔴 والمؤقّت يُلغى عند التفكيك: ضغطةٌ ثم إغلاق الصفحة قبل انقضاء 1.4s
 * تُنادي `setState` على مكوّن مُفكَّك — تحذير في الكونسول وتسريب صغير.
 *
 * 🔴 وحركة التبديل تُلغى مع `prefers-reduced-motion` في `motion.css`؛
 * الأيقونة تظهر وتختفي بلا تدرّج، والمعنى محفوظ.
 */
export function CopyButton({ text, label, copiedLabel, size = "small", variant, className }: {
    /** ما يُنسَخ. دالّة إن كان يُحسَب عند الضغط لا عند الرسم. */
    text: string | (() => string);
    label: string;
    copiedLabel?: string;
    size?: "small" | "medium";
    variant?: "primary" | "secondary";
    className?: string;
}) {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout>>(null);

    useEffect(() => () => {
        if (timer.current !== null) clearTimeout(timer.current);
    }, []);

    const onClick = useCallback(() => {
        copyWithToast(typeof text === "function" ? text() : text);
        setCopied(true);

        if (timer.current !== null) clearTimeout(timer.current);
        // 1.4s: أطول من أن تُفوَّت، وأقصر من أن يُظنّ الزرّ عالقاً.
        timer.current = setTimeout(() => setCopied(false), 1400);
    }, [text]);

    return (
        <Button
            size={size}
            variant={variant}
            onClick={onClick}
            className={className === undefined ? "esharq-press" : `esharq-press ${className}`}
        >
            <span style={{ display: "inline-flex", alignItems: "center", gap: UNIT }}>
                <span className={`esharq-swap${copied ? " esharq-swap-done" : ""}`}>
                    <CopyIcon className="esharq-swap-from" width={16} height={16} />
                    <CheckIcon className="esharq-swap-to" />
                </span>
                {copied ? copiedLabel ?? t("نُسخ", "Copied") : label}
            </span>
        </Button>
    );
}

/** علامة صحّ — مرسومة هنا لأن مجموعة الأيقونات لا تحمل واحدة مفردة. */
function CheckIcon({ className }: { className?: string; }) {
    return (
        <svg className={className} width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 12.5 9.5 18 20 6.5"
            />
        </svg>
    );
}
