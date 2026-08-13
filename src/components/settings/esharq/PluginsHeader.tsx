/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./motion.css";

import { Button } from "@components/Button";
import { t } from "@utils/esharqI18n";
import { React, useEffect, useState } from "@webpack/common";

import { countUpFrames, stagger } from "./motion";
import { ACCENT, ACCENT_SOFT, RADIUS, SURFACE, TRANSITION_MS, UNIT } from "./tokens";

/**
 * رقم يتسلّق إلى قيمته مرّة واحدة عند الظهور.
 *
 * 🔴 لا يتسلّق عند كل تغيّر: تفعيل إضافة يزيد العدّاد واحداً، وتسلّق من 74
 * إلى 75 حركة بلا معنى. الهدف إبراز الرقم حين تُفتح الصفحة، لا الاحتفال
 * بكل نقرة.
 */
function CountUp({ value }: { value: number; }) {
    const [shown, setShown] = useState(value);

    useEffect(() => {
        const frames = countUpFrames(value);
        if (frames.length <= 1) return setShown(value);

        let index = 0;
        setShown(frames[0]);
        const id = setInterval(() => {
            index++;
            if (index >= frames.length) {
                clearInterval(id);
                return setShown(value);
            }
            setShown(frames[index]);
        }, 16);

        return () => clearInterval(id);
        // مرّة واحدة عند التركيب — انظر التعليق أعلاه.
    }, []);

    return <>{shown.toLocaleString()}</>;
}

/**
 * رأس صفحة الإضافات — **عنوان وفعل واحد، ثم ثلاثة أرقام**.
 *
 * ## لماذا ثلاثة أرقام لا أربعة
 *
 * كان الرأس بطاقتين تحملان أربعة أرقام (مفعَّلة/إجمالي، وشخصية مفعَّلة/إجمالي).
 * وبعد أن خرجت إضافات إشراق من مجلد المستخدم صار عدّادا «الشخصية» **صفرين
 * دائمين** لكل من لم يكتب إضافةً بنفسه — أي خانتان تشغلان نصف الرأس لتقولا
 * «لا شيء».
 *
 * فالثلاثة الباقية هي ما يُسأل عنه فعلاً: **كم عندي · كم يعمل · كم منها من
 * إشراق**. وخانة «الشخصية» تظهر **فقط لمن له إضافات**، فتكون خبراً حين تظهر.
 *
 * 🔴 والنسبة المئوية بجانب «المفعَّلة» لا تحتها: الرقم المطلق بلا نسبته
 * يخدع — «74» تبدو كثيرة حتى تعرف أنها من 458.
 */

interface Props {
    total: number;
    enabled: number;
    esharq: number;
    userPlugins: number;
    onDisableAll(): void;
}

function Tile({ value, label, hint, highlight, index }: {
    value: React.ReactNode; label: string; hint?: string; highlight?: boolean; index: number;
}) {
    return (
        <div className="esharq-rise esharq-lift" style={{
            ...stagger(index),
            flex: 1,
            minWidth: 128,
            padding: `${UNIT * 2}px ${UNIT * 2.5}px`,
            borderRadius: RADIUS,
            background: highlight ? ACCENT_SOFT : SURFACE[2],
            border: `1px solid ${highlight ? ACCENT : "transparent"}`,
            transition: `background ${TRANSITION_MS}ms`
        }}>
            <div style={{
                fontSize: 26,
                fontWeight: 700,
                lineHeight: 1.15,
                color: highlight ? ACCENT : "var(--header-primary)"
            }}>
                {value}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: UNIT / 2 }}>{label}</div>
            {hint !== undefined && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.7 }}>{hint}</div>
            )}
        </div>
    );
}

export function PluginsHeader({ total, enabled, esharq, userPlugins, onDisableAll }: Props) {
    const percent = total === 0 ? 0 : Math.round((enabled / total) * 100);

    return (
        <div style={{
            background: SURFACE[1],
            borderRadius: RADIUS,
            padding: UNIT * 3,
            marginBottom: UNIT * 3
        }}>
            <div style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: UNIT * 2,
                marginBottom: UNIT * 2.5,
                flexWrap: "wrap"
            }}>
                <div>
                    <div style={{ fontSize: 17, fontWeight: 600 }}>
                        {t("إدارة الإضافات", "Plugin management")}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: UNIT / 2, maxWidth: 520 }}>
                        {t(
                            "اضغط الترس لضبط إضافة، وعلامة المعلومات لتفاصيلها. الإضافات ذات الترس وحدها هي القابلة للتخصيص.",
                            "Press the cog to configure a plugin, the info mark for its details. Only plugins with a cog have anything to configure."
                        )}
                    </div>
                </div>

                <Button className="esharq-press" variant="secondary" size="small" onClick={onDisableAll}>
                    {t("تعطيل كل الإضافات", "Disable all plugins")}
                </Button>
            </div>

            <div style={{ display: "flex", gap: UNIT * 1.5, flexWrap: "wrap" }}>
                <Tile index={0} value={<CountUp value={total} />} label={t("إجمالي الإضافات", "Plugins in total")} />
                <Tile
                    index={1}
                    value={<><CountUp value={enabled} /> <span style={{ fontSize: 15, opacity: 0.75 }}>({percent}%)</span></>}
                    label={t("مُفعَّلة الآن", "Enabled right now")}
                    highlight
                />
                <Tile
                    index={2}
                    value={<CountUp value={esharq} />}
                    label={t("من إشراق", "Built by Esharq")}
                    hint={t("لا توجد في المشروع الأصل", "not found upstream")}
                />
                {/* تظهر لمن كتب إضافةً بنفسه فقط — وإلّا فهي خانة تقول «صفر» دائماً. */}
                {userPlugins > 0 && (
                    <Tile index={3} value={<CountUp value={userPlugins} />} label={t("إضافاتك أنت", "Yours")} />
                )}
            </div>
        </div>
    );
}
