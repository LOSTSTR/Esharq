/*
 * DiscordArabicizer — كاشف تغطية التعريب
 * Copyright (c) 2026 LOSTSTR
 *
 * مبنية على Equicord المرخّصة GPL-3.0-or-later وتخضع لنفس الرخصة.
 *
 * «اشراق / Esharq» وشعاراته وشاراته علامات محفوظة لصاحبها، ولا تشملها رخصة GPL.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "@components/settings/esharq/motion.css";

import { CoverageRing } from "@components/settings/esharq/CoverageRing";
import { definePluginSettings } from "@api/Settings";
import { copyWithToast } from "@utils/discord";
import { t } from "@utils/esharqI18n";
import { OptionType } from "@utils/types";
import { saveFile } from "@utils/web";
import { Button, useEffect, useState } from "@webpack/common";

import { type CoverageReport, scanCoverage } from "./coverageScan";

const muted: React.CSSProperties = { color: "var(--text-muted)", fontSize: 13 };

function CoveragePanel() {
    // 🔴 حالة النسخ تعود تلقائياً: زرّ يبقى «تمّ» إلى الأبد يكذب بعد ثانية.
    const [copied, setCopied] = useState(false);
    useEffect(() => {
        if (!copied) return;
        const id = setTimeout(() => setCopied(false), 1800);
        return () => clearTimeout(id);
    }, [copied]);

    // 🔴 لا فحص عند الرسم: لا يجري شيء حتى تُضغط الزرّ. لا مؤقّت ولا خطّاف.
    const [report, setReport] = useState<CoverageReport | null>(null);

    const missing = report === null ? 0 : Object.keys(report.untranslated).length;
    const percent = report === null || report.liveKeys === 0
        ? null
        : Math.round((report.translated / report.liveKeys) * 100);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={muted}>
                {t(
                    "يقيس ما يعرضه ديسكورد أمامك الآن — الشاشات التي لم تفتحها لم تُحمَّل بعد، فالرقم يرتفع كلّما تجوّلت.",
                    "Measures what Discord has actually loaded in front of you — screens you have not opened yet are not counted, so the number grows as you browse."
                )}
            </div>

            {report !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <CoverageRing percent={percent ?? 0} />
                    <div style={muted}>
                    📊 <b>{report.liveKeys.toLocaleString()}</b> {t("مفتاحاً حيّاً في", "live keys across")}{" "}
                    <b>{report.tables}</b> {t("جدولاً", "tables")}　·
                    🟢 {t("مُعرَّب", "translated")}: <b>{report.translated.toLocaleString()}</b>
                    {percent !== null && <> ({percent}%)</>}　·
                        🔴 {t("باقٍ", "remaining")}: <b>{missing.toLocaleString()}</b>
                    </div>
                </div>
            )}

            {report !== null && report.translated === 0 && report.liveKeys > 0 && (
                <div style={{ ...muted, color: "var(--text-danger)" }}>
                    {t(
                        "لم يُطابَق أي مفتاح — الجدول العربي غير مُثبَّت. هذا خلل في النواة لا في هذه الإضافة.",
                        "No key matched — the Arabic table is not installed. That is a core fault, not this plugin's."
                    )}
                </div>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Button onClick={() => setReport(scanCoverage())}>
                    {t("افحص التغطية الآن", "Scan coverage now")}
                </Button>

                {report !== null && missing > 0 && (
                    <>
                        <Button
                            color={Button.Colors.PRIMARY}
                            onClick={() => {
                                copyWithToast(
                                    JSON.stringify(report.untranslated, null, 2),
                                    t(`نُسخ ${missing} مفتاحاً غير مُعرَّب`, `Copied ${missing} untranslated keys`)
                                );
                                setCopied(true);
                            }}
                        >
                            <span key={String(copied)} className="esharq-pop">
                                {copied ? t("✓ نُسخ", "✓ Copied") : t("انسخ ما لم يُعرَّب", "Copy untranslated")}
                            </span>
                        </Button>
                        <Button
                            look={Button.Looks.LINK}
                            color={Button.Colors.PRIMARY}
                            onClick={() => saveFile(new File(
                                [JSON.stringify(report.untranslated, null, 2)],
                                `esharq-untranslated-${new Date().toISOString().slice(0, 10)}.json`,
                                { type: "application/json" }
                            ))}
                        >
                            {t("تنزيل كملف JSON", "Download as JSON")}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}

// 🔴 `pluginsArabic` و`arabicFont` **لم تعودا معروضتين هنا**: واجهتهما انتقلت
// إلى صفحة «الأدوات ← اللغة» حيث تجتمع لغة ديسكورد ولغة الإضافات والخطّ.
// أمّا **مكان تخزينهما فلم يتغيّر** ويبقى تحت اسم هذه الإضافة، لأن
// `esharqPrefs` يقرؤهما من هناك مباشرةً — ونقل المخزن بلا ترحيل يمحو تفضيل
// المستخدم بصمت. ولذلك أيضاً **لا يُعاد تسمية هذه الإضافة**.
export const settings = definePluginSettings({
    coverage: {
        type: OptionType.COMPONENT,
        description: t(
            "قِس ما لم يُعرَّب بعد من نصوص ديسكورد المحمَّلة، وأخرجه طابور عمل:",
            "Measure which of Discord's loaded strings are still untranslated, and export the work queue:"
        ),
        component: CoveragePanel
    }
});
