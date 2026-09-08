/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./motion.css";

import { Button } from "@components/Button";
import { t } from "@utils/esharqI18n";
import { React, useEffect, useRef, useState } from "@webpack/common";

import { countUpFrames, stagger } from "./motion";
import { ACCENT, ACCENT_SOFT, RADIUS, SURFACE, TRANSITION_MS, UNIT } from "./tokens";

/**
 * أصغر صعودٍ يستحقّ تسلّقاً. ما دونه يُكتب فوراً.
 *
 * تفعيل إضافةٍ يزيد العدّاد واحداً، وتبعيّاتها تزيده اثنتين أو ثلاثاً —
 * فأربعة سقفٌ يسع النقرة الواحدة وما تجرّه، ولا يسع «إعادة الضبط الافتراضي».
 */
const COUNT_UP_MIN_JUMP = 5;

/**
 * رقم يتسلّق إلى قيمته عند الظهور، وعند القفزات الكبيرة وحدها.
 *
 * 🔴 لا يتسلّق عند كل تغيّر: تفعيل إضافة يزيد العدّاد واحداً، وتسلّق من 74
 * إلى 75 حركة بلا معنى. الهدف إبراز الرقم حين تُفتح الصفحة، لا الاحتفال
 * بكل نقرة.
 *
 * 🔴 لكنّ «لا يتسلّق» ليست «لا يتغيّر». كان الأثر مصفوفةَ اعتمادٍ فارغة،
 * فيبقى `shown` على قيمة أوّل تركيبٍ إلى الأبد: يضغط صاحبُه «تعطيل كل
 * الإضافات» — الزرّ في هذا الرأس نفسه — فتهبط النسبة المئوية بجانب الرقم
 * ويثبت الرقم مكانه. رقمان متجاوران يتناقضان، وأحدهما كاذب.
 *
 * فالقسمة: الصعود الكبير يُتسلَّق، وما عداه يُكتب في الحال — والاثنان
 * يصدقان.
 *
 * 🔴 والهبوط يُكتب دائماً بلا حركة. `countUpFrames` يبني إطاراته **من الصفر
 * إلى الهدف** (`motion.ts:61`)، فتشغيله على هبوطٍ من 74 إلى 40 يُري العينَ
 * سقوطاً إلى الصفر ثمّ تسلّقاً إلى 40 — حركةٌ تكذب على اتّجاه التغيّر نفسه.
 */
function CountUp({ value }: { value: number; }) {
    const [shown, setShown] = useState(value);
    // آخر هدفٍ عُرِض. و`shown` لا يصلح مقياساً: يتغيّر مع كل إطار أثناء
    // التسلّق نفسه، فيقيس الفرق إلى منتصف الحركة لا إلى ما قبلها.
    const previous = useRef<number | null>(null);

    useEffect(() => {
        const from = previous.current;
        previous.current = value;

        // بعد أوّل تركيب: لا يُتسلَّق إلّا الصعود الكبير. وما عداه — الفرق
        // الصغير وكلّ هبوط — يُكتب بلا حركة، لكنّه **يُكتب**.
        if (from !== null && value - from < COUNT_UP_MIN_JUMP) {
            return setShown(value);
        }

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

        // تسلّقٌ جارٍ وقيمةٌ جديدة تصل ⇒ يُلغى المؤقّت القديم قبل أن يبدأ
        // الجديد، وإلّا كتب مؤقّتان على العدّاد نفسه.
        return () => clearInterval(id);
    }, [value]);

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
    onRestoreDefaults(): void;
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

export function PluginsHeader({ total, enabled, esharq, userPlugins, onDisableAll, onRestoreDefaults }: Props) {
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

                <div style={{ display: "flex", gap: UNIT, flexWrap: "wrap" }}>
                    <Button className="esharq-press" variant="secondary" size="small" onClick={onRestoreDefaults}>
                        {t("إعادة الضبط الافتراضي", "Restore defaults")}
                    </Button>
                    <Button className="esharq-press" variant="secondary" size="small" onClick={onDisableAll}>
                        {t("تعطيل كل الإضافات", "Disable all plugins")}
                    </Button>
                </div>
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
