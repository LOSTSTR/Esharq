/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "وضع الأداء/الألعاب: يقلّل الحركات والواجهات الثقيلة، ويطبّق تحسينات وقت التشغيل (تخطّي Spring، مستمعون passive، صور كسولة، تحرير الذاكرة) لخفض استهلاك المعالج والذاكرة — يدوياً أو تلقائياً عند بدء لعبة.",
        "en": "Game/performance mode: cuts animations and heavy UI and applies runtime speedups (spring skip, passive listeners, lazy images, memory-freeing) to lower CPU/RAM usage — manually or automatically when a game starts."
    },
    "options": {
        "gameMode": { "ar": "تفعيل وضع الأداء/الألعاب", "en": "Enable performance / game mode" },
        "autoDetectGames": { "ar": "تفعيل تلقائي عند اكتشاف لعبة", "en": "Automatically enable when a game is detected" },
        "reduceHardwareAcceleration": { "ar": "تعطيل تسريع العتاد (يتطلب إعادة تشغيل Discord)", "en": "Disable hardware acceleration (requires a Discord restart)" },
        "autoRestartOnHardwareChange": { "ar": "عرض زرّ إعادة تشغيل Discord ليُطبَّق تغيير تسريع العتاد", "en": "Offer to restart Discord so a hardware-acceleration change takes effect" },
        "disableAnimations": { "ar": "تعطيل الحركات والانتقالات", "en": "Disable animations and transitions" },
        "disableGifAutoplay": { "ar": "منع تشغيل الصور المتحركة (GIF) تلقائياً", "en": "Stop GIFs from autoplaying" },
        "compactMode": { "ar": "استخدام الوضع المضغوط للرسائل", "en": "Use compact message mode" },
        "hideActivities": { "ar": "إخفاء أنشطة الأصدقاء (نشِط الآن)", "en": "Hide friends' activities (Active Now)" },
        "changeProcessPriority": { "ar": "خفض أولوية كل عمليات Discord إلى Below Normal (ويندوز)", "en": "Lower all Discord processes' priority to Below Normal (Windows)" },
        "cleanCacheOnStart": { "ar": "تنظيف كاش Discord عند بدء وضع الألعاب", "en": "Clean Discord's cache when game mode starts" },
        "skipSpringAnimations": { "ar": "تخطّي حركات Spring في ديسكورد لواجهة أسرع", "en": "Skip Discord's spring animations for a snappier UI" },
        "passiveListeners": { "ar": "جعل مستمعي التمرير واللمس passive لتمرير أنعم", "en": "Make scroll and touch listeners passive for smoother scrolling" },
        "lazyImages": { "ar": "تحميل الصور كسولاً وفكّ ترميزها بشكل غير متزامن لتقليل التقطيع", "en": "Lazy-load and async-decode images to reduce jank" },
        "clearStoreCaches": { "ar": "تحرير الذاكرة بمسح العديد من ذواكر ديسكورد (الرسائل، الإيموجي، الملفات الشخصية، التجارب، وغيرها) عند بدء وضع الأداء", "en": "Free memory by clearing many Discord caches (messages, emojis, profiles, experiments, and more) when performance mode starts" }
    }
});
