/*
 * MicPro — Esharq microphone control panel
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * لوحة تحكّم واحدة للميكروفون، تصميم بطاقات بتبويبين:
 *  ① المعالجة (على محرّك ديسكورد الأصلي MediaEngine): كسب، إلغاء ضوضاء None/Standard/Krisp،
 *     إلغاء صدى، AGC، حساسية + مقياس مستوى حيّ + اختبار loopback حقيقي.
 *  ② النقل عالي الجودة (بسيط/متقدّم): نُعيد استخدام كود BetterMicrophone المُثبَت كما هو.
 * لا مؤثّرات وهمية: ديسكورد يلتقط الميكروفون في المحرّك الأصلي، فنتحكّم بمعالجته لا بتيار وهمي.
 */

import "./style.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { PluginInfo as MicEngineInfo } from "@plugins/_micProEngine/constants";
import { MicrophonePatcher } from "@plugins/_micProEngine/patchers";
import { initMicrophoneStore, microphoneStore } from "@plugins/_micProEngine/stores";
import { addSettingsPanelButton, Emitter, MicrophoneSettingsIcon, removeSettingsPanelButton } from "@plugins/philsPluginLibrary";
import { EquicordDevs } from "@utils/constants";
import { isArabicMode, t } from "@utils/esharqI18n";
import { ModalContent, ModalHeader, ModalRoot, openModal, type RenderModalProps } from "@utils/esharqModals";
import { ModalSize } from "@utils/modal";
import definePlugin, { PluginNative } from "@utils/types";
import { FluxDispatcher, MediaEngineStore, React, Select, useEffect, useRef, useState, VoiceActions } from "@webpack/common";

import { settings } from "./settings";

const Native = IS_DISCORD_DESKTOP
    ? (VencordNative.pluginHelpers.MicPro as PluginNative<typeof import("./native")>)
    : null;

let micPatcher: MicrophonePatcher | undefined;
// جاهزية محرّك النقل الأصلي (patcher.node): null=لم يُحسم، true=طُبّق، false=فشل ⇒ الستيريو لن يُحترَم.
let nativeReady: boolean | null = null;
// إلغاء اشتراك حارس الستيريو على الاتصالات الجديدة (البند 1) — يُفصَل عند الإيقاف.
let stereoGuardOff: (() => void) | undefined;

type NoiseMode = "none" | "standard" | "krisp";

const DEFAULT_AGC = {
    enabled: true, useAGC2: true, enableAnalog: false, enableDigital: true,
    headroom_db: 5, max_gain_db: 50, initial_gain_db: 15,
    max_gain_change_db_per_second: 6, max_output_noise_level_dbfs: -50, fixed_gain_db: 0
};

// ── ① طبقة المعالجة (MediaEngine الأصلي) ──────────────────────────────────────────────
function mediaEngine() {
    try { return MediaEngineStore.getMediaEngine(); } catch { return null; }
}
function inCall(): boolean {
    try { return (mediaEngine()?.connections?.size ?? 0) > 0; } catch { return false; }
}
function forEachConnection(fn: (c: any) => void) {
    try { mediaEngine()?.connections?.forEach(fn); } catch { /* آمن */ }
}

type ProcState = { echo: boolean; agc: boolean; noiseMode: NoiseMode; vadThreshold: number; };

// The processing intent MicPro owns. Discord's per-connection setters (setEchoCancellation…)
// never update the MediaEngineStore getters, so reading those back would flip the UI off a
// moment after the user toggles. We keep the truth here (persisted) and apply it to the live
// connection(s). Before the user ever touches the panel, we seed from the store's real values.
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
function currentProc(): ProcState {
    return settings.store.procState ?? storeProc();
}
function saveProc(patch: Partial<ProcState>) {
    settings.store.procState = { ...currentProc(), ...patch };
}

