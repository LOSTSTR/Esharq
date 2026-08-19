/*
 * MicPro — Esharq microphone control panel
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * محرّك «مختبر الصوت»: كل ما يمسّ محرّك ديسكورد الصوتي الأصلي (MediaEngine).
 *
 * فُصل عن الواجهة لأن للواجهة اليوم مدخلين: صفحة «مختبر الصوت» في إعدادات
 * إشراق، وزرّ الشريط الصوتي. ولو بقي المنطق داخل أحدهما لَنُسخ إلى الآخر،
 * ولَافترقا بصمت عند أوّل تعديل.
 *
 * لا مؤثّرات وهمية هنا: ديسكورد يلتقط الميكروفون في محرّكه الأصلي، فنتحكّم
 * بمعالجته لا بتيار نُلفّقه — وإلّا لم يسمع الطرف الآخر شيئاً من التغيير.
 */

import { microphoneStore } from "@plugins/_micProEngine/stores";
import { PluginNative } from "@utils/types";
import { FluxDispatcher, MediaEngineStore, VoiceActions } from "@webpack/common";

import { settings } from "./settings";

const Native = IS_DISCORD_DESKTOP
    ? (VencordNative.pluginHelpers.MicPro as PluginNative<typeof import("./native")>)
    : null;

/**
 * الجسر الأصلي نفسه، مكشوفاً لصفحة المختبر: أدوات القسم الخارجي تعيش في
 * العملية الرئيسية (تنزيل · تحقّق · تشغيل)، ولا يصحّ أن يُعرَّف الجسر مرّتين.
 */
export const MicProNative = Native;

export type NoiseMode = "none" | "standard" | "krisp";

export const DEFAULT_AGC = {
    enabled: true, useAGC2: true, enableAnalog: false, enableDigital: true,
    headroom_db: 5, max_gain_db: 50, initial_gain_db: 15,
    max_gain_change_db_per_second: 6, max_output_noise_level_dbfs: -50, fixed_gain_db: 0
};

export function mediaEngine() {
    try { return MediaEngineStore.getMediaEngine(); } catch { return null; }
}
export function inCall(): boolean {
    try { return (mediaEngine()?.connections?.size ?? 0) > 0; } catch { return false; }
}
export function forEachConnection(fn: (c: any) => void) {
    try { mediaEngine()?.connections?.forEach(fn); } catch { /* آمن */ }
}

export type ProcState = { echo: boolean; agc: boolean; noiseMode: NoiseMode; vadThreshold: number; };

/**
 * The processing intent MicPro owns. Discord's per-connection setters (setEchoCancellation…)
 * never update the MediaEngineStore getters, so reading those back would flip the UI off a
 * moment after the user toggles. We keep the truth here (persisted) and apply it to the live
 * connection(s). Before the user ever touches the panel, we seed from the store's real values.
 */
function storeProc(): ProcState {
    const S = MediaEngineStore as any;
    const suppression = !!S?.getNoiseSuppression?.();
    const cancellation = !!S?.getNoiseCancellation?.();
    return {
        echo: !!S?.getEchoCancellation?.(),
        agc: !!S?.getAutomaticGainControl?.(),
        noiseMode: (cancellation ? "krisp" : suppression ? "standard" : "none") as NoiseMode,
        vadThreshold: Number(S?.getModeOptions?.()?.threshold ?? -60)
    };
}
export function currentProc(): ProcState {
    return settings.store.procState ?? storeProc();
}
function saveProc(patch: Partial<ProcState>) {
    settings.store.procState = { ...currentProc(), ...patch };
}

export function readState() {
    const S = MediaEngineStore as any;
    const p = currentProc();
    return {
        inputVolume: Number(S?.getInputVolume?.() ?? 100),
        outputVolume: Number(S?.getOutputVolume?.() ?? 100),
        noiseMode: p.noiseMode,
        echo: p.echo,
        agc: p.agc,
        krispSupported: !!S?.isNoiseCancellationSupported?.(),
        inputMode: String(S?.getInputMode?.() ?? "VOICE_ACTIVITY"),
        vadThreshold: p.vadThreshold,
        deviceId: String(S?.getInputDeviceId?.() ?? "default"),
        inCall: inCall()
    };
}

