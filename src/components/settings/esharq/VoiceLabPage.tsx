/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./voiceLab.css";

import { isPluginEnabled } from "@api/PluginManager";
import { FormSwitch } from "@components/FormSwitch";
import { Switch } from "@components/Switch";
import { microphoneStore } from "@plugins/_micProEngine/stores";
import { flushTransmission, transmissionReady } from "@plugins/MicPro";
import {
    apply, isLoopbackOn, isStereoEnabled, MicProNative, type NoiseMode, openLevelStream,
    readState, setLoopback, stereoEngineState, toggleStereo
} from "@plugins/MicPro/engine";
import { settings as micSettings } from "@plugins/MicPro/settings";
import { t } from "@utils/esharqI18n";
import { identity } from "@utils/misc";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher, MediaEngineStore, React, Select, useEffect, useRef, useState } from "@webpack/common";

import { Card, NoticeStrip } from "./Card";
import { Knob } from "./Knob";
import { ACCENT, SURFACE, UNIT } from "./tokens";
import { VoiceLabTools } from "./VoiceLabTools";

/**
 * صفحة **مختبر الصوت** — كل ما يخصّ صوتك الخارج في موضع واحد:
 *
 *   1. الأجهزة        — ميكروفونك وسمّاعتك ومستوى الإخراج
 *   2. مستوى الإدخال  — الكسب بمقبض دوّار + مقياس حيّ + حساسية الكشف
 *   3. المعالجة       — إلغاء الضوضاء والصدى وAGC
 *   4. النقل          — ستيريو وجودة الترميز (محرّك MicPro)
 *   5. الاختبار       — سماع نفسك (loopback حقيقي)
 *
 * 🔴 **كل هذا يقع على محرّك ديسكورد الصوتي الأصلي**، لا على تيار نصنعه: التقاط
 * الميكروفون في سطح المكتب يجري في `discord_voice` الأصلي، فلا سبيل لجافاسكربت
 * أن تحقن صوتاً مُعالَجاً في المكالمة. ما نضبطه هنا هو معالجة ديسكورد نفسها،
 * ولهذا يسمعه الطرف الآخر فعلاً.
 */

/** الوحدة التي يقرأ منها ديسكورد أجهزته — نفس ما تستعمله لوحة الصوت. */
const configModule = findByPropsLazy("getOutputVolume");

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode; }) {
    return (
        <div style={{ marginBottom: UNIT * 2 }}>
            <div style={{ fontSize: 13, marginBottom: UNIT / 2 }}>{label}</div>
            {hint !== undefined && <div style={{ fontSize: 12, opacity: 0.5, marginBottom: UNIT }}>{hint}</div>}
            {children}
        </div>
    );
}

function Seg<T extends string | number>({ options, value, onPick }: {
    options: readonly { value: T; label: string; disabled?: boolean; }[];
    value: T;
    onPick: (v: T) => void;
}) {
    return (
        <div className="esharq-seg" style={{ ["--esharq-knob-accent" as any]: ACCENT }}>
            {options.map(o => (
                <button key={String(o.value)} type="button" disabled={o.disabled}
                    className={o.value === value ? "on" : undefined}
                    onClick={() => onPick(o.value)}>{o.label}</button>
            ))}
        </div>
    );
}

/** أجهزة الإدخال/الإخراج — تُبدَّل بنفس حدث ديسكورد، فتنعكس في لوحته أيضاً. */
function DeviceSelect({ kind }: { kind: "input" | "output"; }) {
    const event = kind === "input" ? "AUDIO_SET_INPUT_DEVICE" : "AUDIO_SET_OUTPUT_DEVICE";
    const read = () => String(kind === "input" ? configModule.getInputDeviceId() : configModule.getOutputDeviceId());
    const [current, setCurrent] = useState(read);

    useEffect(() => {
        const listener = () => setCurrent(read());
        FluxDispatcher.subscribe(event, listener);
        return () => FluxDispatcher.unsubscribe(event, listener);
    }, [kind]);

    const devices: { id: string; name: string; }[] =
        Object.values(kind === "input" ? configModule.getInputDevices() : configModule.getOutputDevices());

    return (
        <Select
            options={devices.map(d => ({ value: d.id, label: d.name }))}
            serialize={identity}
            isSelected={v => v === current}
            select={id => FluxDispatcher.dispatch({ type: event, id })}
        />
    );
}