function readState() {
    const S = MediaEngineStore as any;
    const p = currentProc();
    return {
        inputVolume: Number(S?.getInputVolume?.() ?? 100),
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

// Re-applies the whole owned intent to one connection — used when a call starts, so the
// user's choices actually take effect on every call (Discord would otherwise reset them).
function applyProcToConnection(c: any) {
    const p = currentProc();
    const mode = String((MediaEngineStore as any)?.getInputMode?.() ?? "VOICE_ACTIVITY");
    try {
        c.setEchoCancellation(p.echo);
        c.setAutomaticGainControl({ ...DEFAULT_AGC, enabled: p.agc });
        applyNoiseTo(c, p.noiseMode);
        applySensitivityTo(c, mode, p.vadThreshold);
    } catch { /* آمن */ }
}

// Each setter persists the intent (so the panel doesn't flip back) AND applies it live.
const apply = {
    inputVolume(v: number) { try { FluxDispatcher.dispatch({ type: "AUDIO_SET_INPUT_VOLUME", volume: v }); } catch { /* آمن */ } },
    echo(on: boolean) { saveProc({ echo: on }); forEachConnection(c => c.setEchoCancellation(on)); },
    agc(on: boolean) { saveProc({ agc: on }); forEachConnection(c => c.setAutomaticGainControl({ ...DEFAULT_AGC, enabled: on })); },
    noise(mode: NoiseMode) { saveProc({ noiseMode: mode }); forEachConnection(c => applyNoiseTo(c, mode)); },
    sensitivity(mode: string, thresholdDb: number) { saveProc({ vadThreshold: thresholdDb }); forEachConnection(c => applySensitivityTo(c, mode, thresholdDb)); }
};

// يُطفئ على اتصال واحد كل ما يُحوّل الصوت إلى أحادي فيكسر الستيريو: إلغاء ضوضاء/صدى/AGC.
function disableMonoBreakers(c: any) {
    try {
        c.setNoiseCancellation(false);
        c.setNoiseSuppression(false);
        c.setEchoCancellation(false);
        c.setAutomaticGainControl({ ...DEFAULT_AGC, enabled: false });
    } catch { /* آمن */ }
}

// حالة المعالجة المحفوظة قبل تفعيل الستيريو — لاستعادتها عند إطفائه (البند 2).
let savedProcessing: { noiseMode: NoiseMode; echo: boolean; agc: boolean; } | null = null;

// تفعيل/إيقاف الستيريو. عند التفعيل نُوقف تلقائياً ما يُحوّل الصوت لأحادي (إلغاء ضوضاء/صدى/AGC)
// وإلا لن يعمل الستيريو فعلياً — ونُعلم المستخدم عبر تنبيه في اللوحة. حارس الاتصالات (البند 1)
// يُعيد تطبيق هذا الإطفاء على أي مكالمة تُفتَح لاحقاً ما دام الستيريو مفعّلاً.
function toggleStereo(st: any, on: boolean, flush: () => void) {
    if (on) {
        // احفظ حالة المعالجة الحالية مرّة واحدة كي نُعيدها عند الإطفاء (البند 2).
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
        // البند 2: أعِد تحسينات الصوت التي أطفأناها قسراً (وإلا يبقى المايك «عارياً»).
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

async function setLoopback(on: boolean, autoDeafen: boolean) {
    try {
        await VoiceActions.setLoopback("mic_test", on);
        loopbackOn = on;
        if (on && autoDeafen && !(MediaEngineStore as any)?.isSelfDeaf?.()) {
            await VoiceActions.toggleSelfDeaf(); deafenedByUs = true;
        } else if (!on && deafenedByUs && (MediaEngineStore as any)?.isSelfDeaf?.()) {
            await VoiceActions.toggleSelfDeaf(); deafenedByUs = false;
        }
    } catch { /* آمن */ }
}

// ── مستوى الإدخال الحيّ (VU) — يُطابق جهاز ديسكورد المختار متى أمكن + resume() لتفادي التعليق ──
// البند 5: نُمرّر deviceId المُختار في ديسكورد كـ {ideal} لا {exact} — فيُطابَق الجهاز الصحيح إن
// كان مُعرّفه متوافقاً مع Web MediaDevices، وإلا يسقط تلقائياً للافتراضي بلا OverconstrainedError
// (بخلاف exact الذي كان يُفرِغ المقياس). أي فشل ⇒ الجهاز الافتراضي، فيعمل المتر بثبات دائماً.
async function openLevelStream(): Promise<MediaStream> {
    let id = "";
    try { id = String((MediaEngineStore as any)?.getInputDeviceId?.() ?? ""); } catch { /* آمن */ }
    if (id && id !== "default") {
        try { return await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { ideal: id } } }); }
        catch { /* يسقط للافتراضي أدناه */ }
    }
    return navigator.mediaDevices.getUserMedia({ audio: true });
}

function useLiveLevel(): number {
    const [level, setLevel] = useState(0);
    const ref = useRef<{ ctx?: AudioContext; stream?: MediaStream; raf?: number; }>({});

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const stream = await openLevelStream();
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                const ctx = new AudioContext();
                // كروميوم يبدأ السياق «معلّقاً» أحياناً فلا يصل الصوت ⇒ المقياس فارغ. resume() يحلّها.
                if (ctx.state === "suspended") { try { await ctx.resume(); } catch { /* تجاهل */ } }
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); ctx.close().catch(() => { }); return; }
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 512;
                ctx.createMediaStreamSource(stream).connect(analyser);
                const buf = new Uint8Array(analyser.fftSize);
                ref.current = { ctx, stream };
                const tick = () => {
                    analyser.getByteTimeDomainData(buf);
                    let sum = 0;
                    for (let i = 0; i < buf.length; i++) { const d = (buf[i] - 128) / 128; sum += d * d; }
                    setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3.2));
                    ref.current.raf = requestAnimationFrame(tick);
                };
                tick();
            } catch (e) {
                // لو رُفض الميكروفون أو فشل فتح التيار يبقى المقياس صفراً — نُسجّله للتشخيص بدل ابتلاعه.
                console.error("[MicPro] live input meter unavailable:", e);
            }
        })();
        return () => {
            cancelled = true;
            const r = ref.current;
            if (r.raf) cancelAnimationFrame(r.raf);
            r.stream?.getTracks().forEach(t => t.stop());
            r.ctx?.close().catch(() => { });
            ref.current = {};
        };
    }, []);

    return level;
}

