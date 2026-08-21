/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./sectionTabs.css";

import { t } from "@utils/esharqI18n";
import { useState } from "@webpack/common";

/**
 * **شريط أقسام** لصفحةٍ طالت.
 *
 * ## لماذا أقسامٌ لا تمريرٌ أطول
 *
 * صفحةٌ من ثمانِ بطاقات تُقرأ بالتمرير وحده: من يبحث عن «ماذا يُحفَظ على
 * جهازي» يمرّ على كل ما سواه ليصله، ولا يعرف كم بقي. والأقسام تُعطيه خريطةً
 * في سطرٍ واحد ونقلةً بضغطة.
 *
 * ## 🔴 ولا يُرسَم إلّا القسم المفتوح
 *
 * الإخفاء بـ`display: none` يُبقي كل البطاقات في الشجرة: مؤقّتاتها تعمل،
 * وطلباتها تجري، وقارئ الشاشة يقرؤها كلّها. فالصفحة تُنشئ ما يُرى فقط.
 *
 * ## وعدّادٌ اختياريّ لكل قسم
 *
 * الرقم على اللسان يقول ما فيه قبل فتحه — «٤ مسارات» أوضح من اسمٍ مجرّد.
 */

export interface Section {
    key: string;
    ar: string;
    en: string;
    /** رقمٌ صغير على اللسان — يُعرَض إن وُجد. */
    count?: number | string;
    /** نبرة العدّاد: للتحذير لونٌ يُميّزه. */
    tone?: "info" | "warn" | "danger" | "ok";
    render: () => React.ReactNode;
}

export function SectionTabs({ sections, initial }: { sections: readonly Section[]; initial?: string; }) {
    const [active, setActive] = useState(initial ?? sections[0]?.key);
    const current = sections.find(s => s.key === active) ?? sections[0];

    return (
        <>
            <div className="esharq-tabs" role="tablist" aria-label={t("أقسام الصفحة", "Page sections")}>
                {sections.map(section => (
                    <button
                        key={section.key}
                        type="button"
                        role="tab"
                        aria-selected={section.key === current?.key}
                        className={"esharq-tab" + (section.key === current?.key ? " on" : "")}
                        onClick={() => setActive(section.key)}>
                        <span>{t(section.ar, section.en)}</span>
                        {section.count !== undefined && (
                            <span className={"esharq-tab-count " + (section.tone ?? "info")}>{section.count}</span>
                        )}
                    </button>
                ))}
            </div>

            <div className="esharq-tab-panel" role="tabpanel" key={current?.key}>
                {current?.render()}
            </div>
        </>
    );
}
