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

// يجمع *تسميات/أوصاف الواجهة الإنجليزية القابلة للترجمة* (لا أسماء مستخدمين/خوادم/قيم).
// صامت تماماً — يُستخرَج عبر زرّ في إعدادات الإضافة.
const missing = new Set<string>();

// عدّادا تغطية الجلسة — يزيدهما المحرّك (diag في index) مع كل نصّ يمرّ، ويقرؤهما مكوّن
// الإحصاءات في الإعدادات ليعرض «تُرجم X من Y (Z%)» قياساً فعليّاً لا تقديراً.
// (هنا لا في index لتفادي دورة استيراد settings ↔ index.)
export const sessionStats = { hits: 0, misses: 0 };

// أنماط نستبعدها: نصوص ديناميكية/أسماء/قيم ليست تسميات واجهة قابلة للترجمة العامّة.
// ملاحظة: لا نستبعد *كل* نصّ فيه رقم (كان يُسقط أوصافاً مثل "people 18+ ...")؛
// نستبعد القيم الرقمية الصرفة والتواريخ/الأحجام/الأسعار فقط.
const SKIP: RegExp[] = [
    /[؀-ۿ]/,                                              // يحوي حرفاً عربيّاً (اسم/حالة مترجَمة جزئياً)
    /\((text|voice|stage) channel\)$/i,                    // تسميات القنوات
    /\((direct message|category|channel|server|group)\)$/i,
    /^(Above|Below|Combine with|Compose Message,|Message #|Messages in )/, // سحب/تأليف
    /, (edit|server actions|view game profile|Streaming)$/i, // تسميات إمكانية الوصول
    /, (Online|Idle|Offline|Do Not Disturb|Invisible)$/,   // مستخدم + حالة
    /\bmembers of\b/i,
    /: (Avatar Decoration|Nameplate|Profile Effect)$/,     // أسماء منتجات
    /^(Avatar Decoration|Nameplate) Preview:/,
    /^App icon for /,
    /^Server Tag: /,
    /^Unread messages, /,
    // "Playing DayZ" (اسم لعبة متغيّر) — لكن ليس "Playing Now" فهي تسمية ثابتة في
    // بطاقة النشاط، وكانت هذه القاعدة تحجبها عن الحصاد فبقيت بلا ترجمة.
    /^Playing (?!Now$)/,
    /^(Streaming|Watching) /,                              // نشاط/لعبة متغيّرة
    /^Authorized on /,
    // تسميات ديناميكية في المتجر/الإشعارات (تحوي أسماء/أرقام متغيّرة):
    /^Wishlist, /,
    /^(Buy for|Redeem for|Purchase for) /,
    /^(Server boosting since|Subscriber since|Member since) /,
    /^Added on /,
    /^Role icon, /,
    /^Card ending in /,
    /^Primary color: /,
    /^Preview For /,
    /^Online — /,
    /^Page \d/,
    /^Sticker, /,
    /^View \d+ Members?/,
    /, \d+ reactions?,/,                                   // تسميات التفاعلات
    / reaction, press to/,
    /\((group message|message)\)$/,                        // تسميات المحادثات
    /^Active .+ ago$/,                                     // "Active 3 days ago"
    /^call duration /,                                     // مدّة المكالمة
    /^Call tile, /,                                        // بطاقات المكالمة
    /^Browse Channels - /,
    /^Screen \d/,                                          // اختيار الشاشة
    /^(Play|Preview|Unfavorite) /,                         // تسميات أزرار لوحة الأصوات (اسم الصوت متغيّر)
    /^and \d+ other/,                                       // "and 1 other"
    // قيم/تواريخ/أحجام/أسعار (ليست أوصافاً):
    // قيمة رقمية صرفة أو بوحدة قياس فقط ("1080p"، "50MB"، "2.5x"، "30%").
    // كانت هذه القاعدة `/^\d/` فتُسقط *كل* نصّ يبدأ برقم — بما فيه جُمل واجهة حقيقية
    // مثل "3 NEW MENTIONS"، فلا تصل قائمة الحصاد ولا نعلم بوجودها. والقاعدة كانت
    // تناقض القاموس نفسه: فيه ٢١ مدخلة تبدأ برقم ومترجَمة ("2 Server Boosts").
    /^[\d.,]+\s*(px|p|fps|ms|s|m|h|%|x|KB|MB|GB|TB|[Kk]bps|[Mm]bps)?$/,
    /^\$/,                                                  // سعر
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/,                        // تاريخ
    /^[\s\d.,:%+\-/x]+$/i                                   // أرقام/رموز فقط
];

export function collectMissing(text: string): void {
    // نُزيل علامات الوضع التشخيصي (🟢🔴) إن تسرّبت إلى نصوص مركّبة.
    const t = text.replace(/[\u{1F7E2}\u{1F534}]/gu, "").trim();
    if (t.length === 0 || t.length > 300) return; // نتجاهل الفارغ والفقرات الضخمة فقط
    for (const re of SKIP) if (re.test(t)) return;
    missing.add(t);
}

export function getMissing(): string[] {
    return [...missing].sort((a, b) => a.localeCompare(b));
}

export function clearMissing(): void {
    missing.clear();
}