// تحكّم «مستوى الإدخال»: مؤشّر حيّ ملوّن خلفه (المتر) + مقبض أبيض قابل للسحب يمين/يسار يضبط الكسب.
function InputLevel({ gain, onGain }: { gain: number; onGain: (v: number) => void; }) {
    const level = useLiveLevel();
    return (
        <div className="micpro-il">
            <span className="micpro-il-live" style={{ width: `${Math.round(level * 100)}%` }} />
            <input type="range" min={0} max={100} value={gain} aria-label="input level"
                onChange={e => onGain(Number(e.currentTarget.value))} />
        </div>
    );
}

// ── لبنات الواجهة (بطاقات) ────────────────────────────────────────────────────────────
function Tile({ span, tap, onClick, children }: { span?: boolean; tap?: boolean; onClick?: () => void; children: React.ReactNode; }) {
    return (
        <div className={"micpro-tile" + (span ? " micpro-span" : "") + (tap ? " micpro-tap" : "")} onClick={onClick}>
            {children}
        </div>
    );
}
function Cap({ label, value, children }: { label: string; value?: string; children?: React.ReactNode; }) {
    return (
        <div className="micpro-cap">
            <span className="micpro-label">{label}</span>
            {value != null && <span className="micpro-val">{value}</span>}
            {children}
        </div>
    );
}
function Switch({ on, accent, disabled, onChange }: { on: boolean; accent?: boolean; disabled?: boolean; onChange: (v: boolean) => void; }) {
    return (
        <button type="button" role="switch" aria-checked={on} disabled={disabled}
            className={"micpro-sw" + (accent ? " micpro-sw-acc" : "") + (on ? " micpro-sw-on" : "")}
            onClick={e => { e.stopPropagation(); onChange(!on); }}>
            <i />
        </button>
    );
}
// بطاقة تبديل قابلة للنقر (المفتاح + وصف).
function SwitchTile({ label, note, on, span, disabled, onChange }: { label: string; note: string; on: boolean; span?: boolean; disabled?: boolean; onChange: (v: boolean) => void; }) {
    return (
        <Tile span={span} tap onClick={() => !disabled && onChange(!on)}>
            <Cap label={label}><Switch on={on} accent disabled={disabled} onChange={onChange} /></Cap>
            <span className="micpro-note">{note}</span>
        </Tile>
    );
}
// منزلق بشريط تعبئة مرئيّ خلف المؤشّر.
function RangeBar({ value, min, max, step, disabled, onInput }:
{ value: number; min: number; max: number; step?: number; disabled?: boolean; onInput: (v: number) => void; }) {
    const pct = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
    return (
        <div className={"micpro-range" + (disabled ? " micpro-range-off" : "")}>
            <span className="micpro-range-fill" style={{ width: `${pct}%` }} />
            <input type="range" min={min} max={max} step={step ?? 1} value={value} disabled={disabled}
                onChange={e => onInput(Number(e.currentTarget.value))} />
        </div>
    );
}
function SliderTile({ label, value, min, max, step, span, disabled, onInput }:
{ label: string; value: number; min: number; max: number; step?: number; span?: boolean; disabled?: boolean; onInput: (v: number) => void; }) {
    return (
        <Tile span={span}>
            <Cap label={label} value={disabled ? undefined : `${value}${max === 100 ? "%" : ""}`} />
            <RangeBar value={value} min={min} max={max} step={step} disabled={disabled} onInput={onInput} />
        </Tile>
    );
}
function NumberTile({ label, hint, unit, def, enabled, value, onToggle, onValue }:
{ label: string; hint: string; unit?: string; def: number; enabled: boolean; value?: number; onToggle: (v: boolean) => void; onValue: (v: number) => void; }) {
    return (
        <Tile>
            <Cap label={label}>
                <Switch on={enabled} accent onChange={v => { onToggle(v); if (v && value == null) onValue(def); }} />
            </Cap>
            <div className="micpro-numwrap">
                <input className="micpro-num" type="number" disabled={!enabled} value={value ?? ""} placeholder={String(def)}
                    onChange={e => { const n = parseInt(e.currentTarget.value, 10); if (Number.isFinite(n)) onValue(n); }} />
                {unit && <span className="micpro-unit">{unit}</span>}
            </div>
            <span className="micpro-note">{hint}</span>
        </Tile>
    );
}

