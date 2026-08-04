/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Esharq — قراءة تفضيلَي التعريب (لغة الإضافات + خطّ العربية).
 *
 * المفتاحان يسكنان الآن في إعدادات إضافة DiscordArabicizer (مكانهما الطبيعي: كلّ ما
 * يخصّ التعريب في مكان واحد) بعد أن كانا في إضافة Settings الأساسية. تُقرأ القيمة هنا
 * لا في مواضع الاستهلاك كي يبقى الترحيل من المفتاح القديم في نقطة واحدة.
 *
 * لماذا PlainSettings لا Settings؟ القراءة عبر وكيل Settings تُثبّت القيمة الافتراضية
 * في ملفّ الإعدادات عند أوّل قراءة؛ فلو قرأنا المفتاح الجديد عبر الوكيل لثُبِّت "false"
 * فوراً وطمس تفضيل المستخدم القديم قبل أن نصل إليه. القراءة الخام تُميّز «غير محدَّد»
 * عن «محدَّد بـfalse»، فيصحّ الترحيل مرّة واحدة وإلى الأبد.
 */

import { PlainSettings, Settings } from "@api/Settings";

const PLUGIN = "DiscordArabicizer";
const LEGACY_PLUGIN = "Settings";

type PluginStore = Record<string, Record<string, unknown> | undefined> | undefined;

/** قيمة مخزّنة صراحةً (أو undefined إن لم يلمسها المستخدم قط). */
function stored(plugin: string, key: string): unknown {
    return (PlainSettings.plugins as PluginStore)?.[plugin]?.[key];
}

/**
 * هل جهز سجلّ الإضافات؟ القراءة عبر الوكيل تُنشئ كائن الإضافة فور جهوز السجلّ، وقبله
 * تُرجِع undefined — وهي الإشارة الوحيدة الموثوقة لجهوز مخزن الإعدادات.
 */
export function prefsReady(): boolean {
    return (Settings.plugins as PluginStore)?.[PLUGIN] != null;
}

/** تعريب أسماء/أوصاف الإضافات ولوحة اشراق. القديم: Settings.arabicMode. */
export function readPluginsArabic(): boolean {
    const v = stored(PLUGIN, "pluginsArabic");
    if (v !== undefined) return v === true;
    return stored(LEGACY_PLUGIN, "arabicMode") === true;
}

/**
 * الخطّ العربي المختار (مفتاح نصّي). القديم: Settings.arabicFont المنطقي —
 * يُترجمه normalizeFontKey إلى "tajawal"/"off"، والقيمة غير المحدَّدة تعني الافتراضي.
 */
export function readArabicFont(): unknown {
    const v = stored(PLUGIN, "arabicFont");
    return v !== undefined ? v : stored(LEGACY_PLUGIN, "arabicFont");
}
