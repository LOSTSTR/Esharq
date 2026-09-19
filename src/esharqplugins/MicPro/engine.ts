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

import { SettingsStore } from "@api/Settings";
import { microphoneStore } from "@plugins/_micProEngine/stores";
import { PluginNative } from "@utils/types";
import { FluxDispatcher, MediaEngineStore, useEffect, useState, VoiceActions } from "@webpack/common";

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

/** هل الستيريو مفعَّل فعلياً في الملف الحالي؟ */
export function isStereoEnabled(): boolean {
    const p = microphoneStore?.get?.().currentProfile;
    return p?.channelsEnabled === true && (p.channels ?? 1) >= 2;
}

/* ── ستيريو الجلسة: موفِّقٌ واحد ─────────────────────────────────────────────────
 *
 * 🔴 كان التفعيل والإطفاء نداءين مستقلّين من كلّ زرّ، فتسابقا: إطفاءٌ يصل وهو
 * يُرقّع فيُعلَن «مطفأ» والوحدة مُرقَّعة، وتفعيلٌ يصل والإرجاع في الطريق فيُعلَن
 * «مفعّل» والوحدة أصليّة — و«حذف» و«＋ جديد» والوضع المتقدّم تُغيّر القنوات دون
 * أن تمرّ بأيّهما. الآن: **النيّة** = الملفّ الشخصيّ الحاليّ، و**الحقيقة** = ما
 * تعرفه العمليّة الرئيسة عن هذه العمليّة، وموفِّقٌ واحد متسلسل يُقرّب الثانية من
 * الأولى كلّما تغيّر أيٌّ منهما.
 * ───────────────────────────────────────────────────────────────────────────── */

/** رقعتا الفيديو في المُرقِّع — لا شأن للستيريو بهما، فلا تُحسبان في جاهزيّته. */
const VIDEO_PATCHES = new Set(["DropFrameBypass", "PacerDrainRate"]);

/** ما طبّقه المُرقِّع الأصليّ فعلاً — تعرضه الواجهة بأرقامه بدل «جاهز» وحدها. */
export interface StereoEngineDetail {
    /** رقع الصوت التي طُبّقت / كلّ رقع الصوت. */
    ok: number;
    total: number;
    /** رقع الصوت التي لم تُطبَّق بأسمائها. */
    missing: string[];
}

export type StereoPhase = "idle" | "applying" | "reverting" | "waiting-call";
export type StereoErrorKind = "download" | "integrity" | "not-loaded" | "disk-patched" | "unknown";

interface StereoState {
    /** هل وحدة الصوت في هذه العمليّة مُرقَّعة بفعلنا؟ null = لم نسأل بعد. */
    applied: boolean | null;
    detail: StereoEngineDetail | null;
    phase: StereoPhase;
    error: StereoErrorKind | null;
    /** إرجاعٌ فشل بخطأ (لا ببايتاتٍ تغيّرت) — لا يُعاد تلقائياً، ويُعاد بنقرةٍ من المستخدم. */
    revertStuck: boolean;
    /**
     * أُرجع بعضُ الترقيع ولم يُرجَع بعضه (بايتاتٌ غيّرها غيرُنا). حالٌ ثابتة حتى إغلاق
     * ديسكورد: لا يُعاد المسح (يُخطئ المواضع الباقية) ولا يُعلَن «يعمل».
     */
    partial: boolean;
}

const state: StereoState = { applied: null, detail: null, phase: "idle", error: null, revertStuck: false, partial: false };

export function stereoEngineState(): Readonly<StereoState> { return state; }
/** true = كلّ رقع الصوت مطبَّقة · false = مطبَّق جزئيّاً أو فشل · null = غير مُرقَّع. */
export function stereoReady(): boolean | null {
    if (state.error || state.partial) return false;
    if (!state.applied || !state.detail) return null;
    return state.detail.ok === state.detail.total;
}

