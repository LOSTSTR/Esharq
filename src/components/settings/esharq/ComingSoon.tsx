/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { t } from "@utils/esharqI18n";
import { React } from "@webpack/common";

import { ACCENT, RADIUS, SURFACE, UNIT } from "./tokens";

/**
 * لوحة «قيد البناء» — تُعرَض للصفحات المخطَّطة التي لم تُبنَ بعد.
 *
 * وجودها مقصود: التصميم الجديد يعرض الأقسام الخمسة والصفحات الـ23 كاملةً،
 * فالمستخدم يرى الخريطة كلّها. الصفحة غير الجاهزة تقول ذلك بوضوح بدل أن
 * تختفي أو تُوهم بأنها تعمل.
 */
export function ComingSoon({ title }: { title: string; }) {
    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: UNIT * 2,
            minHeight: 320,
            padding: UNIT * 6,
            borderRadius: RADIUS,
            background: SURFACE[1],
            textAlign: "center"
        }}>
            <div style={{ fontSize: 34, color: ACCENT }}>✦</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
            <div style={{ opacity: 0.6, maxWidth: 360 }}>
                {t("هذه الصفحة قيد البناء ضمن تصميم إشراق الجديد.",
                    "This page is being built as part of the new Esharq design.")}
            </div>
        </div>
    );
}
