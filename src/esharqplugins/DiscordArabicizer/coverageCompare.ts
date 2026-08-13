/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * حساب التغطية — **بلا أي تبعية على ديسكورد أو webpack**.
 *
 * فُصل عن `coverageScan` عمداً: المسح يحتاج عميلاً حيّاً فلا يُختبَر خارجه،
 * أمّا الحساب فيُختبَر على لقطة محفوظة. ودمجهما يعني رقماً لا يستطيع أحد
 * التحقّق منه إلّا بتشغيل ديسكورد وتصديق ما يظهر.
 */

export interface CoverageCounts {
    /** مفاتيح ديسكورد الحيّة التي قُرئت. */
    liveKeys: number;
    /** ما يغطّيه جدولنا المُصرَّف منها. */
    translated: number;
    /** الباقي — وهو طابور العمل: مفتاح ← نصّه الإنجليزي. */
    untranslated: Record<string, string>;
}

/**
 * يقارن ما قُرئ حيّاً بالجدول العربي المُثبَّت.
 *
 * 🔴 وجود المفتاح وحده هو المعيار، لا قيمته: الجدول لا يحوي إلّا ما تُرجم
 * فعلاً (يبنيه `buildArabicTable.mjs` ويرفض ما تختلف متغيّراته)، فمفتاح
 * موجود = نصّ مُعرَّب مشحون.
 */
export function computeCoverage(
    live: ReadonlyMap<string, string>,
    arabic: Readonly<Record<string, unknown>>
): CoverageCounts {
    const untranslated: Record<string, string> = {};
    let translated = 0;

    for (const [key, english] of live) {
        if (arabic[key] !== undefined) translated++;
        else untranslated[key] = english;
    }

    return { liveKeys: live.size, translated, untranslated };
}
