/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "وضع الأداء/الألعاب: يقلّل الحركات والواجهات الثقيلة لخفض استهلاك المعالج والذاكرة — يدوياً أو تلقائياً عند بدء لعبة.",
        "en": "Game/performance mode: cuts animations and heavy UI to lower CPU/RAM usage — manually or automatically when a game starts."
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
        "cleanCacheOnStart": { "ar": "تنظيف كاش Discord عند بدء وضع الألعاب", "en": "Clean Discord's cache when game mode starts" }
    }
});
