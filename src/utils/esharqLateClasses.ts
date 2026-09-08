/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { setStyleClassNames } from "@api/Styles";
import { findCssClasses } from "@webpack";

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

export function fillStyleClassesWhenReady(styles: string[], classes: string[]): void {
    let left = TRIES;

    const attempt = (): boolean => {
        const found = findCssClasses(...classes);
        // `findCssClasses` تُرجع `{}` حين لا تجد، فالمِحكّ هو وجود القيم لا الكائن.
        if (classes.some(c => !found[c])) return false;

        for (const style of styles) setStyleClassNames(style, found);
        return true;
    };

    if (attempt()) return;

    const timer = setInterval(() => {
        if (attempt() || --left <= 0) clearInterval(timer);
    }, EVERY_MS);
}
