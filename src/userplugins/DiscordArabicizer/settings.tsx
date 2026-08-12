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

import { definePluginSettings } from "@api/Settings";
import { copyWithToast } from "@utils/discord";
import { applyArabicFont } from "@utils/esharqFont";
import { t } from "@utils/esharqI18n";
import { OptionType } from "@utils/types";
import { saveFile } from "@utils/web";
import { Button, useState } from "@webpack/common";

import { type CoverageReport, scanCoverage } from "./coverageScan";

const muted: React.CSSProperties = { color: "var(--text-muted)", fontSize: 13 };

function CoveragePanel() {
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
                <div style={muted}>
                    📊 <b>{report.liveKeys.toLocaleString()}</b> {t("مفتاحاً حيّاً في", "live keys across")}{" "}
                    <b>{report.tables}</b> {t("جدولاً", "tables")}　·
                    🟢 {t("مُعرَّب", "translated")}: <b>{report.translated.toLocaleString()}</b>
                    {percent !== null && <> ({percent}%)</>}　·
                    🔴 {t("باقٍ", "remaining")}: <b>{missing.toLocaleString()}</b>
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
                            onClick={() => copyWithToast(
                                JSON.stringify(report.untranslated, null, 2),
                                t(`نُسخ ${missing} مفتاحاً غير مُعرَّب`, `Copied ${missing} untranslated keys`)
                            )}
                        >
                            {t("انسخ ما لم يُعرَّب", "Copy untranslated")}
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

export const settings = definePluginSettings({
    // ── تفضيلا التعريب ──────────────────────────────────────────────────
    // 🔴 يعملان **سواءً كانت الإضافة مُفعَّلة أم لا**: يقرؤهما `esharqPrefs`
    // من مخزن الإعدادات مباشرةً. ولذلك لا يُعاد تسمية مفتاح منهما ولا اسم
    // الإضافة — إعادة التسمية تفقد تفضيل المستخدم بصمت.
    pluginsArabic: {
        type: OptionType.BOOLEAN,
        description: t(
            "🌐 تفعيل تعريب الإضافات — عرض أسماء الإضافات وأوصافها وإعدادات اشراق بالعربية. أطفئه للإنجليزية. اختياري تماماً، ويتطلّب إعادة التشغيل ليُعاد رسم كل النصوص باللغة المختارة.",
            "🌐 Enable plugin localization — show plugin names, descriptions, and the Esharq panel in Arabic. Turn off for English. Fully optional; requires a restart so every string re-renders in the chosen language."
        ),
        default: false,
        restartNeeded: true
    },
    arabicFont: {
        type: OptionType.SELECT,
        description: t(
            "🔤 خطّ النصوص العربية — يوحّد خطّ كلّ نصّ عربي (واجهة ديسكورد ولوحة اشراق والإضافات). يُطبَّق فوراً بلا إعادة تشغيل، ويمسّ المحارف العربية فقط دون اللاتيني والأكواد.",
            "🔤 Arabic text font — unifies the font of all Arabic text (Discord UI, the Esharq panel, and plugins). Applies instantly, no restart; only Arabic glyphs are affected, Latin and code stay untouched."
        ),
        options: [
            { label: t("Tajawal — عصري متوازن (الافتراضي)", "Tajawal — modern and balanced (default)"), value: "tajawal", default: true },
            { label: t("Cairo — عصري واسع الانتشار", "Cairo — popular modern sans"), value: "cairo" },
            { label: t("Almarai — خليجي نظيف عالي الوضوح", "Almarai — clean, highly legible"), value: "almarai" },
            { label: t("Changa — عناوين عربية مميّزة", "Changa — distinctive display face"), value: "changa" },
            { label: t("El Messiri — أنيق بلمسة كلاسيكية", "El Messiri — elegant, classic touch"), value: "elMessiri" },
            { label: t("Saudi — الخطّ السعودي الرسمي", "Saudi — the official Saudi typeface"), value: "saudi" },
            { label: t("بدون — خطّ ديسكورد الافتراضي", "None — keep Discord's default font"), value: "off" }
        ],
        onChange(value: string) {
            applyArabicFont(value);
        }
    },
    coverage: {
        type: OptionType.COMPONENT,
        description: t(
            "قِس ما لم يُعرَّب بعد من نصوص ديسكورد المحمَّلة، وأخرجه طابور عمل:",
            "Measure which of Discord's loaded strings are still untranslated, and export the work queue:"
        ),
        component: CoveragePanel
    }
});
