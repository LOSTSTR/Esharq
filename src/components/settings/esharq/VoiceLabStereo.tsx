/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { MicProNative } from "@plugins/MicPro/engine";
import { t } from "@utils/esharqI18n";
import { Alerts, useEffect, useState } from "@webpack/common";

import { Card, NoticeStrip } from "./Card";
import { ACCENT, RADIUS, SURFACE, UNIT } from "./tokens";

/**
 * **ستيريو دائم** — الطريق الثاني من طريقَي الستيريو في المختبر.
 *
 * وسُمّيا باسمين مختلفين قصداً، لأن «الستيريو» وحده كان يظهر ثلاث مرّات في
 * الصفحة فلا يعرف القارئ أيَّها يُقصَد:
 *
 *   • **ستيريو الجلسة** — في بطاقة النقل. يُرقَّع في **الذاكرة** عند كل تشغيل،
 *     ولا يمسّ ملفّاً على القرص، ويزول بإغلاق ديسكورد.
 *   • **ستيريو دائم** — هنا. يُبدَّل **الملفّ نفسه** فيبقى بعد إعادة التشغيل.
 *
 * وهما **لا يجتمعان**: كلاهما يستهدف `discord_voice.node`، فإن كان الملفّ
 * مُرقَّعاً على القرص لم تُطابق أنماطُ ستيريو الجلسة شيئاً وفشل صامتاً. ولهذا
 * يُعطَّل أحدهما تلقائياً متى عمل الآخر، والسبب مكتوب تحته.
 */

export interface StereoTarget {
    key: string;
    label: string;
    build: string;
    voiceDir: string;
    patched: boolean;
    hasBackup: boolean;
}

function Btn({ label, tone = "plain", disabled, onClick }: {
    label: string;
    tone?: "accent" | "plain" | "danger";
    disabled?: boolean;
    onClick: () => void;
}) {
    const bg = tone === "accent" ? ACCENT : tone === "danger" ? "rgb(242 63 67 / 15%)" : SURFACE[3];
    const fg = tone === "accent" ? "#14140f" : tone === "danger" ? "var(--status-danger, #f23f43)" : "var(--text-normal)";
    return (
        <button type="button" disabled={disabled} onClick={onClick}
            style={{
                padding: `${UNIT}px ${UNIT * 2}px`, borderRadius: 8, border: "none", fontSize: 13,
                fontWeight: tone === "accent" ? 600 : 400, background: bg, color: fg,
                cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1
            }}>
            {label}
        </button>
    );
}

function Detail({ items }: { items: readonly { k: string; v: string; }[]; }) {
    return (
        <div style={{ background: SURFACE[2], borderRadius: RADIUS / 1.5, padding: `${UNIT}px ${UNIT * 1.5}px`, marginTop: UNIT * 1.5 }}>
            {items.map(i => (
                <div key={i.k} style={{ display: "flex", justifyContent: "space-between", gap: UNIT * 2, fontSize: 12, padding: "3px 0" }}>
                    <span style={{ opacity: 0.55 }}>{i.k}</span>
                    <span style={{ textAlign: "end", wordBreak: "break-word" }}>{i.v}</span>
                </div>
            ))}
        </div>
    );
}

function confirm(title: string, body: string, onConfirm: () => void) {
    Alerts.show({
        title,
        body: <p style={{ textAlign: "center", lineHeight: 1.7 }}>{body}</p>,
        confirmText: t("أوافق وأتابع", "I understand, continue"),
        cancelText: t("إلغاء", "Cancel"),
        onConfirm
    });
}