function applyNoiseTo(c: any, mode: NoiseMode) {
    if (mode === "krisp") { c.setNoiseSuppression(false); c.setNoiseCancellation(true); }
    else if (mode === "standard") { c.setNoiseCancellation(false); c.setNoiseSuppression(true); }
    else { c.setNoiseCancellation(false); c.setNoiseSuppression(false); }
}
function applySensitivityTo(c: any, mode: string, thresholdDb: number) {
    const cur = (MediaEngineStore as any)?.getModeOptions?.() ?? {};
    c.setInputMode(mode, {
        vadThreshold: thresholdDb, vadAutoThreshold: false,
        vadUseKrisp: cur.vadUseKrisp, vadKrispActivationThreshold: cur.vadKrispActivationThreshold
    });
}

/**
 * Re-applies the whole owned intent to one connection — used when a call starts, so the
 * user's choices actually take effect on every call (Discord would otherwise reset them).
 */
export function applyProcToConnection(c: any) {
    const p = currentProc();
    const mode = String((MediaEngineStore as any)?.getInputMode?.() ?? "VOICE_ACTIVITY");
    try {
        c.setEchoCancellation(p.echo);
        c.setAutomaticGainControl({ ...DEFAULT_AGC, enabled: p.agc });
        applyNoiseTo(c, p.noiseMode);
        applySensitivityTo(c, mode, p.vadThreshold);
    } catch { /* آمن */ }
}

/** Each setter persists the intent (so the panel doesn't flip back) AND applies it live. */
export const apply = {
    inputVolume(v: number) { try { FluxDispatcher.dispatch({ type: "AUDIO_SET_INPUT_VOLUME", volume: v }); } catch { /* آمن */ } },
    outputVolume(v: number) { try { FluxDispatcher.dispatch({ type: "AUDIO_SET_OUTPUT_VOLUME", volume: v }); } catch { /* آمن */ } },
    echo(on: boolean) { saveProc({ echo: on }); forEachConnection(c => c.setEchoCancellation(on)); },
    agc(on: boolean) { saveProc({ agc: on }); forEachConnection(c => c.setAutomaticGainControl({ ...DEFAULT_AGC, enabled: on })); },
    noise(mode: NoiseMode) { saveProc({ noiseMode: mode }); forEachConnection(c => applyNoiseTo(c, mode)); },
    sensitivity(mode: string, thresholdDb: number) { saveProc({ vadThreshold: thresholdDb }); forEachConnection(c => applySensitivityTo(c, mode, thresholdDb)); }
};

/** يُطفئ على اتصال واحد كل ما يُحوّل الصوت إلى أحادي فيكسر الستيريو: إلغاء ضوضاء/صدى/AGC. */
export function disableMonoBreakers(c: any) {
    try {
        c.setNoiseCancellation(false);
        c.setNoiseSuppression(false);
        c.setEchoCancellation(false);
        c.setAutomaticGainControl({ ...DEFAULT_AGC, enabled: false });
    } catch { /* آمن */ }
}

/** حالة المعالجة المحفوظة قبل تفعيل الستيريو — لاستعادتها عند إطفائه. */
let savedProcessing: { noiseMode: NoiseMode; echo: boolean; agc: boolean; } | null = null;

/** هل الستيريو مفعَّل فعلياً في الملف الحالي؟ */
export function isStereoEnabled(): boolean {
    const p = microphoneStore?.get?.().currentProfile;
    return p?.channelsEnabled === true && (p.channels ?? 1) >= 2;
}

/** جاهزية محرّك النقل الأصلي: null=لم يُطلَب/لم يُحسم، true=طُبّق، false=فشل ⇒ الستيريو لن يُحترَم. */
let nativeReady: boolean | null = null;
export function stereoEngineState(): boolean | null { return nativeReady; }

/**
 * يُنزّل (مرّة واحدة، مثبَّت ومُتحقَّق بـ SHA-256) محرّك ترقيع `discord_voice` ويُطبّقه.
 * لا يُستدعى إطلاقاً ما لم يُفعّل المستخدم الستيريو بنفسه — فمن لا يستخدمه لا يُنزّل شيئاً.
 */