// شريط ملفات الإعدادات (profiles): اختيار/حفظ/جديد/نسخ/حذف. المحرّك يحفظها بشكل دائم عبر
// DataStore (createPluginStore) — فكلّ ملف محفوظ يبقى بعد إعادة تشغيل ديسكورد. المنطق يطابق
// إدارة الملفات المُثبَتة في المحرّك (saveProfile/duplicate/delete/setCurrentProfile).
function ProfileBar({ st, flush }: { st: any; flush: () => void; }) {
    const [saving, setSaving] = useState(false);
    const [nameInput, setNameInput] = useState("");

    const name: string = st.currentProfile?.name ?? "";
    const call = <T,>(fn: () => T, dflt: T): T => { try { return fn(); } catch { return dflt; } };
    const profiles: { name: string; }[] = call(() => st.getProfiles(true), []);
    const isDefault = call(() => st.isCurrentProfileADefaultProfile(), false);

    const save = () => {
        if (!saving) { setNameInput(name); setSaving(true); return; }
        const nm = nameInput.trim();
        if (!nm || call(() => st.getDefaultProfiles().some((v: any) => v.name === nm), false)) return;
        st.saveProfile({ ...st.getCurrentProfile(), name: nm });
        st.setCurrentProfile(st.getProfile(nm) || { name: "" });
        setSaving(false);
        flush();
    };
    const newProfile = () => st.setCurrentProfile({ name: "" });
    const copy = () => { st.setCurrentProfile({ ...st.getCurrentProfile(), name: "" }); setNameInput(""); setSaving(true); };
    const del = () => {
        st.deleteProfile(st.currentProfile);
        st.setCurrentProfile(call(() => st.getDefaultProfiles()[0], { name: "" }) ?? { name: "" });
        flush();
    };
    const pick = (v: string) => { st.setCurrentProfile(st.getProfile(v) || { name: "" }); flush(); };

    return (
        <Tile span>
            <Cap label={t("ملف الإعدادات", "Profile")} value={name || t("غير محفوظ", "unsaved")} />
            <div className="micpro-profrow">
                {saving ? (
                    <input className="micpro-num micpro-profname" type="text" placeholder={t("اسم الملف…", "Profile name…")}
                        value={nameInput} onChange={e => setNameInput(e.currentTarget.value)}
                        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setSaving(false); }} />
                ) : (
                    <div className="micpro-profsel">
                        <Select
                            isSelected={v => v === name}
                            options={[
                                ...(name === "" ? [{ label: t("(غير محفوظ)", "(unsaved)"), value: "" }] : []),
                                ...profiles.map(pr => ({ label: pr.name, value: pr.name }))
                            ]}
                            select={pick}
                            serialize={String}
                            closeOnSelect
                        />
                    </div>
                )}
                <button type="button" className="micpro-pbtn micpro-pbtn-save" title={t("حفظ", "Save")} onClick={save}>{saving ? "✓" : "💾"}</button>
                <button type="button" className="micpro-pbtn" title={t("جديد", "New")} disabled={saving} onClick={newProfile}>＋</button>
                <button type="button" className="micpro-pbtn" title={t("نسخ", "Copy")} disabled={saving} onClick={copy}>⧉</button>
                <button type="button" className="micpro-pbtn micpro-pbtn-del" title={t("حذف", "Delete")} disabled={saving || isDefault || !name} onClick={del}>🗑</button>
            </div>
        </Tile>
    );
}