/**
 * مستوى الميكروفون الحيّ. تيار مستقلّ عن المكالمة (انظر `openLevelStream`)،
 * وكروميوم يبدأ السياق «معلّقاً» أحياناً فلا يصل الصوت ⇒ `resume()` تحلّها.
 */
function useLiveLevel(active: boolean): number {
    const [level, setLevel] = useState(0);
    const ref = useRef<{ ctx?: AudioContext; stream?: MediaStream; raf?: number; }>({});

    useEffect(() => {
        if (!active) return;
        let cancelled = false;
        (async () => {
            try {
                const stream = await openLevelStream();
                if (cancelled) { stream.getTracks().forEach(tr => tr.stop()); return; }
                const ctx = new AudioContext();
                if (ctx.state === "suspended") { try { await ctx.resume(); } catch { /* تجاهل */ } }
                if (cancelled) { stream.getTracks().forEach(tr => tr.stop()); ctx.close().catch(() => { }); return; }
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
                // لو رُفض الميكروفون أو فشل فتح التيار يبقى المقياس صفراً — نُسجّله بدل ابتلاعه.
                console.error("[VoiceLab] live input meter unavailable:", e);
            }
        })();
        return () => {
            cancelled = true;
            const r = ref.current;
            if (r.raf) cancelAnimationFrame(r.raf);
            r.stream?.getTracks().forEach(tr => tr.stop());
            r.ctx?.close().catch(() => { });
            ref.current = {};
        };
    }, [active]);

    return level;
}

/**
 * حقل رقمي بمفتاح: المفتاح يقرّر «هل نفرض هذه القيمة؟»، والرقم يقرّر «كم».
 * وأوّل تفعيل يكتب الافتراضي كي لا يُرسَل حقل فارغ إلى محرّك النقل.
 */
function NumberField({ label, hint, unit, def, enabled, value, onToggle, onValue }: {
    label: string; hint: string; unit?: string; def: number;
    enabled: boolean; value?: number;
    onToggle: (v: boolean) => void; onValue: (v: number) => void;
}) {
    return (
        <div className="esharq-numcard">
            <div className="esharq-numhead">
                <span>{label}</span>
                <Switch checked={enabled} onChange={v => { onToggle(v); if (v && value == null) onValue(def); }} />
            </div>
            <div className="esharq-numinput">
                <input type="number" disabled={!enabled} value={value ?? ""} placeholder={String(def)}
                    aria-label={label}
                    onChange={e => { const n = parseInt(e.currentTarget.value, 10); if (Number.isFinite(n)) onValue(n); }} />
                {unit !== undefined && <span className="esharq-numunit">{unit}</span>}
            </div>
            <span className="esharq-numnote">{hint}</span>
        </div>
    );
}

/**
 * ملفات الإعدادات: اختيار/حفظ/جديد/نسخ/حذف. المحرّك يحفظها دائماً عبر
 * `DataStore`، فكل ملف يبقى بعد إعادة تشغيل ديسكورد. الملفات الافتراضية
 * لا تُحذف ولا يُكتب فوقها — ولهذا يُقاس الاسم عليها قبل الحفظ.
 */
