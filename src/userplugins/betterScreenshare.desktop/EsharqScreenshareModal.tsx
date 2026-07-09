/*
 * BetterScreenshare — Esharq redesigned panel
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * لوحة تحكّم مشاركة الشاشة بأسلوب بطاقات/تبويبين وهوية بنفسجية (سينما) — تلفّ متجر
 * BetterScreenshare (نفس آليّته) بواجهة عربية RTL جميلة بدل نافذة المكتبة الافتراضية.
 */

import "./style.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { isArabicMode, t } from "@utils/esharqI18n";
import { ModalContent, ModalHeader, ModalRoot, type RenderModalProps } from "@utils/esharqModals";
import { ModalSize } from "@utils/modal";
import { React, Select, useState } from "@webpack/common";

// أكواد الفيديو التي يدعمها بثّ ديسكورد؛ "" = تلقائي (اترك ديسكورد يقرّر = تعطيل التجاوُز).
const CODECS: [string, string][] = [
    [t("تلقائي", "Auto"), ""], ["H264", "H264"], ["VP8", "VP8"], ["VP9", "VP9"], ["AV1", "AV1"]
];

const RESOLUTIONS: [string, number, number][] = [
    ["480p", 720, 480], ["720p", 1280, 720], ["1080p", 1920, 1080],
    ["1440p", 2560, 1440], ["2160p", 3840, 2160]
];
const QUALITIES: [string, number][] = [
    [t("منخفض", "Low"), 2500], [t("متوسط", "Medium"), 5000],
    [t("متوسط-عالٍ", "Medium-High"), 7500], [t("عالٍ", "High"), 10000]
];
const FPS: number[] = [15, 30, 60];

// ── لبنات الواجهة ────────────────────────────────────────────────────────────
export function Tile({ span, children }: { span?: boolean; children: React.ReactNode; }) {
    return <div className={"bss-tile" + (span ? " bss-span" : "")}>{children}</div>;
}
export function Cap({ label, value, children }: { label: string; value?: string; children?: React.ReactNode; }) {
    return (
        <div className="bss-cap">
            <span className="bss-label">{label}</span>
            {value != null && <span className="bss-val">{value}</span>}
            {children}
        </div>
    );
}
export function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void; }) {
    return (
        <button type="button" role="switch" aria-checked={on}
            className={"bss-sw" + (on ? " bss-sw-on" : "")}
            onClick={e => { e.stopPropagation(); onChange(!on); }}><i /></button>
    );
}
export function Seg<T>({ options, current, fmt, onPick }: { options: [string, T][]; current: T; fmt?: (v: T) => boolean; onPick: (v: T) => void; }) {
    return (
        <div className="bss-seg">
            {options.map(([label, v], i) => (
                <button key={i} type="button"
                    className={"bss-seg-btn" + ((fmt ? fmt(v) : v === current) ? " bss-seg-on" : "")}
                    onClick={() => onPick(v)}>{label}</button>
            ))}
        </div>
    );
}
export function RangeBar({ value, min, max, step, onInput }: { value: number; min: number; max: number; step?: number; onInput: (v: number) => void; }) {
    const pct = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
    return (
        <div className="bss-range">
            <span className="bss-range-fill" style={{ width: `${pct}%` }} />
            <input type="range" min={min} max={max} step={step ?? 1} value={value}
                onChange={e => onInput(Number(e.currentTarget.value))} />
        </div>
    );
}
export function NumTile({ label, unit, value, def, onValue, enabled, onToggle }: { label: string; unit?: string; value?: number; def: number; onValue: (v: number) => void; enabled?: boolean; onToggle?: (v: boolean) => void; }) {
    return (
        <Tile>
            <Cap label={label}>{onToggle && <Switch on={enabled ?? false} onChange={onToggle} />}</Cap>
            <div className="bss-numwrap">
                <input className="bss-num" type="number" value={value ?? ""} placeholder={String(def)}
                    onChange={e => { const n = parseInt(e.currentTarget.value, 10); if (Number.isFinite(n)) onValue(n); }} />
                {unit && <span className="bss-unit">{unit}</span>}
            </div>
        </Tile>
    );
}