// ── ② طبقة النقل: بسيط/متقدّم ─────────────────────────────────────────────────────────
const SIMPLE_BITRATES: [number, string][] = [
    [96, t("عادي", "Normal")], [160, t("متوسط-عالٍ", "Medium-High")],
    [320, t("عالٍ", "High")], [512, t("عالٍ جداً", "Very High")]
];

function TransmissionPane() {
    if (!IS_DISCORD_DESKTOP || micPatcher == null || microphoneStore == null) {
        return <p className="micpro-empty">{t("النقل عالي الجودة متاح على تطبيق سطح المكتب فقط.", "High-quality transmission is desktop-only.")}</p>;
    }
    return <ErrorBoundary noop><TransmissionControls /></ErrorBoundary>;
}

function TransmissionControls() {
    const st = microphoneStore.use();
    const { currentProfile: p } = st;
    const simple = st.simpleMode ?? true;
    const flush = () => { try { micPatcher?.forceUpdateTransportationOptions(); } catch { /* آمن */ } };
    const stereoOn = p.channelsEnabled === true && (p.channels ?? 1) >= 2;

    return (
        <>
            <ProfileBar st={st} flush={flush} />

            <SwitchTile
                label={t("الوضع المبسّط", "Simple mode")}
                note={simple ? t("مفعّل — خيارات سهلة. أطفئه لعرض الإعدادات المتقدّمة.", "On — easy options. Turn off for advanced settings.") : t("متقدّم — تحكّم كامل بمعاملات النقل.", "Advanced — full control over transport parameters.")}
                on={simple}
                onChange={v => st.setSimpleMode(v)}
            />

            {simple ? (
                <>
                    <SwitchTile span label={t("ستيريو", "Stereo")} note={t("قناتان بدل واحدة", "2 channels")} on={stereoOn}
                        onChange={v => { toggleStereo(st, v, flush); }} />

                    {stereoOn && (
                        <div className="micpro-warn">
                            ⚠️ {t("لضمان عمل الستيريو أوقفنا تلقائياً: إلغاء الضوضاء، إلغاء الصدى، وAGC — لأنها تُحوّل صوتك إلى أحادي وتُفسد الستيريو.", "To keep stereo working we automatically turned off noise suppression, echo cancellation and AGC — they downmix your mic to mono and break stereo.")}
                        </div>
                    )}

                    <Tile span>
                        <Cap label={t("جودة الصوت", "Audio quality")} value={SIMPLE_BITRATES.find(([v]) => v === (p.voiceBitrate ?? 96))?.[1]} />
                        <div className="micpro-seg">
                            {SIMPLE_BITRATES.map(([v]) => (
                                <button key={v} type="button"
                                    className={"micpro-seg-btn" + ((p.voiceBitrate ?? 96) === v ? " micpro-seg-on" : "")}
                                    onClick={() => { st.setVoiceBitrate(v); st.setVoiceBitrateEnabled(true); flush(); }}>{v}</button>
                            ))}
                        </div>
                    </Tile>
                </>
            ) : (
                <>
                    <SliderTile span label={t("معدّل البت", "Bitrate")} value={p.voiceBitrate ?? 96} min={8} max={512} step={8}
                        onInput={v => { st.setVoiceBitrate(v); st.setVoiceBitrateEnabled(true); flush(); }} />
                    <div className="micpro-grid2">
                        <NumberTile label={t("القنوات", "Channels")} hint={t("1 = أحادي · 2 = ستيريو", "1 = mono · 2 = stereo")} def={2}
                            enabled={p.channelsEnabled ?? false} value={p.channels}
                            onToggle={v => { st.setChannelsEnabled(v); flush(); }} onValue={v => { st.setChannels(v); flush(); }} />
                        <NumberTile label={t("معدّل البيانات", "Sample rate")} hint={t("سرعة الترميز — الأعلى أوضح", "Encode rate — higher is clearer")} unit="Hz" def={48000}
                            enabled={p.rateEnabled ?? false} value={p.rate}
                            onToggle={v => { st.setRateEnabled(v); flush(); }} onValue={v => { st.setRate(v); flush(); }} />
                        <NumberTile label={t("تردد العينات", "Frequency")} hint={t("عيّنات/ثانية — الافتراضي 48000", "Samples/sec — default 48000")} unit="Hz" def={48000}
                            enabled={p.freqEnabled ?? false} value={p.freq}
                            onToggle={v => { st.setFreqEnabled(v); flush(); }} onValue={v => { st.setFreq(v); flush(); }} />
                        <NumberTile label={t("حجم الحزمة", "Packet size")} hint={t("عيّنات لكل حزمة — الافتراضي 960", "Samples per packet — default 960")} def={960}
                            enabled={p.pacsizeEnabled ?? false} value={p.pacsize}
                            onToggle={v => { st.setPacsizeEnabled(v); flush(); }} onValue={v => { st.setPacsize(v); flush(); }} />
                    </div>
                </>
            )}

            {/* تطبيق الإعدادات/الملف الحالي على مكالمتك الجارية (إعادة دفع خيارات النقل حيّاً) —
                مفيد بعد تبديل ملف الإعدادات. التغييرات الفردية تُطبَّق حيّاً أصلاً، وهذا يضمن دفع الكل. */}
            <button type="button" className="micpro-apply" onClick={flush}>
                {t("✓ تطبيق على المكالمة", "✓ Apply to call")}
            </button>

            {nativeReady === false ? (
                <div className="micpro-warn">⚠️ {t("محرّك الستيريو لم يُحمَّل، فلن يُبَثّ الصوت ستيريو فعلياً. أعد تشغيل ديسكورد؛ وإن استمرّ الأمر فتحقّق من اتصالك بالإنترنت.", "The stereo engine didn't load, so audio won't actually transmit in stereo. Restart Discord; if it persists, check your internet connection.")}</div>
            ) : (
                <div className="micpro-hint">
                    <span className="micpro-dot" />
                    {nativeReady
                        ? t("محرّك الستيريو جاهز — يُطبَّق على مكالمتك الحالية.", "Stereo engine ready — applies to your current call.")
                        : t("يُطبَّق على مكالمتك الحالية عبر محرّك ديسكورد الأصلي.", "Applies to your current call via Discord's native engine.")}
                </div>
            )}
        </>
    );
}