function ProfileBar({ st }: { st: any; }) {
    const [naming, setNaming] = useState(false);
    const [nameInput, setNameInput] = useState("");

    const name: string = st.currentProfile?.name ?? "";
    const call = <T,>(fn: () => T, dflt: T): T => { try { return fn(); } catch { return dflt; } };
    const profiles: { name: string; }[] = call(() => st.getProfiles(true), []);
    const isDefault = call(() => st.isCurrentProfileADefaultProfile(), false);

    const save = () => {
        if (!naming) { setNameInput(name); setNaming(true); return; }
        const nm = nameInput.trim();
        if (!nm || call(() => st.getDefaultProfiles().some((v: any) => v.name === nm), false)) return;
        st.saveProfile({ ...st.getCurrentProfile(), name: nm });
        st.setCurrentProfile(st.getProfile(nm) || { name: "" });
        setNaming(false);
        flushTransmission();
    };
    const del = () => {
        st.deleteProfile(st.currentProfile);
        st.setCurrentProfile(call(() => st.getDefaultProfiles()[0], { name: "" }) ?? { name: "" });
        flushTransmission();
    };

    return (
        <Row label={t("ملف الإعدادات", "Profile")}
            hint={name
                ? t(`المحفوظ الحالي: ${name}`, `Currently saved: ${name}`)
                : t("لم يُحفَظ بعد — احفظه باسم لتعود إليه لاحقاً.", "Not saved yet — save it under a name to come back to it later.")}>
            <div className="esharq-profrow">
                {naming ? (
                    <div className="esharq-numinput">
                        <input type="text" placeholder={t("اسم الملف…", "Profile name…")} value={nameInput}
                            aria-label={t("اسم الملف", "Profile name")}
                            onChange={e => setNameInput(e.currentTarget.value)}
                            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setNaming(false); }} />
                    </div>
                ) : (
                    <Select
                        options={[
                            ...(name === "" ? [{ label: t("(غير محفوظ)", "(unsaved)"), value: "" }] : []),
                            ...profiles.map(pr => ({ label: pr.name, value: pr.name }))
                        ]}
                        serialize={String}
                        isSelected={v => v === name}
                        select={(v: string) => { st.setCurrentProfile(st.getProfile(v) || { name: "" }); flushTransmission(); }}
                        closeOnSelect
                    />
                )}
                <button type="button" className="esharq-pbtn" title={t("حفظ", "Save")} onClick={save}>{naming ? "✓" : "💾"}</button>
                <button type="button" className="esharq-pbtn" title={t("جديد", "New")} disabled={naming}
                    onClick={() => st.setCurrentProfile({ name: "" })}>＋</button>
                <button type="button" className="esharq-pbtn" title={t("نسخ", "Duplicate")} disabled={naming}
                    onClick={() => { st.setCurrentProfile({ ...st.getCurrentProfile(), name: "" }); setNameInput(""); setNaming(true); }}>⧉</button>
                <button type="button" className="esharq-pbtn" title={t("حذف", "Delete")} disabled={naming || isDefault || !name} onClick={del}>🗑</button>
            </div>
        </Row>
    );
}