// ── شريط ملفات الإعدادات ─────────────────────────────────────────────────────
export function ProfileBar({ st, apply }: { st: any; apply: () => void; }) {
    const [saving, setSaving] = useState(false);
    const [nameInput, setNameInput] = useState("");
    const name: string = st.currentProfile?.name ?? "";
    const call = <T,>(fn: () => T, d: T): T => { try { return fn(); } catch { return d; } };
    const profiles: { name: string; }[] = call(() => st.getProfiles(true), []);
    const isDefault = call(() => st.isCurrentProfileADefaultProfile(), false);

    const save = () => {
        if (!saving) { setNameInput(name); setSaving(true); return; }
        const nm = nameInput.trim();
        if (!nm || call(() => st.getDefaultProfiles().some((v: any) => v.name === nm), false)) return;
        st.saveProfile({ ...st.getCurrentProfile(), name: nm });
        st.setCurrentProfile(st.getProfile(nm) || { name: "" });
        setSaving(false); apply();
    };
    return (
        <Tile span>
            <Cap label={t("ملف الإعدادات", "Profile")} value={name || t("غير محفوظ", "unsaved")} />
            <div className="bss-profrow">
                {saving ? (
                    <input className="bss-num bss-profname" type="text" placeholder={t("اسم الملف…", "Profile name…")}
                        value={nameInput} onChange={e => setNameInput(e.currentTarget.value)}
                        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setSaving(false); }} />
                ) : (
                    <div className="bss-select">
                        <Select
                            isSelected={v => v === name}
                            options={[
                                ...(name === "" ? [{ label: t("(غير محفوظ)", "(unsaved)"), value: "" }] : []),
                                ...profiles.map(p => ({ label: p.name, value: p.name }))
                            ]}
                            select={v => { st.setCurrentProfile(st.getProfile(v) || { name: "" }); apply(); }}
                            serialize={String}
                            closeOnSelect
                        />
                    </div>
                )}
                <button type="button" className="bss-pbtn bss-pbtn-save" title={t("حفظ", "Save")} onClick={save}>{saving ? "✓" : "💾"}</button>
                <button type="button" className="bss-pbtn" title={t("جديد", "New")} disabled={saving} onClick={() => st.setCurrentProfile({ name: "" })}>＋</button>
                <button type="button" className="bss-pbtn" title={t("نسخ", "Copy")} disabled={saving} onClick={() => { st.setCurrentProfile({ ...st.getCurrentProfile(), name: "" }); setNameInput(""); setSaving(true); }}>⧉</button>
                <button type="button" className="bss-pbtn bss-pbtn-del" title={t("حذف", "Delete")} disabled={saving || isDefault || !name} onClick={() => { st.deleteProfile(st.currentProfile); st.setCurrentProfile(call(() => st.getDefaultProfiles()[0], { name: "" }) ?? { name: "" }); apply(); }}>🗑</button>
            </div>
        </Tile>
    );
}

