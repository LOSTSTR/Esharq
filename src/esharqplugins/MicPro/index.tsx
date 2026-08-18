/*
 * MicPro — Esharq microphone control panel
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * الواجهة كلّها انتقلت إلى صفحة **مختبر الصوت** في إعدادات إشراق
 * (`@components/settings/esharq/VoiceLabPage`)، فصار للإعدادات موضع واحد
 * بدل لوحة منبثقة تُكرّر ما في الإعدادات. وما بقي هنا:
 *
 *   ① تشغيل محرّك النقل (ترقيع خيارات النقل) وحارس الاتصالات، وهما يلزمان
 *      من بداية الجلسة قبل أي مكالمة.
 *   ② زرّ في شريط الصوت يفتح صفحة المختبر — نفس الواجهة، مدخل أقرب.
 */

import { PluginInfo as MicEngineInfo } from "@plugins/_micProEngine/constants";
import { MicrophonePatcher } from "@plugins/_micProEngine/patchers";
import { initMicrophoneStore, microphoneStore } from "@plugins/_micProEngine/stores";
import { addSettingsPanelButton, Emitter, MicrophoneSettingsIcon, removeSettingsPanelButton } from "@plugins/philsPluginLibrary";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin from "@utils/types";
import { SettingsRouter } from "@webpack/common";

import { applyProcToConnection, applyStereoEngine, disableMonoBreakers, isLoopbackOn, isStereoEnabled, mediaEngine, setLoopback } from "./engine";
import { settings } from "./settings";

let micPatcher: MicrophonePatcher | undefined;
/** إلغاء اشتراك حارس المكالمات الجديدة — يُفصَل عند الإيقاف. */
let connectionGuardOff: (() => void) | undefined;

/** يدفع خيارات النقل الحالية إلى المكالمة الجارية. تستدعيه الواجهة بعد كل تغيير. */
export function flushTransmission() {
    try { micPatcher?.forceUpdateTransportationOptions(); } catch { /* آمن */ }
}

/** هل محرّك النقل جاهز؟ الواجهة تُخفي قسم النقل حين لا يكون. */
export function transmissionReady(): boolean {
    return IS_DISCORD_DESKTOP && micPatcher != null && microphoneStore != null;
}

export default definePlugin({
    name: "MicPro",
    description: "Voice Lab engine: applies your microphone settings (gain, noise reduction, echo cancellation, AGC, sensitivity) to every call on Discord's native engine, and adds high-quality stereo transmission. Its panel lives in Esharq Settings under Voice Lab.",
    authors: [EquicordDevs.LOSTSTR, { name: "philhk", id: 305288513941667851n }],
    tags: ["Voice", "Utility"],
    dependencies: ["PhilsPluginLibrary"],
    settings,
    // ضروري للستيريو: يضمن حضور مستمع الاتصال + ترقيع discord_voice من بداية الجلسة قبل أي
    // مكالمة (نفس ما فعله BetterMicrophone الأصلي). بدونه قد لا يُطبَّق الستيريو مطلقاً.
    requiresRestart: true,

    start() {
        addSettingsPanelButton({
            name: "MicPro",
            icon: MicrophoneSettingsIcon,
            get tooltipText() { return t("مختبر الصوت", "Voice Lab"); },
            onClick: () => SettingsRouter.openUserSettings("esharq_voice-lab")
        });

        if (!IS_DISCORD_DESKTOP) return;
        try {
            initMicrophoneStore();
            micPatcher = new MicrophonePatcher().patch();

            // احرس كل اتصال صوتي جديد: إن كان الستيريو مفعّلاً أطفئ مُفسِداته على ذلك الاتصال
            // فوراً؛ وإلا أعِد تطبيق نيّة المعالجة المحفوظة. بدون هذا تبدأ كل مكالمة بافتراضات
            // ديسكورد فتضيع إعدادات المستخدم بصمت. مرّة عند بدء كل مكالمة، بلا كلفة دورية.
            const me = mediaEngine() as any;
            if (me?.emitter) {
                connectionGuardOff = Emitter.addListener(me.emitter, "on", "connection", (connection: any) => {
                    try {
                        if (connection?.context !== "default") return;
                        if (!settings.store.applyToCalls) return;
                        // Stereo needs noise/echo/AGC off (they downmix to mono) — it wins.
                        if (isStereoEnabled()) disableMonoBreakers(connection);
                        else applyProcToConnection(connection);
                    } catch { /* آمن */ }
                }, "MicPro");
            }

            // Ensure Discord's own voice module is loaded before the first call, so the
            // transport patch and the per-connection guard above take effect.
            const nativeModules = globalThis.DiscordNative?.nativeModules;
            if (!nativeModules?.requireModule) throw new Error("DiscordNative.nativeModules is unavailable");
            nativeModules.requireModule("discord_voice");

            // Discord's native voice module downmixes to mono and caps the Opus bitrate,
            // overriding the `channels: 2` set through setTransportOptions — so real stereo
            // needs `discord_voice` patched in memory. That patcher is a pinned, SHA-256
            // verified native module (see native.ts), and it is only fetched and executed
            // when the user has actually turned stereo on: anyone who never enables stereo
            // downloads and runs nothing.
            if (isStereoEnabled()) applyStereoEngine();
        } catch (e) {
            console.error("[MicPro] stereo engine init failed", e);
        }
    },

    stop() {
        removeSettingsPanelButton("MicPro");
        if (isLoopbackOn()) void setLoopback(false);
        try { connectionGuardOff?.(); } catch { /* آمن */ }
        connectionGuardOff = undefined;
        try {
            micPatcher?.unpatch();
            Emitter.removeAllListeners(MicEngineInfo.PLUGIN_NAME);
        } catch (e) { console.error("[MicPro] stop cleanup failed", e); }
        micPatcher = undefined;
    }
});