function TransmissionCard({ index, diskPatched }: { index: number; diskPatched: boolean; }) {
    const st = microphoneStore.use();
    const { currentProfile: p } = st;
    const simple = st.simpleMode ?? true;
    const stereoOn = isStereoEnabled();
    const engine = stereoEngineState();

    const bitrates: readonly { value: number; label: string; }[] = [
        { value: 96, label: t("عادي", "Normal") },
        { value: 160, label: t("متوسط-عالٍ", "Medium-High") },
        { value: 320, label: t("عالٍ", "High") },
        { value: 512, label: t("عالٍ جداً", "Very High") }
    ];

    return (
        <Card index={index} title={t("النقل عالي الجودة", "High-quality transmission")}
            subtitle={t("جودة ما يُرسَل فعلاً إلى الطرف الآخر.", "The quality of what actually reaches the other side.")}>
            <ProfileBar st={st} />

            <FormSwitch
                title={t("الوضع المبسّط", "Simple mode")}
                description={simple
                    ? t("مفعّل — خيارات سهلة. أطفئه لتظهر الإعدادات المتقدّمة.", "On — easy options. Turn it off to reveal the advanced settings.")
                    : t("متقدّم — تحكّم كامل بمعاملات النقل.", "Advanced — full control over the transport parameters.")}
                value={simple}
                onChange={v => st.setSimpleMode(v)}
            />

            <FormSwitch
                title={t("ستيريو", "Stereo")}
                description={diskPatched
                    ? t("مُعطَّل: وحدة صوت ديسكورد مُرقَّعة على القرص بأداة خارجية، وهي تستهدف ما يستهدفه ستيريو إشراق.",
                        "Disabled: Discord's voice module is patched on disk by an external tool, which targets what Esharq's stereo targets.")
                    : t("قناتان بدل واحدة.", "Two channels instead of one.")}
                value={stereoOn && !diskPatched}
                disabled={diskPatched}
                onChange={v => toggleStereo(st, v, flushTransmission)}
            />

            {stereoOn && (
                <NoticeStrip>
                    {t("لضمان عمل الستيريو أُوقف تلقائياً: إلغاء الضوضاء، وإلغاء الصدى، وAGC — لأنها تُحوّل صوتك إلى أحادي فتُفسده.",
                        "To keep stereo working, noise suppression, echo cancellation and AGC were turned off automatically — they downmix your mic to mono and break it.")}
                </NoticeStrip>
            )}

            {simple ? (
                <Row label={t("جودة الصوت", "Audio quality")}>
                    <Seg options={bitrates} value={p.voiceBitrate ?? 96}
                        onPick={v => { st.setVoiceBitrate(v); st.setVoiceBitrateEnabled(true); flushTransmission(); }} />
                </Row>
            ) : (
                <>
                    <Row label={`${t("معدّل البتّ", "Bitrate")} — ${p.voiceBitrate ?? 96} kbps`}>
                        <input type="range" min={8} max={512} step={8} value={p.voiceBitrate ?? 96} style={{ width: "100%" }}
                            aria-label={t("معدّل البتّ", "Bitrate")}
                            onChange={e => { st.setVoiceBitrate(Number(e.currentTarget.value)); st.setVoiceBitrateEnabled(true); flushTransmission(); }} />
                    </Row>
                    <div className="esharq-numgrid">
                        <NumberField label={t("القنوات", "Channels")} hint={t("‎1 = أحادي · 2 = ستيريو", "1 = mono · 2 = stereo")} def={2}
                            enabled={p.channelsEnabled ?? false} value={p.channels}
                            onToggle={v => { st.setChannelsEnabled(v); flushTransmission(); }}
                            onValue={v => { st.setChannels(v); flushTransmission(); }} />
                        <NumberField label={t("معدّل البيانات", "Sample rate")} hint={t("سرعة الترميز — الأعلى أوضح", "Encode rate — higher is clearer")} unit="Hz" def={48000}
                            enabled={p.rateEnabled ?? false} value={p.rate}
                            onToggle={v => { st.setRateEnabled(v); flushTransmission(); }}
                            onValue={v => { st.setRate(v); flushTransmission(); }} />
                        <NumberField label={t("تردّد العيّنات", "Frequency")} hint={t("عيّنات/ثانية — الافتراضي 48000", "Samples per second — default 48000")} unit="Hz" def={48000}
                            enabled={p.freqEnabled ?? false} value={p.freq}
                            onToggle={v => { st.setFreqEnabled(v); flushTransmission(); }}
                            onValue={v => { st.setFreq(v); flushTransmission(); }} />
                        <NumberField label={t("حجم الحزمة", "Packet size")} hint={t("عيّنات لكل حزمة — الافتراضي 960", "Samples per packet — default 960")} def={960}
                            enabled={p.pacsizeEnabled ?? false} value={p.pacsize}
                            onToggle={v => { st.setPacsizeEnabled(v); flushTransmission(); }}
                            onValue={v => { st.setPacsize(v); flushTransmission(); }} />
                    </div>
                </>
            )}

            {/* تبديل الملف يُبدّل عدّة قيَم دفعةً واحدة، فيلزم دفعها كلّها إلى المكالمة الجارية. */}
            <button type="button" onClick={flushTransmission}
                style={{
                    width: "100%", marginTop: UNIT * 2, padding: `${UNIT * 1.2}px`, borderRadius: 9,
                    border: "none", cursor: "pointer", background: SURFACE[3], color: "var(--text-normal)", fontSize: 13
                }}>
                {t("✓ تطبيق على المكالمة الجارية", "✓ Apply to the current call")}
            </button>

            {engine === false && (
                <NoticeStrip tone="danger">
                    {t("محرّك الستيريو لم يُحمَّل، فلن يُبَثّ الصوت ستيريو فعلياً. أعد تشغيل ديسكورد؛ وإن استمرّ الأمر فتحقّق من اتصالك.",
                        "The stereo engine didn't load, so audio won't actually transmit in stereo. Restart Discord; if it persists, check your connection.")}
                </NoticeStrip>
            )}
        </Card>
    );
}

