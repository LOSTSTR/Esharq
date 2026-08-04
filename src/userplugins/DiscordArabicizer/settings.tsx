/*
 * DiscordArabicizer — تعريب واجهة ديسكورد إلى العربية
 * Copyright (c) 2026 LOSTSTR
 *
 * مبنية على Equicord المرخّصة GPL-3.0-or-later وتخضع لنفس الرخصة. تعترض دوال
 * i18n.intl لترجمة نصوص واجهة ديسكورد إلى العربية، مع الإبقاء على الأسماء
 * العَلَم (الألعاب والثيمات وأسماء المستخدمين) بلغتها الأصلية.
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
import { Button, useEffect, useState } from "@webpack/common";

import { clearMissing, getMissing, sessionStats } from "./collector";
import { startDomFallback, stopDomFallback } from "./domFallback";
import { translations } from "./translations";

// يبني ملف JSON من المفقودات ويطلب حفظه (أنسب من الحافظة للقوائم الكبيرة).
function downloadMissing() {
    const list = getMissing();
    const date = new Date().toISOString().slice(0, 10);
    saveFile(new File(
        [JSON.stringify(list, null, 2)],
        `arabicizer-missing-${date}.json`,
        { type: "application/json" }
    ));
}

function StatsAndTools() {
    // إنعاش دوري خفيف أثناء فتح الصفحة فقط — تتحدّث الأرقام حيّاً بلا أي عمل خلفي دائم.
    const [, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick(n => n + 1), 2000);
        return () => clearInterval(id);
    }, []);

    const missing = getMissing();
    const total = Object.keys(translations).length;
    const { hits, misses } = sessionStats;
    const passed = hits + misses;
    const pct = passed > 0 ? Math.round((hits / passed) * 100) : null;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                🟢 مُترجَم في القاموس: <b>{total}</b>　·　🔴 غير مُترجَم (هذه الجلسة): <b>{missing.length}</b>
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                📊 {t("تغطية الجلسة الفعلية:", "Live session coverage:")}{" "}
                {pct === null
                    ? t("لا نصوص مرّت بعد", "no strings passed yet")
                    : <>‏<b>{pct}%</b> — {t(`تُرجم ${hits.toLocaleString()} من ${passed.toLocaleString()} نصّاً مرّ بالمحرّك`, `${hits.toLocaleString()} of ${passed.toLocaleString()} strings translated`)}</>}
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                ℹ️ {t("الجمع يبدأ فقط عند تشغيل «الوضع التشخيصي» أعلاه — لا تلقائياً.", "Collection starts only when “Diagnostic mode” above is on — never automatically.")}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Button
                    onClick={() => copyWithToast(
                        JSON.stringify(getMissing(), null, 2),
                        `نُسخ ${getMissing().length} نصّاً غير مترجَم إلى الحافظة`
                    )}
                >
                    انسخ النصوص غير المترجَمة ({missing.length})
                </Button>
                <Button
                    color={Button.Colors.PRIMARY}
                    onClick={downloadMissing}
                >
                    {t("تنزيل كملف JSON", "Download as JSON")}
                </Button>
                <Button
                    look={Button.Looks.LINK}
                    color={Button.Colors.PRIMARY}
                    onClick={() => clearMissing()}
                >
                    تصفير القائمة
                </Button>
            </div>
        </div>
    );
}

export const settings = definePluginSettings({
    // ── تعريب واجهة اشراق نفسها (كان مفتاحاً في لوحة إعدادات اشراق: Settings.arabicMode) ──
    // يعمل هذا الخيار سواءً كانت الإضافة مُفعّلة أم لا: هو يخصّ لغة أسماء الإضافات ولوحة
    // اشراق، لا تعريب واجهة ديسكورد. يقرؤه esharqPrefs مباشرةً من مخزن الإعدادات.
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
    enabled: {
        type: OptionType.BOOLEAN,
        description: t(
            "🧪 تجريبي: تفعيل تعريب نصوص واجهة ديسكورد نفسها (يتطلّب إعادة التشغيل)",
            "🧪 Experimental: enable Arabizing Discord's own UI strings (requires restart)"
        ),
        default: true,
        // إعادة تشغيل يدوية واحدة عبر شريط ديسكورد: يُطبَّق الترقيع من بداية الجلسة فيثبت
        // التعريب (يكفي وحده؛ لا حاجة لإعادة تلقائية فورية بعد الترقيع اللاصق وطبقة DOM).
        restartNeeded: true
    },
    diagnosticMode: {
        type: OptionType.BOOLEAN,
        description: t(
            "🔬 الوضع التشخيصي (للمطوّر): يضع 🟢 أمام كل نصّ مُترجَم و🔴 أمام غير المترجَم، ويبدأ جمع النصوص غير المترجَمة للحصاد. لا جمع تلقائياً قبل تشغيله — أطفئه عند الاستخدام العادي.",
            "🔬 Diagnostic mode (dev): prefixes 🟢 to every translated string and 🔴 to untranslated ones, and starts collecting untranslated strings for harvest. No collection happens until it's on — turn off for normal use."
        ),
        default: false
    },
    logMissingKeys: {
        type: OptionType.BOOLEAN,
        description: t(
            "تسجيل النصوص غير المترجَمة في الكونسول (اختياري — للتطوير)",
            "Log untranslated strings to the console (optional — dev)"
        ),
        default: false
    },
    logErrors: {
        type: OptionType.BOOLEAN,
        description: t(
            "🛠️ تسجيل أخطاء محرّك الترجمة في الكونسول (يُلتقَط عبر ConsoleWatcher للصيانة) — مُطفأ افتراضياً، لا يُضعِف الأمان.",
            "🛠️ Log translation-engine errors to the console (captured by ConsoleWatcher for maintenance) — off by default, does not weaken safety."
        ),
        default: false
    },
    domFallback: {
        type: OptionType.BOOLEAN,
        description: t(
            "طبقة احتياطية للنصوص العنيدة التي تتجاوز محرّك الترجمة فقط (مثل «أنماط الرتب المحسّنة») — قائمة محدودة تُستبدَل بعد الرسم، لا تمسّ بقية النصوص.",
            "Fallback only for stubborn strings that bypass the translation engine (e.g. “Enhanced Role Styles”) — a small fixed whitelist replaced after render, never touching any other text."
        ),
        default: true,
        onChange(value: boolean) {
            // تشغيل/إيقاف فوري (لا يحتاج إعادة تشغيل) — يبدأ فقط إن كانت الإضافة مُفعّلة.
            if (value && settings.store.enabled) startDomFallback();
            else stopDomFallback();
        }
    },
    tools: {
        type: OptionType.COMPONENT,
        description: t(
            "تنقّل في ديسكورد ثم انسخ النصوص غير المترجَمة دفعةً واحدة:",
            "Browse Discord, then copy all untranslated strings at once:"
        ),
        component: StatsAndTools
    }
});