// ── تبويب المعالجة ────────────────────────────────────────────────────────────────────
function ProcessingPane() {
    const [s, setS] = useState(readState);
    const [testing, setTesting] = useState(loopbackOn);

    // البند 3: زامِن الحالة حيّاً بدل قراءتها مرّة واحدة عند الفتح — نستمع لتغيّرات محرّك الصوت
    // (بدء/إنهاء مكالمة، تبديل جهاز…) ونُحدّث كل ثانية كشبكة أمان لكشف الدخول/الخروج من المكالمة.
    // القراءة تعكس القيَم المُطبَّقة فعلاً فلا تُصادم تحديثات المستخدم التفاؤلية.
    useEffect(() => {
        const resync = () => setS(readState());
        const id = setInterval(resync, 1000);
        let subbed = false;
        try { (MediaEngineStore as any).addChangeListener?.(resync); subbed = true; } catch { /* آمن */ }
        return () => {
            clearInterval(id);
            if (subbed) { try { (MediaEngineStore as any).removeChangeListener?.(resync); } catch { /* آمن */ } }
        };
    }, []);

    const isVAD = s.inputMode === "VOICE_ACTIVITY";
    const sensitivityPct = Math.round(Math.max(0, Math.min(100, s.vadThreshold + 100)));
    const off = !s.inCall;

    return (
        <>
            <Tile span>
                <Cap label={t("مستوى الإدخال", "Input level")} value={`${Math.round(s.inputVolume)}%`} />
                <InputLevel gain={Math.round(s.inputVolume)}
                    onGain={v => { apply.inputVolume(v); setS(p => ({ ...p, inputVolume: v })); }} />
            </Tile>

            <SliderTile span label={t("حساسية الصوت", "Sensitivity")} value={sensitivityPct} min={0} max={100} disabled={!isVAD}
                onInput={v => { const db = v - 100; apply.sensitivity(s.inputMode, db); setS(p => ({ ...p, vadThreshold: db })); }} />

            <div className="micpro-note">{t("اسحب مستوى الإدخال يميناً/يساراً لضبط كسب الميكروفون؛ والشريط الملوّن يوضّح صوتك الحيّ.", "Drag the input level to set your mic gain; the colored bar shows your live voice.")}</div>

            <Tile span>
                <Cap label={t("إلغاء الضوضاء", "Noise reduction")} />
                <div className="micpro-seg">
                    {([["none", t("بلا", "None")], ["standard", t("قياسي", "Standard")], ["krisp", "Krisp"]] as [NoiseMode, string][]).map(([mode, lbl]) => (
                        <button key={mode} type="button" disabled={mode === "krisp" && !s.krispSupported}
                            className={"micpro-seg-btn" + (s.noiseMode === mode ? " micpro-seg-on" : "")}
                            onClick={() => { apply.noise(mode); setS(p => ({ ...p, noiseMode: mode })); }}>{lbl}</button>
                    ))}
                </div>
            </Tile>

            <div className="micpro-grid2">
                <SwitchTile label={t("إلغاء الصدى", "Echo cancel")} note={t("يزيل صدى السمّاعات", "Removes speaker echo")} on={s.echo}
                    onChange={v => { apply.echo(v); setS(p => ({ ...p, echo: v })); }} />
                <SwitchTile label={t("AGC تلقائي", "Auto AGC")} note={t("موازنة تلقائية للكسب", "Auto gain balancing")} on={s.agc}
                    onChange={v => { apply.agc(v); setS(p => ({ ...p, agc: v })); }} />
            </div>

            <button type="button" className={"micpro-test" + (testing ? " micpro-test-live" : "")}
                onClick={async () => { const next = !testing; setTesting(next); await setLoopback(next, settings.store.autoDeafenOnTest); }}>
                {testing ? t("⏹  إيقاف الاختبار", "⏹  Stop test") : t("🎧  اختبار الميكروفون (سماع نفسك)", "🎧  Test microphone (hear yourself)")}
            </button>

            {off && <div className="micpro-hint">{t("إعداداتك محفوظة وتُطبَّق تلقائياً على مكالمتك الحالية والقادمة.", "Your settings are saved and applied automatically to your current and next call.")}</div>}
        </>
    );
}