const engineListeners = new Set<() => void>();
function emitEngine() {
    for (const fn of engineListeners) { try { fn(); } catch { /* آمن */ } }
}
/** يُعيد رسم الواجهة حين تتغيّر حالة الترقيع — وهي تتغيّر بعد الرسم. */
export function useStereoEngine() {
    const [, bump] = useState(0);
    useEffect(() => {
        const fn = () => bump(n => n + 1);
        engineListeners.add(fn);
        return () => { engineListeners.delete(fn); };
    }, []);
    return { ...state, ready: stereoReady() };
}

function classifyError(raw: string): StereoErrorKind {
    if (raw === "DISK_PATCHED") return "disk-patched";
    if (/integrity|verification/i.test(raw)) return "integrity";
    if (/not found in process|nativeModules/i.test(raw)) return "not-loaded";
    if (/GET https|fetch|ENOTFOUND|ECONN|ETIMEDOUT|EAI_AGAIN|socket|network|\b[45]\d\d\b/i.test(raw)) return "download";
    return "unknown";
}

function detailFrom(result: { patches?: { name: string; status: string; }[]; }): StereoEngineDetail {
    const audio = (result.patches ?? []).filter(p => !VIDEO_PATCHES.has(p.name));
    const done = (s: string) => s === "ok" || s === "already_patched";
    return {
        ok: audio.filter(p => done(p.status)).length,
        total: audio.length,
        missing: audio.filter(p => !done(p.status)).map(p => p.name)
    };
}

/**
 * ⚠️ لا تُكتَب وحدة الصوت أثناء مكالمة ولا أثناء اختبار الميكروفون، ترقيعاً كان أو
 * إرجاعاً: بعض الرقع في دوالّ يمرّ بها خيط الصوت مع كلّ إطار، وكتابة عدّة بايتات
 * في شيفرةٍ تُنفَّذ الآن ليست ذرّية. يُنتظَر حتى تنتهي، ويُخبَر المستخدم.
 */
function voiceBusy(): boolean {
    if (inCall() || isLoopbackOn()) return true;
    try { return !!(MediaEngineStore as any)?.getLoopback?.(); } catch { return false; }
}

/** نيّة المستخدم: ستيريو في الملفّ الحاليّ، والوحدة ليست مُرقَّعة على القرص. */
function wantStereo() { return isStereoEnabled() && state.error !== "disk-patched"; }

let running: Promise<void> | null = null;
let again = false;
let waitPoll: ReturnType<typeof setInterval> | null = null;

function stopWaiting() {
    if (waitPoll != null) { clearInterval(waitPoll); waitPoll = null; }
}

/** @returns "deferred" إن بدأت مكالمة أثناء التحضير (التنزيل) فلم يُكتب شيء. */
async function applyOnce(): Promise<"done" | "deferred"> {
    state.phase = "applying"; state.error = null; emitEngine();
    try {
        const prepared = await Native!.prepareStereo();
        if (!prepared.ok) {
            state.error = classifyError(prepared.error ?? "");
            // وحدةٌ مُرقَّعة على القرص حالٌ متوقَّعة (ستيريو دائم)، لا عطل.
            if (state.error === "disk-patched") console.info("[MicPro] session stereo skipped: the voice module is patched on disk");
            else console.error("[MicPro] stereo engine failed:", prepared.error);
            return "done";
        }
        // 🔴 الفحص الأوّل سبق التنزيل، والتنزيل قد يطول: يُعاد الفحص الآن، قبل الكتابة مباشرةً.
        if (voiceBusy()) return "deferred";
        const result = await Native!.applyPatches();
        if (result.error) {
            state.error = classifyError(result.error);
            console.error("[MicPro] stereo engine failed:", result.error);
            return "done";
        }
        state.applied = true;
        if (result.partialRevert) { state.partial = true; state.detail = null; return "done"; }
        state.detail = detailFrom(result);
        console.log(`[MicPro] ${result.assetSource}${result.cached ? " (cached)" : ""} | ${result.module_base} | patches: ok:${result.ok}/${result.patches_in_ini} failed:${result.failed} skipped:${result.skipped} | audio ${state.detail.ok}/${state.detail.total}`);
    } catch (e: any) {
        state.error = classifyError(String(e?.message ?? e));
        console.error("[MicPro] stereo engine failed:", e);
    }
    return "done";
}

