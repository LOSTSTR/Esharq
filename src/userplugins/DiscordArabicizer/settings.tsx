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
import { relaunch } from "@utils/native";
import { OptionType } from "@utils/types";
import { Button } from "@webpack/common";

import { clearMissing, getMissing } from "./collector";
import { translations } from "./translations";

function StatsAndTools() {
    const missing = getMissing();
    const total = Object.keys(translations).length;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                🟢 مُترجَم في القاموس: <b>{total}</b>　·　🔴 غير مُترجَم (هذه الجلسة): <b>{missing.length}</b>
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
        restartNeeded: true,
        // عند التفعيل: إن كان خيار الإعادة الإجبارية مُفعّلاً، أعِد التشغيل فوراً ليُطبَّق
        // الترقيع من بداية الجلسة قبل أن ترسم وحدات ديسكورد نصوصها — فلا تبقى بعض النصوص
        // إنجليزية (هذا سبب فقدان بعض الترجمات سابقاً بعد إعادة التشغيل العادية).
        onChange(value: boolean) {
            if (value && settings.store.forceRestartOnEnable) relaunch();
        }
    },
    forceRestartOnEnable: {
        type: OptionType.BOOLEAN,
        description: t(
            "🔄 إعادة تشغيل تلقائية فور التفعيل — يضمن ثبات الترجمة: تُطبَّق من بداية الجلسة فلا تعود نصوص إلى الإنجليزية بعد إعادة التشغيل.",
            "🔄 Auto-restart immediately on enable — guarantees stable translation: applied from session start so strings don't revert to English after a restart."
        ),
        default: true
    },
    diagnosticMode: {
        type: OptionType.BOOLEAN,
        description: t(
            "🔬 الوضع التشخيصي (للمطوّر): يضع 🟢 أمام كل نصّ مُترجَم و🔴 أمام غير المترجَم — لرؤية ما يحتاج ترجمة بنظرة. أطفئه عند الاستخدام العادي.",
            "🔬 Diagnostic mode (dev): prefixes 🟢 to every translated string and 🔴 to untranslated ones — to spot what needs translation at a glance. Turn off for normal use."
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
    tools: {
        type: OptionType.COMPONENT,
        description: t(
            "تنقّل في ديسكورد ثم انسخ النصوص غير المترجَمة دفعةً واحدة:",
            "Browse Discord, then copy all untranslated strings at once:"
        ),
        component: StatsAndTools
    }
});
