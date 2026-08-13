/*
 * DiscordArabicizer — كاشف تغطية التعريب
 * Copyright (c) 2026 LOSTSTR
 *
 * مبنية على Equicord المرخّصة GPL-3.0-or-later وتخضع لنفس الرخصة.
 *
 * «اشراق / Esharq» وشعاراته وشاراته علامات محفوظة لصاحبها، ولا تشملها رخصة GPL.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * كانت هذه الإضافة **محرّك التعريب**: تلفّ دوالّ `i18n.intl` عند الإقلاع
 * وتترجم كل نصّ عند عرضه، ومعها طبقة احتياطية تستبدل نصوصاً في DOM بعد
 * الرسم.
 *
 * ولم يعد ذلك مطلوباً: التعريب انتقل إلى **نواة إشراق على مستوى البيانات**
 * (`@utils/esharqLocale` · `plugins/_core/arabicLocale`)، فالعربية صارت لغةً
 * يعرفها ديسكورد ويعرضها محرّكه بنفسه.
 *
 * ## لماذا حُذف الغلاف بدل إبقائه احتياطاً
 *
 * - **تكلفة على كل نصّ**: الغلاف يعترض كل استدعاء ترجمة مهما كان النتيجة.
 * - **وميض إنجليزي**: ما يُرسم قبل تركيب الغلاف يظهر بالإنجليزية ثم يتبدّل.
 * - **محرّكان لنفس العمل**: نتيجتان محتملتان لنفس النصّ، وتشخيص أصعب.
 *
 * وبقي لها العمل الذي **لا يقوم به المحرّك**: قياس ما لم يُعرَّب بعد.
 * ⇒ قرار المالك: «اجعل فيها فقط اكتشاف ما لم يُعرَّب».
 *
 * 🔴 **الاسم ومفاتيح الإعدادات لا تُمَسّ**: `pluginsArabic` و`arabicFont`
 * يقرؤهما `esharqPrefs` من `DiscordArabicizer` مباشرةً — وإعادة التسمية
 * تفقد تفضيل المستخدم بصمت.
 */

import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin from "@utils/types";

import { settings } from "./settings";

export default definePlugin({
    name: "DiscordArabicizer",
    description: t(
        "كاشف تغطية التعريب — يقيس ما لم يُعرَّب بعد من نصوص ديسكورد المحمَّلة. التعريب نفسه في نواة إشراق.",
        "Arabic coverage detector — measures which of Discord's loaded strings are still untranslated. The localization itself lives in the Esharq core."
    ),
    authors: [EquicordDevs.LOSTSTR],
    tags: ["Accessibility", "Utility"],
    settings

    // لا `patches` ولا `start`: الفحص لا يجري إلّا بضغطة في الإعدادات،
    // فتكلفة هذه الإضافة وهي مُفعَّلة **صفر**.
});