export function PermanentStereoCard({ index, onChanged }: { index: number; onChanged: () => void; }) {
    const [targets, setTargets] = useState<StereoTarget[]>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    const refresh = () => {
        MicProNative?.stereoStatus().then(r => setTargets(r.targets)).catch(() => setTargets([]));
        onChanged();
    };
    useEffect(refresh, []);

    const native = MicProNative;
    if (native == null) return null;

    const run = async (id: string, fn: () => Promise<unknown>) => {
        setBusy(id);
        setError(null);
        try {
            await fn();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(null);
            refresh();
        }
    };

    const anyPatched = targets.some(target => target.patched);

    return (
        <Card index={index}
            title={t("ستيريو دائم", "Permanent stereo")}
            subtitle={t("يُبدّل ملفّ صوت ديسكورد بنسخة مُرقَّعة تُطفئ المرشّحات وترفع معدّل البتّ، ويبقى بعد إعادة التشغيل. بلا بايثون وبلا برنامج خارجي.",
                "Replaces Discord's voice module with a patched build — filters off, higher bitrate — and it survives a restart. No Python, no external program.")}
            badge={anyPatched ? t("مُطبَّق", "Applied") : t("غير مُطبَّق", "Not applied")}
            badgeTone={anyPatched ? "ok" : "info"}>

            <NoticeStrip>
                {t("الفرق عن «ستيريو الجلسة» في بطاقة النقل أعلاه: ذاك يُرقّع في الذاكرة عند كل تشغيل ولا يمسّ ملفّاتك، وهذا يُبدّل الملفّ نفسه. ولا يعملان معاً — فعّل واحداً فقط.",
                    "How this differs from “Session stereo” in the Transmission card above: that one patches in memory on every launch and never touches your files, this one replaces the file itself. They do not work together — enable only one.")}
            </NoticeStrip>

            <NoticeStrip>
                {t("ديسكورد يُبقي ملفّ الصوت مفتوحاً ما دام يعمل، فالتبديل يجري بعد إغلاقه: يُجدوَل عاملٌ صغير ينتظر خروجه ثم يُبدّل ويُعيد فتحه ويمحو مهمّته بنفسه. بلا صلاحيات مدير وبلا إنهاء قسريّ لديسكورد.",
                    "Discord keeps its voice module open while it runs, so the swap happens after it closes: a small scheduled worker waits for it to exit, swaps the files, reopens it and deletes its own task. No admin rights, and Discord is never force-killed.")}
            </NoticeStrip>

            <NoticeStrip tone="danger">
                <b>{t("اقرأ قبل التفعيل:", "Read before enabling:")}</b>
                <ul style={{ margin: `${UNIT}px 0 0`, paddingInlineStart: UNIT * 2.5 }}>
                    <li>{t("الوحدة المُرقَّعة مبنية على بناء ديسكورد 1.0.9243 (يوليو 2026). فإن كان بناؤك أحدث، هذا رجوعٌ بوحدة الصوت إلى الوراء.",
                        "The patched module is built on Discord 1.0.9243 (July 2026). If your build is newer, this steps your voice module backwards.")}</li>
                    <li>{t("توقيع ديسكورد الرقمي يسقط عن الملفّ المُرقَّع — قد تعترضه مضادّات الفيروسات، وقد يستعيده تحديث ديسكورد القادم.",
                        "Discord's digital signature no longer matches the patched file — antivirus may flag it, and Discord's next update may restore the original.")}</li>
                    <li>{t("تعديل ملفّات ديسكورد مخالفٌ لشروطه. نُبقي نسخةً أصلية دائمة وزرَّ تعطيل يُعيدها، لكن القرار قرارك.",
                        "Modifying Discord's files is against its terms. We keep a permanent original backup and a disable button that restores it, but the decision is yours.")}</li>
                    <li>{t("كل ملفّ من التسعة يُنزَّل من التزام مُجمَّد ويُتحقَّق من بصمته (SHA-256) وحجمه قبل نسخ بايت واحد.",
                        "All nine files come from a frozen commit and are SHA-256 and size verified before a single byte is copied.")}</li>
                </ul>
            </NoticeStrip>

            {error !== null && <NoticeStrip tone="danger">{error}</NoticeStrip>}

            {targets.length === 0 ? (
                <NoticeStrip>{t("لم أجد تثبيت ديسكورد على هذا الجهاز.", "No Discord install was found on this machine.")}</NoticeStrip>
            ) : targets.map(target => (
                <div key={target.key} style={{ marginTop: UNIT * 2 }}>
                    <Detail items={[
                        { k: t("العميل", "Client"), v: `${target.label} · ${target.build}` },
                        { k: t("الحالة", "State"), v: target.patched ? t("ستيريو دائم مُفعَّل", "Permanent stereo on") : t("أصليّ", "Original") },
                        { k: t("نسخة أصلية محفوظة", "Original backed up"), v: target.hasBackup ? t("نعم", "Yes") : t("لا", "No") }
                    ]} />
                    <div style={{ display: "flex", gap: UNIT, flexWrap: "wrap", marginTop: UNIT * 1.5 }}>
                        <Btn tone="accent" label={busy === `apply-${target.key}` ? t("جارٍ…", "Working…") : t("تفعيل", "Enable")}
                            disabled={busy !== null || target.patched}
                            onClick={() => confirm(
                                t(`تفعيل الستيريو الدائم على ${target.label}`, `Enable permanent stereo on ${target.label}`),
                                t("ستُنزَّل 25 ميغابايت وتُتحقَّق بصماتها، ثم تُحفظ نسختك الأصلية، ثم يُغلَق ديسكورد ويُبدَّل الملفّ ويُعاد فتحه. أغلِق ديسكورد بنفسك بعد الضغط ليتمّ التبديل.",
                                    "25 MB will be downloaded and hash-verified, your original will be backed up, then Discord closes, the files are swapped and it reopens. Close Discord yourself after pressing so the swap can complete."),
                                () => void run(`apply-${target.key}`, async () => {
                                    await native.stereoApply(target.key, false);
                                    setDone(t("جُدوِل التفعيل — أغلِق ديسكورد ليتمّ.", "Enabling is scheduled — close Discord to let it finish."));
                                })
                            )} />
                        <Btn tone="danger" label={busy === `revert-${target.key}` ? t("جارٍ…", "Working…") : t("تعطيل واستعادة الأصل", "Disable and restore original")}
                            disabled={busy !== null || !target.hasBackup}
                            onClick={() => confirm(
                                t("تعطيل الستيريو الدائم", "Disable permanent stereo"),
                                t("ستُعاد نسختك الأصلية المحفوظة. أغلِق ديسكورد بعد الضغط ليتمّ التبديل.",
                                    "Your saved original will be restored. Close Discord after pressing so the swap can complete."),
                                () => void run(`revert-${target.key}`, async () => {
                                    await native.stereoRevert(target.key, false);
                                    setDone(t("جُدوِل التعطيل — أغلِق ديسكورد ليتمّ.", "Disabling is scheduled — close Discord to let it finish."));
                                })
                            )} />
                    </div>
                </div>
            ))}

            {done !== null && <NoticeStrip>{done}</NoticeStrip>}
        </Card>
    );
}