function MicIconGlyph() {
    return (
        <span className="micpro-glyph">
            <svg viewBox="0 0 24 24" fill="#fff" aria-hidden>
                <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
                <path d="M18 12a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.91V20H8.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2H13v-2.09A6 6 0 0 0 18 12Z" />
            </svg>
        </span>
    );
}

function MicProModal({ rootProps }: { rootProps: RenderModalProps; }) {
    const [tab, setTab] = useState<"proc" | "trans">("proc");
    useEffect(() => () => { if (loopbackOn) void setLoopback(false, settings.store.autoDeafenOnTest); }, []);

    // اتجاه اللوحة حسب اللغة — يمنع تشوّه العربية المختلطة (bidi) في نصوصنا.
    const dir = isArabicMode() ? "rtl" : "ltr";

    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL} className="micpro-root">
            <ModalHeader separator={false}>
                <div className="micpro-head" dir={dir}>
                    <MicIconGlyph />
                    <div>
                        <div className="micpro-title">MicPro</div>
                        <div className="micpro-subtitle">{t("لوحة تحكّم الميكروفون", "Microphone control panel")}</div>
                    </div>
                </div>
            </ModalHeader>
            <ModalContent>
                <div className="micpro-tabs" dir={dir}>
                    <button type="button" className={"micpro-tab" + (tab === "proc" ? " micpro-tab-on" : "")} onClick={() => setTab("proc")}>{t("المعالجة", "Processing")}</button>
                    <button type="button" className={"micpro-tab" + (tab === "trans" ? " micpro-tab-on" : "")} onClick={() => setTab("trans")}>{t("النقل عالي الجودة", "Transmission")}</button>
                </div>
                <div className="micpro-body" dir={dir}>
                    {tab === "proc" ? <ProcessingPane /> : <TransmissionPane />}
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