function Body({ st, apply, onOpenAudio }: { st: any; apply: () => void; onOpenAudio?: () => void; }) {
    const p = st.currentProfile;
    const simple = st.simpleMode ?? true;
    const setRes = (w: number, h: number) => { st.setWidth(w); st.setHeight(h); st.setResolutionEnabled(true); apply(); };
    const setBitrate = (v: number) => { st.setVideoBitrate(v); st.setVideoBitrateEnabled(true); apply(); };
    const setFps = (v: number) => { st.setFramerate(v); st.setFramerateEnabled(true); apply(); };

    return (
        <>
            <div className="bss-tile bss-tap bss-span" onClick={() => st.setSimpleMode(!simple)}>
                <Cap label={t("الوضع المبسّط", "Simple mode")}><Switch on={simple} onChange={v => st.setSimpleMode(v)} /></Cap>
                <span className="bss-note">{simple ? t("خيارات سهلة — أطفئه للتحكّم الكامل.", "Easy options — turn off for full control.") : t("متقدّم — تحكّم كامل بكل المعاملات.", "Advanced — full control over every parameter.")}</span>
            </div>

            {simple ? (
                <>
                    <Tile span>
                        <Cap label={t("الدقة", "Resolution")} value={RESOLUTIONS.find(([, w, h]) => w === p.width && h === p.height)?.[0]} />
                        <Seg options={RESOLUTIONS.map(([l, w, h]) => [l, [w, h]] as [string, [number, number]])}
                            current={[p.width, p.height]} fmt={([w, h]) => w === p.width && h === p.height}
                            onPick={([w, h]) => setRes(w, h)} />
                    </Tile>
                    <Tile span>
                        <Cap label={t("الجودة", "Quality")} value={QUALITIES.find(([, v]) => v === p.videoBitrate)?.[0]} />
                        <Seg options={QUALITIES} current={p.videoBitrate} onPick={setBitrate} />
                    </Tile>
                    <Tile span>
                        <Cap label={t("معدّل الإطارات", "Framerate")} value={`${p.framerate ?? 60} FPS`} />
                        <Seg options={FPS.map(f => [`${f}`, f] as [string, number])} current={p.framerate} onPick={setFps} />
                    </Tile>
                </>
            ) : (
                <>
                    <Tile span>
                        <Cap label={t("الدقة", "Resolution")} value={`${p.width ?? 1920}×${p.height ?? 1080}`}>
                            <Switch on={p.resolutionEnabled ?? false} onChange={v => { st.setResolutionEnabled(v); apply(); }} />
                        </Cap>
                        <div className="bss-grid2">
                            <div className="bss-numwrap">
                                <input className="bss-num" type="number" value={p.width ?? ""} placeholder="1920"
                                    onChange={e => { const n = parseInt(e.currentTarget.value, 10); if (Number.isFinite(n)) { st.setWidth(n); st.setResolutionEnabled(true); apply(); } }} />
                                <span className="bss-unit">{t("العرض", "W")}</span>
                            </div>
                            <div className="bss-numwrap">
                                <input className="bss-num" type="number" value={p.height ?? ""} placeholder="1080"
                                    onChange={e => { const n = parseInt(e.currentTarget.value, 10); if (Number.isFinite(n)) { st.setHeight(n); st.setResolutionEnabled(true); apply(); } }} />
                                <span className="bss-unit">{t("الارتفاع", "H")}</span>
                            </div>
                        </div>
                    </Tile>
                    <div className="bss-grid2">
                        <NumTile label={t("معدّل الإطارات", "Framerate")} unit="FPS" value={p.framerate} def={60} onValue={setFps}
                            enabled={p.framerateEnabled} onToggle={v => { st.setFramerateEnabled(v); apply(); }} />
                        <NumTile label={t("فاصل الإطار المفتاحي", "Keyframe interval")} unit="ms" value={p.keyframeInterval} def={0}
                            onValue={v => { st.setKeyframeInterval(v); st.setKeyframeIntervalEnabled(true); apply(); }}
                            enabled={p.keyframeIntervalEnabled} onToggle={v => { st.setKeyframeIntervalEnabled(v); apply(); }} />
                    </div>
                    <Tile span>
                        <Cap label={t("معدّل البت", "Bitrate")} value={`${p.videoBitrate ?? 5000} kb/s`}>
                            <Switch on={p.videoBitrateEnabled ?? false} onChange={v => { st.setVideoBitrateEnabled(v); apply(); }} />
                        </Cap>
                        <RangeBar value={p.videoBitrate ?? 5000} min={500} max={20000} step={100} onInput={setBitrate} />
                    </Tile>
                    <Tile span>
                        <Cap label={t("كوديك الفيديو", "Video codec")} value={p.videoCodecEnabled && p.videoCodec ? p.videoCodec : t("تلقائي", "Auto")} />
                        <Seg
                            options={CODECS}
                            current={p.videoCodecEnabled ? (p.videoCodec ?? "") : ""}
                            onPick={v => {
                                if (v === "") st.setVideoCodecEnabled(false);
                                else { st.setVideoCodec(v); st.setVideoCodecEnabled(true); }
                                apply();
                            }}
                        />
                        <span className="bss-note">{t("H264 الأوسع توافقاً. «تلقائي» يترك ديسكورد يختار.", "H264 is the most compatible. \"Auto\" lets Discord choose.")}</span>
                    </Tile>
                    <div className="bss-tile bss-tap bss-span" onClick={() => onOpenAudio?.()}>
                        <Cap label={t("إعدادات الصوت", "Audio settings")}>
                            <span className="bss-open">{t("فتح", "Open")} ↗</span>
                        </Cap>
                        <span className="bss-note">{t("ترميز صوت المشاركة: القنوات، تردّد ومعدّل العيّنة، حجم الحزمة، ومعدّل البِت.", "Shared-audio encoding: channels, sample frequency/rate, packet size and bitrate.")}</span>
                    </div>
                </>
            )}

            <div className="bss-tile bss-tap bss-span" onClick={() => { st.setHdrEnabled(!p.hdrEnabled); apply(); }}>
                <Cap label={t("HDR (مدى ديناميكي عالٍ)", "HDR (high dynamic range)")}><Switch on={p.hdrEnabled ?? false} onChange={v => { st.setHdrEnabled(v); apply(); }} /></Cap>
                <span className="bss-note">{t("ألوان أوضح إن دعمها جهازك والمشاهد.", "Richer colors when your device and the viewer support it.")}</span>
            </div>

            <ProfileBar st={st} apply={apply} />

            <button type="button" className="bss-apply" onClick={apply}>{t("✓ تطبيق على البثّ", "✓ Apply to stream")}</button>

            <div className="bss-hint">
                <span className="bss-dot" />
                {t("لأفضل جودة: ابدأ البثّ ثم افتح هذه اللوحة وطبّق. Krisp/إلغاء الصدى قد يخفض جودة صوت المشاركة.", "For best quality: go live, then open this panel and Apply. Krisp/echo-cancel can lower shared-audio quality.")}
            </div>
        </>
    );
}

export function EsharqScreenshareModal({ rootProps, screenshareStore, onDone, onOpenAudio }: { rootProps: RenderModalProps; screenshareStore: any; onDone: () => void; onOpenAudio?: () => void; }) {
    const st = screenshareStore.use();
    const apply = () => { try { onDone(); } catch { /* آمن */ } };
    const dir = isArabicMode() ? "rtl" : "ltr";

    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL} className="bss-root">
            <ModalHeader separator={false}>
                <div className="bss-head" dir={dir}>
                    <span className="bss-glyph">
                        <svg viewBox="0 0 24 24" fill="#fff" aria-hidden><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-6v2h2a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h2v-2H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" /></svg>
                    </span>
                    <div>
                        <div className="bss-title">BetterScreenshare</div>
                        <div className="bss-subtitle">{t("لوحة تحكّم مشاركة الشاشة", "Screen-share control panel")}</div>
                    </div>
                </div>
            </ModalHeader>
            <ModalContent>
                <div className="bss-body" dir={dir}>
                    <ErrorBoundary noop><Body st={st} apply={apply} onOpenAudio={onOpenAudio} /></ErrorBoundary>
                </div>
            </ModalContent>
        </ModalRoot>
    );
}