async function revertOnce() {
    state.phase = "reverting"; emitEngine();
    try {
        const result = await Native!.revertPatches();
        if (result.error) { state.revertStuck = true; console.error("[MicPro] stereo revert failed:", result.error); return; }
        if (result.notApplied) { state.applied = false; state.detail = null; return; }
        console.log(`[MicPro] stereo reverted | ${result.module_base} | ok:${result.ok} failed:${result.failed} skipped:${result.skipped}`);
        // ما لم يُرجَع يبقى مُرقَّعاً — فلا نُعلن الإطفاء كاذبين، ولا نعيد المحاولة بلا نهاية.
        if (result.failed === 0) { state.applied = false; state.detail = null; state.revertStuck = false; } else { state.partial = true; state.detail = null; }
    } catch (e) {
        state.revertStuck = true;
        console.error("[MicPro] stereo revert failed:", e);
    }
}

/**
 * يُقرّب حال وحدة الصوت من نيّة المستخدم. متسلسل: طلبٌ يصل أثناء عمليّة يُعاد
 * بعدها بالنيّة الأحدث، فلا تتسابق عمليّتان أبداً. `explicit` = فعلُ مستخدم،
 * يمسح خطأً سابقاً فيُسمح بمحاولة جديدة (التنزيل مثلاً بعد عودة الشبكة).
 */
let retry = false;

export function reconcileStereo(explicit = false) {
    if (!IS_DISCORD_DESKTOP || Native == null) return;
    // فعلُ المستخدم يُعلَّم ولا يُنفَّذ الآن: يُستهلَك حين تبدأ الجولة، فنقرةٌ تصل أثناء
    // عمليّةٍ ستفشل لا يضيع أثرها.
    if (explicit) retry = true;
    if (running) { again = true; return; }

    running = (async () => {
        do {
            again = false;
            if (retry) {
                retry = false;
                if (state.error !== "disk-patched") state.error = null;
                state.revertStuck = false;
            }
            if (state.applied === null) {
                try {
                    const known = await Native.patchState();
                    state.applied = known.applied;
                    // صفحةٌ أُعيد تحميلها في عمليّةٍ مُرقَّعة: الأرقام من الترقيع الأوّل لا من مسحٍ جديد.
                    if (known.applied && known.result?.partialRevert) state.partial = true;
                    else if (known.applied && known.result) state.detail = detailFrom(known.result);
                } catch { state.applied = false; }
            }
            const want = wantStereo();
            const needsWork = !state.partial && (want ? !state.applied && state.error == null : state.applied === true && !state.revertStuck);
            if (!needsWork) { state.phase = "idle"; stopWaiting(); continue; }
            if (voiceBusy()) {
                state.phase = "waiting-call";
                waitPoll ??= setInterval(() => { if (!voiceBusy()) reconcileStereo(); }, 2000);
                continue;
            }
            stopWaiting();
            if (want) {
                if (await applyOnce() === "deferred") {
                    state.phase = "waiting-call";
                    waitPoll ??= setInterval(() => { if (!voiceBusy()) reconcileStereo(); }, 2000);
                    continue;
                }
            } else await revertOnce();
            state.phase = "idle";
        } while (again);
    })().finally(() => {
        running = null;
        emitEngine();
        // 🔴 يقظةٌ ضائعة، قِيست حيّاً: زرّ «ستيريو الجلسة» يكتب القناتين ثمّ التفعيل،
        // فأوّل كتابة تبدأ تشغيلاً لا يجد عملاً ويخرج من حلقته، لكنّ `finally` هذه تأتي
        // في مهمّةٍ لاحقة — فالكتابة الثانية ترى `running` قائماً فتترك `again` وتعود،
        // ولا أحد يقرؤه. فكان التفعيل لا يُرقّع شيئاً.
        if (again) reconcileStereo();
    });
}

/* ── معالجة الصوت مع الستيريو ─────────────────────────────────────────────────
 * الستيريو يحتاج إطفاء إلغاء الضوضاء والصدى وAGC (تُحوّل الصوت أحادياً)، وإطفاؤه
 * يُعيدها. كان هذا في زرّ «ستيريو الجلسة» وحده، فالانتقال إلى ملفٍّ أحاديّ بطريقٍ
 * آخر كان يترك الميكروفون بلا معالجة في كلّ مكالمةٍ لاحقة. الآن يتبع النيّة نفسها
 * من أيّ طريقٍ جاءت، والنسخة المحفوظة تبقى بعد إعادة التشغيل. */
