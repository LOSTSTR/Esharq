/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * قارئ القاموس — **مصدر واحد يقرأ منه الطابور والبنّاء والمُدقِّق**.
 *
 * القاموس في مكانين بحكم التاريخ لا التصميم:
 *   1. `translations.ts` — الأصل المبنيّ على مدى جلسات (6292 مدخلاً).
 *   2. `dictionary/*.json` — دفعات التعريب الجديدة، ملفّ لكل دفعة.
 *
 * ملفّ لكل دفعة **قصداً**: ملفّ واحد ضخم يجعل كل مراجعة فرقاً بآلاف
 * الأسطر، ويجعل تعارض الدمج كابوساً. والدفعات مرقّمة فيبقى الترتيب واضحاً.
 *
 * 🔴 **القيمة الفارغة ليست ترجمة**: مدخل بقيمة `""` هو سطر لم يُملأ بعد،
 * فيُسقَط هنا كي يعود إلى الطابور بدل أن يُحسَب تغطيةً كاذبة.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** يقرأ `translations.ts` نصّياً — مفاتيحه وقيمه نصوص مقتبسة على سطر واحد. */
function readLegacy(pluginDir) {
    const file = join(pluginDir, "translations.ts");
    if (!existsSync(file)) return new Map();

    const source = readFileSync(file, "utf8");
    const unescape = value => value.replace(/\\"/g, "\"").replace(/\\\\/g, "\\");

    const dictionary = new Map();
    for (const match of source.matchAll(/"((?:[^"\\\n]|\\.)+)"\s*:\s*"((?:[^"\\\n]|\\.)*)"/g)) {
        const arabic = unescape(match[2]);
        if (arabic.length > 0) dictionary.set(unescape(match[1]), arabic);
    }
    return dictionary;
}

/**
 * يقرأ دفعات `dictionary/*.json` بترتيب الاسم.
 * البادئة `_` تعني «ليس دفعة» — بيانات مصاحبة كقائمة ما لا يُعرَّب.
 */
function readBatches(pluginDir) {
    const folder = join(pluginDir, "dictionary");
    if (!existsSync(folder)) return [];

    return readdirSync(folder)
        .filter(name => name.endsWith(".json") && !name.startsWith("_"))
        .sort()
        .map(name => ({ name, entries: JSON.parse(readFileSync(join(folder, name), "utf8")) }));
}

/**
 * ما لا يُعرَّب: **أسماء لا تسميات** — شركات ومنتجات وأفاتارات وثيمات وخطوط
 * وشخصيات ورموز. القائمة مجموعات مُسمّاة (والمفتاح `_` شرحٌ لا بيانات).
 *
 * 🔴 هذه ليست تفضيلاً في الصياغة: تعريب **اسمٍ** خطأ يبدو صحيحاً فلا يُلاحَظ،
 * بينما ترك **تسمية** بالإنجليزية نقصٌ ظاهر يُصلَح لاحقاً. فحين يشتبه الأمران
 * في نصّ واحد، الإبقاء بالإنجليزية هو الخيار الذي يمكن التراجع عنه.
 */
export function readKeepEnglish(pluginDir) {
    const file = join(pluginDir, "dictionary", "_keep-english.json");
    if (!existsSync(file)) return new Set();

    const groups = JSON.parse(readFileSync(file, "utf8"));
    const keep = new Set();
    for (const [group, names] of Object.entries(groups)) {
        if (group === "_" || !Array.isArray(names)) continue;
        for (const name of names) keep.add(name);
    }
    return keep;
}

/**
 * القاموس كاملاً: `إنجليزي → عربي`.
 * الدفعات تأتي بعد الأصل، فتصحيحٌ لاحق لمدخل قديم يغلب.
 */
export function readDictionary(pluginDir) {
    const dictionary = readLegacy(pluginDir);

    for (const { entries } of readBatches(pluginDir)) {
        for (const [english, arabic] of Object.entries(entries)) {
            if (typeof arabic === "string" && arabic.length > 0) dictionary.set(english, arabic);
        }
    }

    // 🔴 قائمة الأسماء تعلو على القاموس القديم أيضاً: بُني على مدى جلسات قبل أن
    // نعرف أي النصوص أسماءُ ثيمات وأيقونات، فقد يحمل تعريباً لاسمٍ لا يجوز شحنه.
    for (const name of readKeepEnglish(pluginDir)) dictionary.delete(name);

    return dictionary;
}

/** الدفعات كما هي — يحتاجها المُدقِّق ليُسمّي الملفّ الذي فيه الخلل. */
export function readDictionaryBatches(pluginDir) {
    return readBatches(pluginDir);
}
