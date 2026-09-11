/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { setStyleClassNames } from "@api/Styles";
import { Logger } from "@utils/Logger";
import { filters, find, mapMangledCssClasses } from "@webpack";

const logger = new Logger("EsharqLateClasses");

/**
 * يملأ أصناف نمطٍ **متى صارت الوحدة موجودة**، لا عند التشغيل وحده.
 *
 * 🔴 العلّة، مقيسةً على عميل حيّ لا مفترضة:
 *
 * `findCssClassesLazy("messageContent")` كان يُقرأ داخل `start()`، و`start()`
 * يعمل عند `WebpackReady`. لكنّ ديسكورد **يُحمّل وحدة الرسائل كسولاً**، ومن
 * يُقلع على صفحة الأصدقاء لا تكون عنده بعد. فيرجع الصنف `undefined`، ويُبقي
 * `compileStyle` العنصرَ النائب كما هو:
 *
 *     .replace(/\[--(\w+)\]/g, (m, name) => classNames[name] ? … : m)
 *
 * و`[--messageContent]` مُحدِّدُ سمةٍ بهذا الاسم حرفياً — **لا يطابق شيئاً**.
 * فيبقى النمط محقوناً وصامتاً بلا خطأ في أيّ سجلّ. وقِيس أنّه **لا يُصلح
 * نفسه**: فُتحت قناة حتى ظهرت عناصر الرسائل في DOM، والعنصر النائب باقٍ —
 * إذ لا شيء يُعيد ترجمة النمط. أصابت العلّةُ SmartBidi (اتجاه النصّ العربيّ
 * في الرسائل) وSmoothMessages معاً.
 *
 * 🔴 ولماذا لا يكفي `waitFor`: جُرِّب فلم يُصلحها. `waitFor` يُطلق على أوّل
 * وحدةٍ تُرضي المُرشِّح، و`findCssClasses` تبحث بـ`topLevelOnly` — فقد يُطلق
 * النداءُ قبل أن تصير الوحدة **التي تُرضي الشرطين معاً** موجودة، فتُهدر
 * المحاولة الوحيدة. ولذلك **يتحقّق هذا من نجاحه بنفسه**: لا يتوقّف حتى يرى
 * صنفاً حقيقياً، وله سقفٌ زمنيّ فلا يدور إلى الأبد.
 */

/** كل نصف ثانية، لعشرين مرّة = عشر ثوانٍ. يكفي لتحميلٍ كسول ولا يُثقل. */
const EVERY_MS = 500;
const TRIES = 20;

/**
 * 🔴 **البحث صامتٌ هنا عمداً.**
 *
 * `findCssClasses` تُسجّل خطأً في السجلّ كلّما لم تجد — وهذه الدالّة **تتوقّع**
 * ألّا تجد في أوّل محاولة، فكانت تملأ سجلّ كلّ إقلاعٍ بأخطاءٍ متوقَّعة تُخفي
 * الأخطاء الحقيقية بينها. و`find` بـ`isIndirect` هي نفسُها بلا تسجيل.
 */
const quietFind = (classes: string[]): Record<string, string> => {
    const mod = find(filters.byClassNames(...classes), { isIndirect: true, topLevelOnly: true });
    if (!mod) return {};
    try {
        // ⚠️ `mapMangledCssClasses` ترمي إن لم تجد اسماً في الوحدة التي
        // أرضت المُرشِّح. المحاولة التالية ستُعيد الكرّة، فالرمي هنا ليس عطلاً.
        return mapMangledCssClasses(mod, classes);
    } catch {
        return {};
    }
};

export function fillStyleClassesWhenReady(styles: string[], classes: string[]): void {
    let left = TRIES;

    const attempt = (): boolean => {
        const found = quietFind(classes);
        // يُرجَع `{}` حين لا تُوجد الوحدة، فالمِحكّ هو وجود القيم لا الكائن.
        if (classes.some(c => !found[c])) return false;

        for (const style of styles) setStyleClassNames(style, found);
        return true;
    };

    if (attempt()) return;

    const timer = setInterval(() => {
        if (attempt()) { clearInterval(timer); return; }
        // 🔴 والاستسلام يُقال. كانت الحلقة تنتهي بصمت بعد عشر ثوانٍ، فيبقى
        // النمطُ بلا أصناف ولا شيء يدلّ على أنّ الإضافة لم تعمل.
        if (--left <= 0) {
            clearInterval(timer);
            logger.warn(`لم تُحلّ الأصناف [${classes.join(", ")}] خلال ${(TRIES * EVERY_MS) / 1000} ثوانٍ — النمط المرتبط بها بلا أثر.`);
        }
    }, EVERY_MS);
}
