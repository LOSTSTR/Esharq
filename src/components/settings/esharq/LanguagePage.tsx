/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./motion.css";

import { FormSwitch } from "@components/FormSwitch";
import { applyArabicFont, ARABIC_FONTS } from "@utils/esharqFont";
import { t } from "@utils/esharqI18n";
import { ARABIC_LOCALE, arabicTableSize } from "@utils/esharqLocale";
import { readArabicFont, readPluginsArabic, writeEsharqPref } from "@utils/esharqPrefs";
import { Forms, Select, UserSettingsActionCreators, useState } from "@webpack/common";

import { stagger } from "./motion";
import { ACCENT, RADIUS, SURFACE, UNIT } from "./tokens";

/**
 * صفحة **اللغة** — كل ما يخصّ لغة العميل في موضع واحد:
 *
 *   1. لغة ديسكورد نفسه   — العربية التي تعرضها نواة إشراق
 *   2. لغة الإضافات       — أسماء الإضافات وأوصافها ولوحة إشراق
 *   3. الخطّ العربي        — خطّ كل نصّ عربي في العميل
 *
 * 🔴 **التخزين في `Settings.esharq`، والقراءة عبر `esharqPrefs` وحده**:
 * لا تُقرأ هذه القيم من هنا مباشرةً. `esharqPrefs` يعرف المواضع القديمة
 * ويُرحّل منها مرّة واحدة؛ وقراءةٌ مباشرة تتخطّاه تُرجع الافتراضي لمن لم
 * يُرحَّل بعد — أي **تمحو تفضيله في نظره** وإن كان محفوظاً.
 */

/** لغة ديسكورد الحالية، مقروءة من إعداداته هو لا من عندنا. */
function currentLocale(): string {
    try {
        return UserSettingsActionCreators.PreloadedUserSettingsActionCreators
            .getCurrentValue().localization.locale.value ?? "en-US";
    } catch {
        return "en-US";
    }
}

/**
 * تبديل لغة ديسكورد. يُكتب في إعدادات ديسكورد نفسها (`localization.locale`)
 * لا في إعداداتنا — فهي لغته، ويجب أن تبقى بعد إزالة إشراق.
 */
async function setLocale(locale: string): Promise<void> {
    await UserSettingsActionCreators.PreloadedUserSettingsActionCreators
        .updateAsync("localization", (settings: any) => { settings.locale.value = locale; }, 0);
}

function Card({ title, subtitle, children, index }: {
    title: string; subtitle: string; children: React.ReactNode; index: number;
}) {
    return (
        <div className="esharq-rise" style={{
            ...stagger(index),
            background: SURFACE[1],
            borderRadius: RADIUS,
            padding: UNIT * 3,
            marginBottom: UNIT * 3
        }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: UNIT / 2 }}>{title}</div>
            <div style={{ opacity: 0.6, fontSize: 13, marginBottom: UNIT * 2 }}>{subtitle}</div>
            {children}
        </div>
    );
}

export function LanguagePage() {
    const [locale, setLocaleState] = useState(currentLocale());
    const [pluginsArabic, setPluginsArabic] = useState(readPluginsArabic());
    const [font, setFont] = useState(String(readArabicFont() ?? "tajawal"));

    const arabicOn = locale === ARABIC_LOCALE;
    const translated = arabicTableSize();

    return (
        <div>
            <Card
                index={0}
                title={t("لغة ديسكورد", "Discord's language")}
                subtitle={t(
                    `العربية لغة أصيلة في هذا العميل: يعرضها محرّك ديسكورد نفسه من جدول مُصرَّف فيه ${translated.toLocaleString()} رسالة — بلا غلاف وبلا تكلفة تشغيل. وما لم يُترجَم بعد يبقى إنجليزياً.`,
                    `Arabic is a native locale in this client: Discord's own engine renders it from a compiled table of ${translated.toLocaleString()} messages — no wrapper, no runtime cost. Anything not translated yet stays in English.`
                )}
            >
                <FormSwitch
                    value={arabicOn}
                    onChange={(value: boolean) => {
                        // 🔴 الإطفاء يُعيد الإنجليزية لا «اللغة السابقة»: ديسكورد
                        // لا يحتفظ بسابقة، واختراع واحدة يعني تخمين ما لم يقله أحد.
                        const next = value ? ARABIC_LOCALE : "en-US";
                        setLocaleState(next);
                        void setLocale(next);
                    }}
                    title={t("استخدم العربية في ديسكورد", "Use Arabic in Discord")}
                    description={t(
                        "يبدّل لغة ديسكورد نفسها — وهي إعداد ديسكورد لا إعدادنا، فيبقى كما تركته حتى لو أزلت إشراق.",
                        "Switches Discord's own language — it is Discord's setting, not ours, so it stays as you left it even if you remove Esharq."
                    )}
                    hideBorder
                />
            </Card>

            <Card
                index={1}
                title={t("لغة الإضافات", "Plugins language")}
                subtitle={t(
                    "أسماء الإضافات وأوصافها ولوحة إشراق. مستقلّة عن لغة ديسكورد: تستطيع إبقاء ديسكورد إنجليزياً ولوحة إشراق عربية، أو العكس.",
                    "Plugin names, descriptions and the Esharq panel. Independent of Discord's language: you can keep Discord in English and Esharq in Arabic, or the reverse."
                )}
            >
                <FormSwitch
                    value={pluginsArabic}
                    onChange={(value: boolean) => {
                        writeEsharqPref("pluginsArabic", value);
                        setPluginsArabic(value);
                    }}
                    title={t("عرّب أسماء الإضافات ولوحة إشراق", "Localize plugin names and the Esharq panel")}
                    description={t(
                        "يتطلّب إعادة تشغيل ليُعاد رسم كل النصوص باللغة المختارة.",
                        "Requires a restart so every string re-renders in the chosen language."
                    )}
                    hideBorder
                />
            </Card>

            <Card
                index={2}
                title={t("الخطّ العربي", "Arabic font")}
                subtitle={t(
                    "يوحّد خطّ كل نصّ عربي في العميل. يُطبَّق فوراً بلا إعادة تشغيل، ولا يمسّ إلا المحارف العربية — يبقى اللاتيني والأكواد على خطّ ديسكورد.",
                    "Unifies the font of every Arabic string in the client. Applies instantly with no restart, and touches Arabic glyphs only — Latin text and code keep Discord's font."
                )}
            >
                <Select
                    options={ARABIC_FONTS.map(option => ({
                        label: t(option.labelAr, option.labelEn),
                        value: option.key
                    }))}
                    isSelected={(value: string) => value === font}
                    serialize={(value: string) => value}
                    select={(value: string) => {
                        writeEsharqPref("arabicFont", value);
                        applyArabicFont(value);
                        setFont(value);
                    }}
                    closeOnSelect={true}
                />
                <Forms.FormText style={{ marginTop: UNIT, opacity: 0.55, fontSize: 12 }}>
                    <span style={{ color: ACCENT }}>◆</span>{" "}
                    {t("الخطوط مضمّنة في العميل — لا تُحمَّل من الشبكة ولا تُبلَّغ أي جهة.",
                        "The fonts ship inside the client — nothing is downloaded and nothing is reported anywhere.")}
                </Forms.FormText>
            </Card>
        </div>
    );
}
