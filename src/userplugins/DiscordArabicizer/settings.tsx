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
import { t } from "@utils/esharqI18n";
import { OptionType } from "@utils/types";
import { Button } from "@webpack/common";

import { clearMissing, getMissing } from "./collector";
import { startDomFallback, stopDomFallback } from "./domFallback";
import { translations } from "./translations";

function StatsAndTools() {
    const missing = getMissing();
    const total = Object.keys(translations).length;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                🟢 مُترجَم في القاموس: <b>{total}</b>　·　🔴 غير مُترجَم (هذه الجلسة): <b>{missing.length}</b>
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                ℹ️ {t("الجمع يبدأ فقط عند تشغيل «الوضع التشخيصي» أعلاه — لا تلقائياً.", "Collection starts only when “Diagnostic mode” above is on — never automatically.")}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Button
                    onClick={() => copyWithToast(
                        JSON.stringify(getMissing(), null, 2),
                        `نُسخ ${getMissing().length} نصّاً غير مترجَم إلى الحافظة`
                    )}
                >
                    انسخ النصوص غير المترجَمة ({missing.length})
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