function openPanel() {
    openModal(props => (
        <ErrorBoundary>
            <MicProModal rootProps={props} />
        </ErrorBoundary>
    ));
}

export default definePlugin({
    name: "MicPro",
    description: "One microphone control panel next to the mute button: live level meter, gain, noise reduction (None/Standard/Krisp), echo cancellation, AGC and voice sensitivity — all on Discord's native engine so they affect what others hear — plus a real loopback test and high-quality stereo transmission with Simple/Advanced modes.",
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
            get tooltipText() { return t("لوحة الميكروفون · MicPro", "Microphone panel · MicPro"); },
            onClick: openPanel
        });

        if (!IS_DISCORD_DESKTOP) return;
        try {
            initMicrophoneStore();
            micPatcher = new MicrophonePatcher().patch();

            // البند 1: احرس كل اتصال صوتي جديد — إن كان الستيريو مفعّلاً في الملف، أطفئ مُفسِداته
            // (ضوضاء/صدى/AGC) على ذلك الاتصال فوراً؛ وإلا يبدأ بافتراضات ديسكورد فيُحوَّل صوتك لأحادي
            // بصمت رغم تفعيل الستيريو قبل المكالمة. يُطبَّق مرّة عند بدء كل مكالمة، بلا أي كلفة دورية.
            const me = mediaEngine() as any;
            if (me?.emitter) {
                stereoGuardOff = Emitter.addListener(me.emitter, "on", "connection", (connection: any) => {
                    try {
                        if (connection?.context !== "default") return;
                        const p = microphoneStore?.get?.().currentProfile;
                        const stereo = p?.channelsEnabled === true && (p.channels ?? 1) >= 2;
                        // Stereo needs noise/echo/AGC off (they downmix to mono) — it wins.
                        // Otherwise re-apply the user's processing intent so it sticks per call.
                        if (stereo) disableMonoBreakers(connection);
                        else applyProcToConnection(connection);
                    } catch { /* آمن */ }
                }, "MicPro");
            }

            const nativeModules = globalThis.DiscordNative?.nativeModules;
            if (!nativeModules?.requireModule) throw new Error("DiscordNative.nativeModules is unavailable");
            nativeModules.requireModule("discord_voice");
            Native?.applyPatches().then(result => {
                if (result.error) { nativeReady = false; console.error("[MicPro] stereo engine failed:", result.error); return; }
                nativeReady = result.ok > 0;
                console.log(`[MicPro] ${result.module_base} | patches: ok:${result.ok} failed:${result.failed} skipped:${result.skipped}`);
            }).catch(e => { nativeReady = false; console.error("[MicPro]", e); });
        } catch (e) {
            console.error("[MicPro] stereo engine init failed", e);
        }
    },

    stop() {
        removeSettingsPanelButton("MicPro");
        if (loopbackOn) void setLoopback(false, settings.store.autoDeafenOnTest);
        try { stereoGuardOff?.(); } catch { /* آمن */ }
        stereoGuardOff = undefined;
        try {
            micPatcher?.unpatch();
            Emitter.removeAllListeners(MicEngineInfo.PLUGIN_NAME);
        } catch (e) { console.error("[MicPro] stop cleanup failed", e); }
        micPatcher = undefined;
    }
});
