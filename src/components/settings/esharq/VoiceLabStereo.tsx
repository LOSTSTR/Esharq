/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { apply, MicProNative } from "@plugins/MicPro/engine";
import { settings as micSettings } from "@plugins/MicPro/settings";
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
 *   • **ستيريو دائم** — هنا. يُرقَّع **الملفّ نفسه** فيبقى بعد إعادة التشغيل.
 *
 * وهما **لا يجتمعان**: كلاهما يستهدف `discord_voice.node`، والترقيع في الذاكرة فوق
 * ملفٍّ مُرقَّع يكتب في غير مكانه. ولهذا يُعطَّل ستيريو الجلسة تلقائياً متى كان
 * الملفّ مُرقَّعاً، والسبب مكتوب تحته.
 */

export interface StereoTarget {
    key: string;
    label: string;
    build: string;
    voiceDir: string;
    patched: boolean;
    patchedBy: "esharq" | "legacy" | null;
    hasBackup: boolean;
    patchable: { audioOk: number; audioTotal: number; refusal: string | null; } | null;
}

interface SweepResult { removed: string[]; clean: boolean; pending: boolean; pendingProcesses: string[]; removedByUser: boolean; }

function Btn({ label, tone = "plain", disabled, onClick }: {
    label: string;
    tone?: "accent" | "plain" | "danger";
    disabled?: boolean;
    onClick: () => void;
}) {
    const bg = tone === "accent" ? ACCENT : tone === "danger" ? "rgb(242 63 67 / 15%)" : SURFACE[3];
    const fg = tone === "accent" ? "#14140f" : tone === "danger" ? "var(--esharq-on-danger)" : "var(--text-default)";
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

/** رسائل العمليّة الرئيسة إنجليزيّة وتحمل بادئة IPC — نعرض المعنى بلغة الواجهة، والخام في سجلّ المطوّر. */
function explain(raw: string): string {
    // لا شيء من هذه يمسّ مجلد ديسكورد: الكتابة فيه للعامل المُجدوَل وحده، ولا يُجدوَل إلّا بعد نجاح ما قبله.
    const reasons: [RegExp, string][] = [
        [/already has Permanent stereo/, t("الستيريو الدائم مُفعَّلٌ على هذا العميل سلفاً.", "Permanent stereo is already on for this client.")],
        [/already patched \(some sites/, t("وحدة الصوت مُرقَّعةٌ سلفاً بأداةٍ أخرى، فليست أصلاً يُرقَّع منه — لم يُكتب شيء. أرجِعها بأداتها أو أعد تثبيت ديسكورد أوّلاً.",
            "The voice module is already patched by another tool, so it isn't an original to patch from — nothing was written. Undo it with that tool or reinstall Discord first.")],
        [/do not match this voice module/, t("أنماط المُرقِّع لا تطابق وحدة الصوت في هذا البناء، فلم يُكتب شيء. يصلحه تحديثٌ لإشراق حين يُحدَّث المُرقِّع.",
            "The patcher's patterns don't match this build's voice module, so nothing was written. An Esharq update fixes it once the patcher is updated.")],
        [/Unsafe to patch on disk/, t("رقعةٌ تقع حيث يُعيد ويندوز كتابة البايتات عند التحميل، فالترقيع على القرص غير آمن لهذا البناء ولم يُكتب شيء — استعمل «ستيريو الجلسة».",
            "A patch lands where Windows rewrites bytes at load time, so on-disk patching isn't safe for this build and nothing was written — use Session stereo.")],
        [/is not patched/, t("هذا العميل غير مُرقَّع، فلا شيء يُزال.", "This client isn't patched, so there is nothing to remove.")],
        [/No original backup/, t("النسخة الأصليّة المحفوظة مفقودة أو لا تطابق بصمتها، فلم يُكتب شيء. أعد تثبيت ديسكورد لتعود وحدة الصوت الأصليّة.",
            "The saved original is missing or doesn't match its fingerprint, so nothing was written. Reinstall Discord to get the original voice module back.")],
        [/failed verification|integrity check/, t("ملفّات المُرقِّع لم تطابق بصمتها المثبّتة، فلم تُستعمل ولم يُكتب شيء في ديسكورد.",
            "The patcher files didn't match their pinned fingerprint, so they weren't used and nothing was written to Discord.")],
        [/command line is/, t("مسار مجلد بيانات إشراق أطول ممّا تقبله جدولة ويندوز، فلم يُكتب شيء في ديسكورد.",
            "Esharq's data folder path is longer than Windows' scheduler accepts, so nothing was written to Discord.")],
        [/schtasks|stereo worker/, t("تعذّرت جدولة عمليّة التبديل في ويندوز، فلم يُكتب شيء في ديسكورد.",
            "Windows couldn't schedule the swap, so nothing was written to Discord.")],
        [/GET https|fetch|ENOTFOUND|ECONN|ETIMEDOUT|EAI_AGAIN|socket|network/i, t("تعذّر تنزيل ملفّ الأنماط — تحقّق من اتّصالك. لم يُكتب شيء في ديسكورد.",
            "The pattern file couldn't be downloaded — check your connection. Nothing was written to Discord.")]
    ];
    return reasons.find(([pattern]) => pattern.test(raw))?.[1]
        ?? t("خطأ غير متوقّع، ولم يُكتب شيء في ديسكورد — التفاصيل في سجلّ المطوّر.",
            "Unexpected error, and nothing was written to Discord — details are in the developer console.");
}

export function PermanentStereoCard({ index, onChanged }: { index: number; onChanged: () => void; }) {
    const [targets, setTargets] = useState<StereoTarget[]>([]);
    const [sweep, setSweep] = useState<SweepResult | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [scheduled, setScheduled] = useState<"patch" | "revert" | null>(null);
    const [processingOff, setProcessingOff] = useState(false);
    // الإزالة تكتمل عادةً في كنس بدء التشغيل بعد إعادة فتح ديسكورد، قبل أن تُفتح هذه الصفحة.
    const [removedAtStartup] = useState(() => micSettings.store.permanentStereoRemoved === true);
    useEffect(() => { if (removedAtStartup) micSettings.store.permanentStereoRemoved = false; }, []);

    const [canRestart, setCanRestart] = useState(false);
    const refresh = () => {
        MicProNative?.stereoStatus()
            .then(r => {
                setTargets(r.targets);
                setSweep(r.sweep);
                setCanRestart(r.canRestart === true);
                // لا عملَ معلّق فعلاً ⇒ تُصفَّر الراية المحلّية، فلا تبقى البطاقة «مُجدوَلة» بعد أن مات العامل.
                if (r.sweep && !r.sweep.pending) setScheduled(null);
            })
            .catch(() => setTargets([]));
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
            const raw = (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']*': (Error: )?/, "");
            console.error("[MicPro] permanent stereo:", raw);
            setError(explain(raw));
        } finally {
            setBusy(null);
            refresh();
        }
    };

    const anyPatched = targets.some(target => target.patched);
    // العامل قد يموت (إعادة تشغيل، أو ديسكورد بقي في الدرج فاستسلم بعد ١٠ دقائق) فلا يبقى
    // «مُجدوَل» إلى الأبد: الحقيقة من الخادم (sweep.pending)؛ والراية المحلّية تُصفَّر متى قال «لا انتظار».
    const pending = sweep?.pending === true || (scheduled != null && sweep == null);
    // «أُزيل نهائياً» حين تكتمل إزالةٌ طلبها المستخدم — لا بعد تفعيلٍ لم يكتمل.
    const justRemoved = !anyPatched && (removedAtStartup || sweep?.removedByUser === true);

    return (
        <Card index={index}
            title={t("ستيريو دائم", "Permanent stereo")}
            subtitle={t("يُرقّع ملفّ صوت ديسكورد على جهازك — يُطفئ المرشّحات ويرفع معدّل البتّ — فيبقى بعد إعادة التشغيل. بلا بايثون وبلا برنامج خارجي.",
                "Patches Discord's voice module on your disk — filters off, higher bitrate — so it survives a restart. No Python, no external program.")}
            badge={anyPatched ? t("مُطبَّق", "Applied") : t("غير مُطبَّق", "Not applied")}
            badgeTone={anyPatched ? "ok" : "info"}>

            <NoticeStrip>
                {t("الفرق عن «ستيريو الجلسة» في بطاقة النقل أعلاه: ذاك يُرقّع في الذاكرة عند كل تشغيل ولا يمسّ ملفّاتك، وهذا يُرقّع الملفّ نفسه. ولا يعملان معاً — ما دام هذا مُفعَّلاً يُعطَّل ستيريو الجلسة تلقائياً.",
                    "How this differs from “Session stereo” in the Transmission card above: that one patches in memory on every launch and never touches your files, this one patches the file itself. They never run together — while this is on, Session stereo is disabled automatically.")}
            </NoticeStrip>

            <NoticeStrip>
                {t("ديسكورد يُبقي ملفّ الصوت مفتوحاً ما دام يعمل، فالتبديل يجري بعد إغلاقه: يُجدوَل عاملٌ صغير (PowerShell) ينتظر خروجه حتى عشر دقائق، ثم يُبدّل الملفّ ويتحقّق من بصمته ويُعيد فتح ديسكورد ويمحو مهمّته بنفسه. بلا صلاحيات مدير وبلا إنهاء قسريّ.",
                    "Discord keeps its voice module open while it runs, so the swap happens after it closes: a small scheduled worker (PowerShell) waits up to ten minutes for it to exit, swaps the file, checks its fingerprint, reopens Discord and deletes its own task. No admin rights and no force-kill.")}
            </NoticeStrip>

            <NoticeStrip tone="danger">
                <b>{t("اقرأ قبل التفعيل:", "Read before enabling:")}</b>
                <ul style={{ margin: `${UNIT}px 0 0`, paddingInlineStart: UNIT * 2.5 }}>
                    <li>{t("يُرقَّع ملفّ ديسكورد الموجود عندك نفسه — بضع عشرات من البايتات — بأنماط المُرقِّع المثبَّتة نفسها التي يستعملها «ستيريو الجلسة». لا تُنزَّل وحدة صوتٍ من أحد، ولا يرجع صوتك إلى بناءٍ أقدم.",
                        "Your own Discord file is patched — a few dozen bytes — with the same pinned patterns “Session stereo” uses. No voice module is downloaded from anyone, and your voice module is never rolled back to an older build.")}</li>
                    <li>{t("لا يُكتب شيء إلّا إن وجدت كلّ رقعة صوتٍ بايتاتها الأصليّة في مكانها، وتُحفظ نسختك الأصليّة ببصمتها قبل أيّ تبديل.",
                        "Nothing is written unless every audio patch finds its original bytes in place, and your original is saved with its fingerprint before any swap.")}</li>
                    <li>{t("توقيع ديسكورد الرقمي يسقط عن الملفّ المُرقَّع — قد تعترضه مضادّات الفيروسات، وقد يستعيد تحديث ديسكورد القادم الأصل فتُفعّله من جديد.",
                        "Discord's digital signature no longer matches the patched file — antivirus may flag it, and Discord's next update may restore the original, so you'd enable it again.")}</li>
                    <li>{t("تعديل ملفّات ديسكورد مخالفٌ لشروطه. «إزالة» تُعيد الأصل ثمّ تمحو كلّ ما أنشأته هذه الميزة على جهازك، لكن القرار قرارك.",
                        "Modifying Discord's files is against its terms. “Remove” restores the original and then deletes everything this feature created on your machine, but the decision is yours.")}</li>
                </ul>
            </NoticeStrip>

            {anyPatched && (
                <NoticeStrip>
                    {t("ليصل صوتك ستيريو فعلاً أطفئ إلغاء الضوضاء وإلغاء الصدى وAGC — تُحوّل الميكروفون إلى أحادي قبل أن يصل إلى المُرمِّز.",
                        "For your voice to actually go out in stereo, turn off noise suppression, echo cancellation and AGC — they downmix the mic to mono before it reaches the encoder.")}
                    <div style={{ marginTop: UNIT }}>
                        <Btn label={processingOff ? t("أُطفئت ✓", "Turned off ✓") : t("أطفئها الآن", "Turn them off now")} disabled={processingOff}
                            onClick={() => { apply.noise("none"); apply.echo(false); apply.agc(false); setProcessingOff(true); }} />
                    </div>
                </NoticeStrip>
            )}

            {error !== null && <NoticeStrip tone="danger">{error}</NoticeStrip>}

            {justRemoved && (
                <NoticeStrip>
                    {t("أُزيل الستيريو الدائم نهائياً: عاد ملفّ ديسكورد الأصليّ ببصمته، ومُحيت النسخ والعامل ومهمّته من جهازك.",
                        "Permanent stereo was removed completely: Discord's original file is back with its fingerprint, and the copies, the worker and its task were deleted from your machine.")}
                </NoticeStrip>
            )}

            {targets.length === 0 ? (
                <NoticeStrip>{t("لم أجد تثبيت ديسكورد على هذا الجهاز.", "No Discord install was found on this machine.")}</NoticeStrip>
            ) : targets.map(target => {
                const refusal = target.patchable?.refusal ?? null;
                return (
                    <div key={target.key} style={{ marginTop: UNIT * 2 }}>
                        <Detail items={[
                            { k: t("العميل", "Client"), v: `${target.label} · ${target.build}` },
                            {
                                k: t("الحالة", "State"),
                                v: target.patchedBy === "esharq" ? t("ستيريو دائم مُفعَّل", "Permanent stereo on")
                                    : target.patchedBy === "legacy" ? t("مُرقَّع بالطريقة القديمة (وحدة 9243)", "Patched the old way (9243 module)")
                                        : t("أصليّ", "Original")
                            },
                            ...(target.patched ? [] : [{
                                k: t("أنماط المُرقِّع", "Patcher patterns"),
                                v: target.patchable == null ? t("تُفحص عند التفعيل", "Checked when you enable")
                                    : refusal == null ? t(`تطابق — ${target.patchable.audioOk} من ${target.patchable.audioTotal} رقعة صوت`, `Match — ${target.patchable.audioOk} of ${target.patchable.audioTotal} audio patches`)
                                        : t(`لا تطابق (${target.patchable.audioOk} من ${target.patchable.audioTotal})`, `Don't match (${target.patchable.audioOk} of ${target.patchable.audioTotal})`)
                            }]),
                            { k: t("نسخة أصلية محفوظة", "Original backed up"), v: target.hasBackup ? t("نعم", "Yes") : t("لا", "No") }
                        ]} />
                        {refusal != null && !target.patched && <NoticeStrip tone="danger">{explain(refusal)}</NoticeStrip>}
                        <div style={{ display: "flex", gap: UNIT, flexWrap: "wrap", marginTop: UNIT * 1.5 }}>
                            <Btn tone="accent" label={busy === `apply-${target.key}` ? t("جارٍ…", "Working…") : t("تفعيل", "Enable")}
                                disabled={busy !== null || pending || target.patched || refusal != null}
                                onClick={() => confirm(
                                    t(`تفعيل الستيريو الدائم على ${target.label}`, `Enable permanent stereo on ${target.label}`),
                                    t("ستُحفظ نسخة من ملفّك الأصليّ، ثم تُرقَّع نسخةٌ منه، ثم يُبدَّل حين يُغلَق ديسكورد ويُعاد فتحه تلقائياً.",
                                        "A copy of your original file is saved, a copy of it is patched, and it is swapped in once Discord closes — then Discord reopens by itself."),
                                    () => void run(`apply-${target.key}`, async () => {
                                        await native.stereoApply(target.key, false);
                                        setScheduled("patch");
                                    })
                                )} />
                            <Btn tone="danger" label={busy === `revert-${target.key}` ? t("جارٍ…", "Working…") : t("إزالة واستعادة الأصل", "Remove and restore original")}
                                disabled={busy !== null || pending || !target.hasBackup || !target.patched}
                                onClick={() => confirm(
                                    t("إزالة الستيريو الدائم", "Remove permanent stereo"),
                                    t("ستُعاد نسختك الأصليّة حين يُغلَق ديسكورد ويُعاد فتحه، ثم يُمحى كلّ ما أنشأته هذه الميزة على جهازك.",
                                        "Your original is restored once Discord closes and reopens, then everything this feature created on your machine is deleted."),
                                    () => void run(`revert-${target.key}`, async () => {
                                        await native.stereoRevert(target.key, false);
                                        setScheduled("revert");
                                    })
                                )} />
                        </div>
                    </div>
                );
            })}

            {pending && (
                <NoticeStrip>
                    {scheduled === "revert"
                        ? t("جُدوِلت الإزالة — تتمّ حين يُغلَق ديسكورد، ثم يُعاد فتحه تلقائياً.", "Removal is scheduled — it completes once Discord closes, then Discord reopens by itself.")
                        : scheduled === "patch"
                            ? t("جُدوِل التفعيل — يتمّ حين يُغلَق ديسكورد، ثم يُعاد فتحه تلقائياً.", "Enabling is scheduled — it completes once Discord closes, then Discord reopens by itself.")
                            : t("تبديلٌ مُجدوَل ينتظر إغلاق ديسكورد.", "A scheduled swap is waiting for Discord to close.")}
                    {/* لا يظهر الزرّ إلّا إن كان العامل ينتظر خروجَ هذا العميل بالذات — فلا يُغلَق عميلٌ لا ينتظره أحد. */}
                    {canRestart && (
                        <div style={{ marginTop: UNIT }}>
                            <Btn tone="accent" label={t("أعد تشغيل ديسكورد الآن", "Restart Discord now")} disabled={busy !== null}
                                onClick={() => void run("restart", () => native.stereoRestartDiscord())} />
                        </div>
                    )}
                    {!canRestart && sweep?.pending === true && (
                        <div style={{ marginTop: UNIT, fontSize: 12, opacity: 0.7 }}>
                            {t("أغلِق ديسكورد الذي يجري عليه التبديل ليتمّ.", "Close the Discord the swap is for to let it finish.")}
                        </div>
                    )}
                </NoticeStrip>
            )}
        </Card>
    );
}