function onStereoIntentChange(on: boolean) {
    if (on) {
        if (settings.store.savedProcessing == null) {
            const s = readState();
            settings.store.savedProcessing = { noiseMode: s.noiseMode, echo: s.echo, agc: s.agc };
        }
        // 🔴 أثناء مكالمة لا تُرقَّع الوحدة (تنتظر المكالمة القادمة)، فإطفاء المعالجة الآن
        // كان يترك بقيّة المكالمة بلا إلغاء صدى ولا ضوضاء وبلا ستيريو مقابلها. تُحفظ
        // النيّة فقط، وحارس المكالمات يُطفئها على المكالمة القادمة حين يعمل الستيريو.
        if (voiceBusy()) { saveProc({ noiseMode: "none", echo: false, agc: false }); return; }
        apply.noise("none");
        apply.echo(false);
        apply.agc(false);
    } else {
        let saved = settings.store.savedProcessing;
        // من فعّل الستيريو قبل هذا الإصدار لم تُحفظ معالجته، فبقيت مُطفأةً للأبد بعد
        // الإطفاء. إن كانت المحفوظة هي ما يفرضه الستيريو تماماً فالمرجع إعداد ديسكورد نفسه.
        if (saved == null) {
            const p = currentProc();
            if (p.noiseMode === "none" && !p.echo && !p.agc) {
                const discord = storeProc();
                saved = { noiseMode: discord.noiseMode, echo: discord.echo, agc: discord.agc };
            }
        }
        if (saved != null) {
            apply.noise(saved.noiseMode);
            apply.echo(saved.echo);
            apply.agc(saved.agc);
            settings.store.savedProcessing = null;
        }
    }
}

let lastIntent: boolean | null = null;
const STORE_PATH = "plugins.BetterMicrophone.stores.MicrophoneStore";
function onStoreChange() {
    const intent = isStereoEnabled();
    const changed = lastIntent !== null && intent !== lastIntent;
    if (changed) onStereoIntentChange(intent);
    lastIntent = intent;
    // تغييرٌ لا يمسّ النيّة (سحب شريط معدّل البتّ مثلاً) لا يمسح خطأً سابقاً، وإلّا
    // صار كلّ سحبٍ محاولةَ تنزيلٍ جديدة.
    reconcileStereo(changed);
}

/** يبدأ المتابعة: يعرف الحقيقة من العمليّة الرئيسة ثمّ يوفّق، ويتبع كلّ تغييرٍ في الملفّ. */
export function startStereoEngine() {
    lastIntent = isStereoEnabled();
    SettingsStore.addChangeListener(STORE_PATH, onStoreChange);
    // 🔴 حتى لو كان الستيريو مطفأً: صفحةٌ أُعيد تحميلها في عمليّةٍ رُقِّعت قبلها تعرف
    // الآن أنّها مُرقَّعة فتُرجعها — ومن لم يستعمل الستيريو قطّ لا يُنزّل شيئاً.
    reconcileStereo();
}

export function stopStereoEngine() {
    SettingsStore.removeChangeListener(STORE_PATH, onStoreChange);
    stopWaiting();
}

/**
 * زرّ «ستيريو الجلسة». يغيّر الملفّ الشخصيّ وحده — والمتابِع يتولّى المعالجة
 * ووحدة الصوت — ثمّ يدفع خيارات النقل إلى المكالمة الجارية.
 */
export function toggleStereo(st: any, on: boolean, flush: () => void) {
    if (on) {
        st.setChannels(2);
        st.setChannelsEnabled(true);
    } else {
        st.setChannelsEnabled(false);
    }
    flush();
    // المتابِع يُستدعى من مستمع الإعدادات؛ وهذا احتياطٌ إن لم يتغيّر شيءٌ فعلاً
    // (نقرةٌ على الحالة نفسها) كي يُعاد التحقّق بعد خطأ سابق.
    reconcileStereo(true);
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
