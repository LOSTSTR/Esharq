/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * تركيبة الاختصار — نصّاً واحداً يُحفظ ويُقارَن ويُعرَض.
 *
 * مفصولٌ عن الإضافة قصداً: لا يستورد شيئاً من ديسكورد ولا من React، فيُختبَر
 * وحده بأحداث حقيقية بدل أن يُقرأ بالعين ويُفترَض أنّه صحيح.
 */

/** الشكل المحفوظ: `Ctrl+Shift+KeyH`. */
export type Combo = string;

/**
 * 🔴 يُخزَّن `code` لا `key`.
 *
 * `key` هو **الحرف المطبوع**، وهو يتبدّل مع لغة لوحة المفاتيح: اختصارٌ سُجّل
 * على `h` يصير `ا` حين يكتب صاحبه بالعربية فيتوقّف عن العمل — وهذا مستخدمنا
 * الأوّل لا حالة نادرة. و`code` **موضع الزرّ** على اللوحة، لا يتغيّر بلغة.
 *
 * ويُعيد `null` للمُعدِّل وحده: `Ctrl` بلا حرف ليس اختصاراً بعد، بل نصفه.
 */
export function comboFromEvent(event: Pick<KeyboardEvent, "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey">): Combo | null {
    const { code } = event;
    if (code === "" || /^(?:Control|Shift|Alt|Meta|OS)/.test(code)) return null;

    const parts: string[] = [];
    if (event.ctrlKey) parts.push("Ctrl");
    if (event.altKey) parts.push("Alt");
    if (event.shiftKey) parts.push("Shift");
    if (event.metaKey) parts.push("Meta");
    parts.push(code);
    return parts.join("+");
}

/**
 * هل في التركيبة مُعدِّل؟
 *
 * 🔴 اختصارٌ بلا مُعدِّل يسرق كل ضغطة على ذلك الحرف — **بما يُكتب في مربّع
 * الرسالة**. فالمُعدِّل شرط، لا تفضيل.
 */
export function hasModifier(combo: Combo): boolean {
    return /^(?:Ctrl|Alt|Shift|Meta)\+/.test(combo);
}

/** `Ctrl+Shift+KeyH` ⇐ `Ctrl + Shift + H` — للعرض وحده. */
export function prettyCombo(combo: Combo): string {
    if (combo === "") return "";

    return combo
        .split("+")
        .map(part => part
            .replace(/^Key/, "")
            .replace(/^Digit/, "")
            .replace(/^Numpad/, "Num ")
            .replace(/^Arrow/, ""))
        .join(" + ");
}

/** هل يطابق هذا الحدث الاختصار المسجَّل؟ */
export function matchesCombo(event: Pick<KeyboardEvent, "code" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey">, combo: Combo): boolean {
    if (combo === "") return false;
    return comboFromEvent(event) === combo;
}