export function applyStereoEngine() {
    if (!IS_DISCORD_DESKTOP || Native == null || nativeReady != null) return;

    Native.applyPatches().then(result => {
        if (result.error) { nativeReady = false; console.error("[MicPro] stereo engine failed:", result.error); return; }
        nativeReady = result.ok > 0;
        console.log(`[MicPro] ${result.assetSource} | ${result.module_base} | patches: ok:${result.ok} failed:${result.failed} skipped:${result.skipped}`);
    }).catch(e => { nativeReady = false; console.error("[MicPro]", e); });
}

/**
 * تفعيل/إيقاف الستيريو. عند التفعيل نُوقف تلقائياً ما يُحوّل الصوت لأحادي (إلغاء ضوضاء/صدى/AGC)
 * وإلا لن يعمل الستيريو فعلياً — ونُعلم المستخدم عبر تنبيه في اللوحة. حارس الاتصالات يُعيد
 * تطبيق هذا الإطفاء على أي مكالمة تُفتَح لاحقاً ما دام الستيريو مفعّلاً.
 */
export function toggleStereo(st: any, on: boolean, flush: () => void) {
    if (on) {
        // فعّل محرّك الترقيع عند أول تشغيل للستيريو داخل الجلسة (وإلا يُطبَّق عند البدء التالي).
        applyStereoEngine();
        // احفظ حالة المعالجة الحالية مرّة واحدة كي نُعيدها عند الإطفاء.
        if (savedProcessing == null) {
            const s = readState();
            savedProcessing = { noiseMode: s.noiseMode, echo: s.echo, agc: s.agc };
        }
        st.setChannels(2);
        st.setChannelsEnabled(true);
        apply.noise("none");
        apply.echo(false);
        apply.agc(false);
    } else {
        st.setChannelsEnabled(false);
        // أعِد تحسينات الصوت التي أطفأناها قسراً (وإلا يبقى المايك «عارياً»).
        if (savedProcessing != null) {
            apply.noise(savedProcessing.noiseMode);
            apply.echo(savedProcessing.echo);
            apply.agc(savedProcessing.agc);
            savedProcessing = null;
        }
    }
    flush();
}

// ── اختبار loopback حقيقي ─────────────────────────────────────────────────────────────
let loopbackOn = false;
let deafenedByUs = false;

export function isLoopbackOn(): boolean { return loopbackOn; }

export async function setLoopback(on: boolean) {
    try {
        await VoiceActions.setLoopback("mic_test", on);
        loopbackOn = on;
        const autoDeafen = settings.store.autoDeafenOnTest;
        if (on && autoDeafen && !(MediaEngineStore as any)?.isSelfDeaf?.()) {
            await VoiceActions.toggleSelfDeaf(); deafenedByUs = true;
        } else if (!on && deafenedByUs && (MediaEngineStore as any)?.isSelfDeaf?.()) {
            await VoiceActions.toggleSelfDeaf(); deafenedByUs = false;
        }
    } catch { /* آمن */ }
}

/**
 * مقياس المستوى الحيّ: نفتح تياراً مستقلاً عن المكالمة لأن التقاط ديسكورد
 * يجري في المحرّك الأصلي، فلا يُقرأ من جافاسكربت.
 *
 * ونُمرّر deviceId المُختار في ديسكورد كـ`{ideal}` لا `{exact}` — فيُطابَق الجهاز
 * الصحيح إن كان مُعرّفه متوافقاً مع Web MediaDevices، وإلا يسقط تلقائياً للافتراضي
 * بلا `OverconstrainedError` (بخلاف `exact` الذي كان يُفرِغ المقياس).
 */
export async function openLevelStream(): Promise<MediaStream> {
    let id = "";
    try { id = String((MediaEngineStore as any)?.getInputDeviceId?.() ?? ""); } catch { /* آمن */ }
    if (id && id !== "default") {
        try { return await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { ideal: id } } }); }
        catch { /* يسقط للافتراضي أدناه */ }
    }
    return navigator.mediaDevices.getUserMedia({ audio: true });
}