export function VoiceLabPage() {
    const [s, setS] = useState(readState);
    const [testing, setTesting] = useState(isLoopbackOn());
    const [master, setMaster] = useState(micSettings.store.applyToCalls);
    const level = useLiveLevel(true);
    const engineEnabled = isPluginEnabled("MicPro");
    // ترقيع القرص يُقاس من **بصمة ملفّ ديسكورد نفسه** لا من وجود الأداة: قد
    // تُحذف الأداة ويبقى الترقيع، فالحال التي تهمّ هي حال ديسكورد.
    const [diskPatched, setDiskPatched] = useState(false);
    const readPatchState = () => {
        MicProNative?.voicePatchState()
            .then(r => setDiskPatched(r.patched > 0))
            .catch(() => setDiskPatched(false));
    };
    useEffect(readPatchState, []);

    // زامِن الحالة حيّاً: نستمع لتغيّرات محرّك الصوت (بدء/إنهاء مكالمة، تبديل جهاز…)
    // ونُحدّث كل ثانية كشبكة أمان لكشف الدخول/الخروج من المكالمة.
    useEffect(() => {
        const resync = () => setS(readState());
        const id = setInterval(resync, 1000);
        (MediaEngineStore as any).addChangeListener?.(resync);
        return () => {
            clearInterval(id);
            (MediaEngineStore as any).removeChangeListener?.(resync);
        };
    }, []);

    // اختبار السماع يبقى مشتغلاً لو غادر المستخدم الصفحة وهو يظنّه توقّف — فنُطفئه.
    useEffect(() => () => { if (isLoopbackOn()) void setLoopback(false); }, []);

    const isVAD = s.inputMode === "VOICE_ACTIVITY";
    const sensitivity = Math.round(Math.max(0, Math.min(100, s.vadThreshold + 100)));

    return (
        <>
            <NoticeStrip>
                {t("كل ما هنا يُطبَّق على محرّك ديسكورد الصوتي نفسه، فيسمعه من معك في المكالمة — لا على معاينة محلّية.",
                    "Everything here is applied to Discord's own audio engine, so the people in your call actually hear it — not to a local preview.")}
            </NoticeStrip>

            <Card index={0}
                title={t("المفتاح الرئيسي", "Master switch")}
                subtitle={t("حين يُطفأ، تحكم إعدادات ديسكورد نفسها ولا يُفرَض شيء على مكالماتك.",
                    "When off, Discord's own settings rule and nothing is forced onto your calls.")}
                badge={s.inCall ? t("في مكالمة", "In a call") : t("خارج مكالمة", "Not in a call")}>
                <FormSwitch
                    title={t("تطبيق مختبر الصوت على كل المكالمات", "Apply Voice Lab to every call")}
                    description={t("إعداداتك تُعاد على كل مكالمة تفتحها، لا على الحالية وحدها.",
                        "Your settings are re-applied to every call you join, not just the current one.")}
                    value={master}
                    onChange={v => { micSettings.store.applyToCalls = v; setMaster(v); }}
                />
                {!engineEnabled && (
                    <NoticeStrip tone="danger">
                        {t("إضافة MicPro مُعطَّلة، فلن تُطبَّق الإعدادات تلقائياً على المكالمات الجديدة ولا يعمل النقل عالي الجودة. فعّلها من صفحة الإضافات.",
                            "The MicPro plugin is disabled, so settings won't be re-applied to new calls and high-quality transmission is unavailable. Enable it in the Plugins page.")}
                    </NoticeStrip>
                )}
            </Card>

            <Card index={1} title={t("الأجهزة", "Devices")}
                subtitle={t("مدخل الصوت ومخرجه — نفس ما تختاره لوحة ديسكورد.", "Audio input and output — the same choice Discord's own panel makes.")}>
                <Row label={t("جهاز الإدخال (الميكروفون)", "Input device (microphone)")}>
                    <DeviceSelect kind="input" />
                </Row>
                <Row label={t("جهاز الإخراج (السمّاعة)", "Output device (speakers)")}>
                    <DeviceSelect kind="output" />
                </Row>
                <Row label={`${t("مستوى الإخراج", "Output volume")} — ${Math.round(s.outputVolume)}%`}>
                    <input type="range" min={0} max={200} value={Math.round(s.outputVolume)} style={{ width: "100%" }}
                        aria-label={t("مستوى الإخراج", "Output volume")}
                        onChange={e => {
                            const v = Number(e.currentTarget.value);
                            apply.outputVolume(v);
                            setS(prev => ({ ...prev, outputVolume: v }));
                        }} />
                </Row>
            </Card>

            <Card index={2} title={t("مستوى الإدخال", "Input level")}
                subtitle={t("اسحب المقبض في دائرة لضبط كسب الميكروفون؛ ويستقرّ على أقرب درجة عند الإفلات.",
                    "Drag the knob in a circle to set your mic gain; it snaps to the nearest detent on release.")}>
                <div style={{ display: "flex", alignItems: "center", gap: UNIT * 3, flexWrap: "wrap" }}>
                    <Knob
                        value={Math.round(s.inputVolume)}
                        min={0} max={100} step={5}
                        label={t("كسب الميكروفون", "Microphone gain")}
                        format={v => `${Math.round(v)}%`}
                        onChange={v => { apply.inputVolume(v); setS(prev => ({ ...prev, inputVolume: v })); }}
                    />
                    <div style={{ flex: "1 1 200px", minWidth: 180 }}>
                        <Row label={t("صوتك الآن", "Your voice right now")}>
                            <div className="esharq-vu" style={{ ["--esharq-knob-accent" as any]: ACCENT }}>
                                <i style={{ inlineSize: `${Math.round(level * 100)}%` }} />
                            </div>
                        </Row>
                        <Row label={`${t("حساسية الكشف", "Detection sensitivity")} — ${sensitivity}%`}
                            hint={isVAD ? undefined : t("متاحة في وضع «نشاط الصوت» فقط؛ أنت على «اضغط للتحدّث».", "Only available in Voice Activity mode; you're on Push to Talk.")}>
                            <input type="range" min={0} max={100} value={sensitivity} disabled={!isVAD} style={{ width: "100%" }}
                                aria-label={t("حساسية الكشف", "Detection sensitivity")}
                                onChange={e => {
                                    const db = Number(e.currentTarget.value) - 100;
                                    apply.sensitivity(s.inputMode, db);
                                    setS(prev => ({ ...prev, vadThreshold: db }));
                                }} />
                        </Row>
                    </div>
                </div>
            </Card>

            <Card index={3} title={t("المعالجة", "Processing")}
                subtitle={t("ما يفعله ديسكورد بصوتك قبل إرساله.", "What Discord does to your voice before sending it.")}>
                <Row label={t("إلغاء الضوضاء", "Noise reduction")}>
                    <Seg
                        options={[
                            { value: "none" as NoiseMode, label: t("بلا", "None") },
                            { value: "standard" as NoiseMode, label: t("قياسي", "Standard") },
                            { value: "krisp" as NoiseMode, label: "Krisp", disabled: !s.krispSupported }
                        ]}
                        value={s.noiseMode}
                        onPick={v => { apply.noise(v); setS(prev => ({ ...prev, noiseMode: v })); }}
                    />
                </Row>
                <FormSwitch
                    title={t("إلغاء الصدى", "Echo cancellation")}
                    description={t("يزيل صدى السمّاعات من ميكروفونك.", "Removes speaker echo from your microphone.")}
                    value={s.echo}
                    onChange={v => { apply.echo(v); setS(prev => ({ ...prev, echo: v })); }}
                />
                <FormSwitch
                    title={t("الموازنة التلقائية للكسب (AGC)", "Automatic gain control (AGC)")}
                    description={t("يُقارب مستوى صوتك تلقائياً بين الهمس والصياح.", "Automatically levels your voice between a whisper and a shout.")}
                    value={s.agc}
                    onChange={v => { apply.agc(v); setS(prev => ({ ...prev, agc: v })); }}
                />
            </Card>

            {engineEnabled && transmissionReady() && <TransmissionCard index={4} diskPatched={diskPatched} />}

            <Card index={5} title={t("اختبار الميكروفون", "Microphone test")}
                subtitle={t("تسمع نفسك كما يسمعك الآخرون — بمرور صوتك في المسار نفسه.",
                    "Hear yourself as others hear you — your voice goes through the same path.")}>
                <button type="button"
                    style={{
                        width: "100%", padding: `${UNIT * 1.5}px`, borderRadius: 9, border: "none", cursor: "pointer",
                        background: testing ? ACCENT : SURFACE[3], color: testing ? "#14140f" : "var(--text-normal)",
                        fontWeight: 600, fontSize: 14
                    }}
                    onClick={async () => {
                        const next = !testing;
                        setTesting(next);
                        await setLoopback(next);
                    }}>
                    {testing ? t("⏹  إيقاف الاختبار", "⏹  Stop test") : t("🎧  اسمع نفسك", "🎧  Hear yourself")}
                </button>
            </Card>

            <VoiceLabTools index={6} patchedClients={diskPatched ? 1 : 0} onChanged={readPatchState} />
        </>
    );
}
