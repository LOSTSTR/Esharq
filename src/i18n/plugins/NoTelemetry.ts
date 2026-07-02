/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": { "ar": "يحجب تتبّعاً إضافياً من ديسكورد يتجاوز إضافة NoTrack المدمجة: تقارير التجارب، وتشخيص المكالمات، وسجلّات التصحيح البعيدة.", "en": "Blocks additional Discord telemetry beyond the built-in NoTrack plugin: experiment exposure reporting, call diagnostics, and remote debug logging." },
    "options": {
        "blockExperimentTracking": { "ar": "منع ديسكورد من الإبلاغ عن تجارب A/B المُسجَّل فيها حسابك." },
        "blockRtcDiagnostics": { "ar": "منع ديسكورد من إرسال تقارير جودة المكالمات إلى خوادمه." },
        "blockRemoteLogging": { "ar": "منع نظام جمع سجلّات التصحيح البعيدة في ديسكورد." }
    }
});
