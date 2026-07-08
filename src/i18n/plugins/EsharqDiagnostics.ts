/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "منظومة تشخيص عند الطلب: لقطات بصمة الإضافات، قياس حيّ (معالج/ذاكرة/FPS/حلقة الأحداث/توزيع Flux)، تدقيق الترقيعات غير المُطبَّقة، اختبار أثر سببي حقيقي يقيس الإضافة وهي تعمل مقابل إيقافها، مقارنة بأساس مرجعي، وتوصيات مبنية على القياسات. صفر تكلفة عند الخمول.",
        "en": "On-demand diagnostics suite: plugin footprint snapshots, live profiling (CPU/RAM/FPS/event-loop/Flux dispatch), unapplied-patch audit, a real causal impact test that measures a plugin ON vs OFF, baseline comparison and measurement-backed recommendations. Zero cost when idle."
    }
});
