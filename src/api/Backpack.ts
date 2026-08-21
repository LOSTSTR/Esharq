/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useEffect, useState } from "@webpack/common";

/**
 * **مخزن الحقيبة** — أيّ أزرار الإضافات يبقى في الواجهة، وأيّها ينزوي.
 *
 * ## لماذا مخزن مستقلّ في `api/`
 *
 * أزرار الإضافات لا تعيش في مكان واحد: خمسة سجلّات في أربعة ملفّات تعرضها
 * في أربعة مواضع من الشاشة. والحقيبة تحتاج أن تُرشّحها كلّها بالقرار نفسه،
 * فالقرار يسكن هنا وحده وكلّ سجلٍّ يسأله عند العرض.
 *
 * 🔴 **ولا يُلمَس زرّ واحد من أزرار ديسكورد.** كل ما يُرشَّح هنا مسجَّل في
 * سجلّاتنا نحن (`ChatBarButtonMap` · `headerBarButtons` ·
 * `channelToolbarButtons` · `UserArea.buttons` · `settingsPanelButtons`).
 * المايك والسمّاعة والإعدادات والبريد والمثبّتة تبقى كما هي في كل الأحوال.
 *
 * ## القرار مقلوب: نحفظ **ما يُعرض** لا ما يُخبَّأ
 *
 * الحفظ الطبيعيّ أن نُخزّن قائمة «المحزوم». وذلك يجعل كل إضافة جديدة يُفعّلها
 * المستخدم تقفز إلى الواجهة تلقائياً، فيعود الزحام الذي جاءت الحقيبة لتُنهيه.
 *
 * ⇒ فالمحفوظ هو **المثبَّت**: ما اختار المستخدم صراحةً أن يبقى ظاهراً. وكل
 * ما عداه — بما فيه ما لم يُخلَق بعد — يذهب إلى الحقيبة من تلقاء نفسه.
 *
 * ## ثلاث حالات، لا حالتان
 *
 * - **الحقيبة مُعطَّلة** (`active === false`): لا ترشيح إطلاقاً. إضافةٌ
 *   مُطفأة يجب ألّا يبقى لها أثر في الواجهة.
 * - **عاديّ**: المثبَّت في مكانه، والباقي داخل الحقيبة.
 * - **التخفّي**: كل شيء يختفي — حتى صندوق أدوات إشراق والحقيبة نفسها —
 *   فتبدو النافذة ديسكورد رسمياً. ولذلك لا مخرج منه إلّا الاختصار.
 */

/** المواضع الخمسة التي تضع فيها الإضافات أزرارها. */
export type BackpackSurface =
    | "chatBar"
    | "headerBar"
    | "channelToolbar"
    | "userArea"
    | "voicePanel";

export const BACKPACK_SURFACES: readonly BackpackSurface[] = [
    "chatBar", "headerBar", "channelToolbar", "userArea", "voicePanel"
];

/**
 * معرّف زرّ الحقيبة نفسه — اسم الإضافة، لأن `PluginManager` يسجّل كل زرّ
 * باسم إضافته (`api/PluginManager.ts:312` وما بعده).
 */
export const BACKPACK_ID = "Backpack";

/** `surface:id` — المعرّف وحده لا يكفي: زرّان في سطحين قد يحملان اسم إضافة واحدة. */
export function backpackKey(surface: BackpackSurface, id: string): string {
    return `${surface}:${id}`;
}

const pinnedKeys = new Set<string>();
const listeners = new Set<() => void>();

let active = false;
let stealth = false;

export function notifyBackpackChange(): void {
    listeners.forEach(listener => listener());
}

/** تُشغّلها الإضافة عند بدئها وتُطفئها عند إيقافها. */
export function setBackpackActive(value: boolean): void {
    active = value;
    if (!value) stealth = false;
    notifyBackpackChange();
}

export function isBackpackActive(): boolean {
    return active;
}

export function isStealth(): boolean {
    return active && stealth;
}

export function setStealth(value: boolean): void {
    if (!active) return;
    stealth = value;
    notifyBackpackChange();
}

export function getPinnedKeys(): string[] {
    return [...pinnedKeys];
}

/** تُستعمل عند تحميل المحفوظ — تستبدل الحالة كاملةً بلا إشعارات متتابعة. */
export function setPinnedKeys(keys: Iterable<string>): void {
    pinnedKeys.clear();
    for (const key of keys) pinnedKeys.add(key);
    notifyBackpackChange();
}

export function isPinned(surface: BackpackSurface, id: string): boolean {
    return pinnedKeys.has(backpackKey(surface, id));
}

export function setPinned(surface: BackpackSurface, id: string, value: boolean): void {
    const key = backpackKey(surface, id);
    if (value) pinnedKeys.add(key);
    else pinnedKeys.delete(key);
    notifyBackpackChange();
}

/**
 * هل يُعرض هذا الزرّ في موضعه الأصليّ؟ — يسألها كل سجلّ قبل أن يرسم.
 *
 * 🔴 الترتيب مقصود: `active` أوّلاً، فلو عُطّلت الإضافة عاد كل شيء ظاهراً
 * ولو بقي في المحفوظ ألف مفتاح.
 */
export function showsInPlace(surface: BackpackSurface, id: string): boolean {
    if (!active) return true;
    if (stealth) return false;
    if (id === BACKPACK_ID) return true;
    return pinnedKeys.has(backpackKey(surface, id));
}

/** هل يُعرض داخل لوحة الحقيبة؟ — نقيض ما سبق، عدا الحقيبة نفسها. */
export function showsInBackpack(surface: BackpackSurface, id: string): boolean {
    if (!active || stealth) return false;
    if (id === BACKPACK_ID) return false;
    return !pinnedKeys.has(backpackKey(surface, id));
}

/**
 * يُعيد رسم ما يعتمد على الحقيبة عند كل تغيير.
 *
 * كل سجلّ يستدعيها في مكوّنه، فالتثبيت والتخفّي يظهران فوراً بلا إعادة
 * تحميل — وبلا مؤقّت يدور في الخلفية.
 */
export function useBackpackVersion(): number {
    const [version, setVersion] = useState(0);

    useEffect(() => {
        const listener = () => setVersion(n => n + 1);
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    }, []);

    return version;
}
