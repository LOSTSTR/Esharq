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
 * **الأدوات الخارجية** — برامج ليست من إشراق، ولا تُشحن معه، ولا يُنزَّل منها
 * شيء عند تثبيته. لا يبدأ أي تنزيل إلّا بضغطة زرّ صريحة بعد تحذير مكتوب،
 * والقرار للمستخدم وحده.
 *
 * وتبقى الأداة **كما يشحنها صاحبها** — لا نُعدّلها ولا نُعيد كتابتها؛ وما
 * نُضيفه هو التثبيت على التزام بعينه والتحقّق بـ SHA-256 قبل أي استعمال،
 * وهو ما تفتقده الأداة الأصلية.
 */

interface ToolsStatus {
    stereoHub: { installed: boolean; path: string; python: string | null; };
    vcClient: { installed: boolean; path: string | null; };
}

interface StereoTarget {
    key: string;
    label: string;
    build: string;
    voiceDir: string;
    patched: boolean;
    hasBackup: boolean;
}

const AI_HUB_INVITE = "https://discord.gg/ai-hub-1159260121998827560";
const AI_HUB_CHANNEL = "https://discord.com/channels/1159260121998827560/1175430844685484042";
const STEREO_HUB_REPO = "https://github.com/ProdHallow/Discord-Stereo-Windows-MacOS-Linux";
const VCCLIENT_REPO = "https://github.com/w-okada/voice-changer";
const VCCLIENT_DOWNLOAD = "https://huggingface.co/wok000/vcclient000/tree/main";
const PYTHON_DOWNLOAD = "https://www.python.org/downloads/";

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

function Row({ children }: { children: React.ReactNode; }) {
    return <div style={{ display: "flex", gap: UNIT, flexWrap: "wrap", marginTop: UNIT * 1.5 }}>{children}</div>;
}

/** سطر مصدر: اسم ورابط — كي يقرأ من أراد المصدر قبل أن يُثبّت. */
function Source({ label, url, open }: { label: string; url: string; open: (u: string) => void; }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", gap: UNIT, fontSize: 12, padding: `${UNIT / 2}px 0` }}>
            <span style={{ opacity: 0.55 }}>{label}</span>
            <a onClick={() => open(url)} style={{ color: ACCENT, cursor: "pointer", wordBreak: "break-all" }}>{url}</a>
        </div>
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

export function VoiceLabTools({ index, patchedClients, onChanged }: {
    index: number;
    /** كم عميل ديسكورد وحدتُه الصوتية مُرقَّعة على القرص الآن. */
    patchedClients: number;
    onChanged: () => void;
}) {
    const [status, setStatus] = useState<ToolsStatus | null>(null);
    const [targets, setTargets] = useState<StereoTarget[]>([]);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    const refresh = () => {
        MicProNative?.toolsStatus().then(setStatus).catch(() => setStatus(null));
        MicProNative?.stereoStatus().then(r => setTargets(r.targets)).catch(() => setTargets([]));
        onChanged();
    };
    useEffect(refresh, []);

    // الجسر يُلتقط في متغيّر محلّي: هو `null` على الويب، وبعد هذا الحارس يصير
    // النوع مضموناً داخل كل الإغلاقات أدناه بلا تأكيدات.
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

    const open = (url: string) => { void native.openUrl(url); };

    return (
        <>
            <Card index={index}
                title={t("أدوات خارجية", "External tools")}
                subtitle={t("برامج ليست من إشراق. لا يُنزَّل منها شيء إلّا إن ضغطتَ «تثبيت» بنفسك.",
                    "Programs that are not part of Esharq. Nothing is downloaded unless you press Install yourself.")}
                badge={t("اختياري", "Optional")} badgeTone="warn">
                <NoticeStrip>
                    {t("إشراق لا يحزم هذه الأدوات ولا يُنزّلها عند تثبيته. وهي تبقى كما يشحنها أصحابها — والمصادر مكتوبة في كل بطاقة لمن أراد قراءتها قبل التثبيت.",
                        "Esharq neither bundles these tools nor downloads them at install time. They stay exactly as their authors ship them, and each card lists its sources so you can read them first.")}
                </NoticeStrip>
                {error !== null && <NoticeStrip tone="danger">{error}</NoticeStrip>}
            </Card>

            {/* ── الستيريو المدمج في إشراق ──────────────────────────────────── */}
            <Card index={index + 1}
                title={t("ستيريو بلا مرشّحات — مدمج في إشراق", "Filterless stereo — built into Esharq")}
                subtitle={t("يستبدل وحدة صوت ديسكورد بنسخة مُرقَّعة تُطفئ المرشّحات وترفع معدّل البتّ. بلا بايثون وبلا برنامج خارجي.",
                    "Swaps Discord's voice module for a patched build with the filters off and a higher bitrate. No Python, no external program.")}
                badge={targets.some(target => target.patched) ? t("مُطبَّق", "Applied") : t("غير مُطبَّق", "Not applied")}
                badgeTone={targets.some(target => target.patched) ? "ok" : "info"}>

                <NoticeStrip>
                    {t("ديسكورد يُبقي ملفّ الصوت مفتوحاً ما دام يعمل، فالتبديل يجري بعد إغلاقه: يُجدوَل عاملٌ صغير ينتظر خروجه ثم يُبدّل ويُعيد فتحه ويمحو مهمّته بنفسه. بلا صلاحيات مدير وبلا إنهاء قسريّ لديسكورد.",
                        "Discord keeps its voice module open while it runs, so the swap happens after it closes: a small scheduled worker waits for it to exit, swaps the files, reopens it and deletes its own task. No admin rights, and Discord is never force-killed.")}
                </NoticeStrip>

                <NoticeStrip tone="danger">
                    <b>{t("اقرأ قبل التطبيق:", "Read before applying:")}</b>
                    <ul style={{ margin: `${UNIT}px 0 0`, paddingInlineStart: UNIT * 2.5 }}>
                        <li>{t("الوحدة المُرقَّعة مبنية على بناء ديسكورد 1.0.9243 (يوليو 2026). فإن كان بناؤك أحدث، هذا رجوعٌ بوحدة الصوت إلى الوراء.",
                            "The patched module is built on Discord 1.0.9243 (July 2026). If your build is newer, this steps your voice module backwards.")}</li>
                        <li>{t("توقيع ديسكورد الرقمي يسقط عن الملفّ المُرقَّع — قد تعترضه مضادّات الفيروسات، وقد يستعيده تحديث ديسكورد القادم.",
                            "Discord's digital signature no longer matches the patched file — antivirus may flag it, and Discord's next update may restore the original.")}</li>
                        <li>{t("تعديل ملفّات ديسكورد مخالفٌ لشروطه. نُبقي نسخةً أصلية دائمة وزرَّ رجوع، لكن القرار قرارك.",
                            "Modifying Discord's files is against its terms. We keep a permanent original backup and a revert button, but the decision is yours.")}</li>
                        <li>{t("كل ملفّ من التسعة يُنزَّل من التزام مُجمَّد ويُتحقَّق من بصمته (SHA-256) وحجمه قبل نسخ بايت واحد.",
                            "All nine files come from a frozen commit and are SHA-256 and size verified before a single byte is copied.")}</li>
                    </ul>
                </NoticeStrip>

                {targets.length === 0 ? (
                    <NoticeStrip>{t("لم أجد تثبيت ديسكورد على هذا الجهاز.", "No Discord install was found on this machine.")}</NoticeStrip>
                ) : targets.map(target => (
                    <div key={target.key} style={{ marginTop: UNIT * 2 }}>
                        <Detail items={[
                            { k: t("العميل", "Client"), v: `${target.label} · ${target.build}` },
                            { k: t("الحالة", "State"), v: target.patched ? t("مُرقَّع", "Patched") : t("أصليّ", "Original") },
                            { k: t("نسخة أصلية محفوظة", "Original backed up"), v: target.hasBackup ? t("نعم", "Yes") : t("لا", "No") }
                        ]} />
                        <Row>
                            <Btn tone="accent" label={busy === `apply-${target.key}` ? t("جارٍ…", "Working…") : t("طبّق الستيريو", "Apply stereo")}
                                disabled={busy !== null || target.patched}
                                onClick={() => confirm(
                                    t(`تطبيق الستيريو على ${target.label}`, `Apply stereo to ${target.label}`),
                                    t("ستُنزَّل 25 ميغابايت وتُتحقَّق بصماتها، ثم تُحفظ نسختك الأصلية، ثم يُغلَق ديسكورد ويُبدَّل الملفّ ويُعاد فتحه. أغلِق ديسكورد بنفسك بعد الضغط ليتمّ التبديل.",
                                        "25 MB will be downloaded and hash-verified, your original will be backed up, then Discord closes, the files are swapped and it reopens. Close Discord yourself after pressing so the swap can complete."),
                                    () => void run(`apply-${target.key}`, async () => {
                                        await native.stereoApply(target.key, false);
                                        setDone(t("جُدوِل التبديل — أغلِق ديسكورد ليتمّ.", "The swap is scheduled — close Discord to let it finish."));
                                    })
                                )} />
                            <Btn label={t("رجوع إلى الأصل", "Restore original")} tone="danger"
                                disabled={busy !== null || !target.hasBackup}
                                onClick={() => confirm(
                                    t("الرجوع إلى وحدة الصوت الأصلية", "Restore the original voice module"),
                                    t("ستُعاد نسختك الأصلية المحفوظة. أغلِق ديسكورد بعد الضغط ليتمّ التبديل.",
                                        "Your saved original will be restored. Close Discord after pressing so the swap can complete."),
                                    () => void run(`revert-${target.key}`, async () => {
                                        await native.stereoRevert(target.key, false);
                                        setDone(t("جُدوِل الرجوع — أغلِق ديسكورد ليتمّ.", "The restore is scheduled — close Discord to let it finish."));
                                    })
                                )} />
                        </Row>
                    </div>
                ))}

                {done !== null && <NoticeStrip>{done}</NoticeStrip>}
            </Card>

            {/* ── الأداة الخارجية Stereo Hub ────────────────────────────────── */}
            <Card index={index + 2}
                title={t("الأداة الخارجية Stereo Hub", "Stereo Hub (external tool)")}
                subtitle={t("الأداة الأصلية التي أخذنا عنها الطريقة — للمقارنة أو إن أردت واجهتها هي. لا تحتاجها إن استعملت الستيريو المدمج أعلاه.",
                    "The original tool our method is taken from — for comparison, or if you prefer its own interface. You do not need it if you use the built-in stereo above.")}
                badge={status?.stereoHub.installed === true ? t("مثبَّتة", "Installed") : t("غير مثبَّتة", "Not installed")}
                badgeTone={status?.stereoHub.installed === true ? "ok" : "danger"}>

                {status?.stereoHub.installed !== true ? (
                    <>
                        <NoticeStrip tone="danger">
                            <b>{t("اقرأ قبل التثبيت:", "Read before installing:")}</b>
                            <ul style={{ margin: `${UNIT}px 0 0`, paddingInlineStart: UNIT * 2.5 }}>
                                <li>{t("تستبدل ملفّ صوت ديسكورد عندك بنسخة جاهزة من بناء 1.0.9243 (يوليو 2026) — أي قد تكون أقدم من بنائك الحالي.",
                                    "It replaces your Discord voice module with a prebuilt copy from build 1.0.9243 (July 2026) — likely older than the one you run.")}</li>
                                <li>{t("الأداة الأصلية لا تتحقّق من بصمة ما تُنزّله. نسخة إشراق تُنزّلها من التزام مُجمَّد وتتحقّق من بايتاتها قبل أي استعمال.",
                                    "The original tool verifies no hashes. Esharq downloads it from a frozen commit and verifies its bytes before any use.")}</li>
                                <li>{t("تحتاج Python 3.8 أو أحدث لتشغيلها، وتحفظ نسخة احتياطية من ملفّك الأصلي وفيها زرّ رجوع.",
                                    "It needs Python 3.8+ to run, keeps a backup of your original module, and has a Revert button.")}</li>
                                <li>{t("لا تُستعمل مع الستيريو المدمج أعلاه في الوقت نفسه — كلاهما يستهدف الملفّ نفسه، فاختر واحداً.",
                                    "Do not use it together with the built-in stereo above — both target the same module, so pick one.")}</li>
                            </ul>
                        </NoticeStrip>

                        <Source label={t("المستودع", "Repository")} url={STEREO_HUB_REPO} open={open} />

                        <Row>
                            <Btn tone="accent" label={busy === "hub" ? t("جارٍ التنزيل…", "Downloading…") : t("تثبيت", "Install")}
                                disabled={busy !== null}
                                onClick={() => confirm(
                                    t("تثبيت Stereo Hub", "Install Stereo Hub"),
                                    t("سيُنزَّل ملفّ الأداة (66 كيلوبايت) من المستودع ويُتحقَّق من بصمته. لا يُعدَّل شيء في ديسكورد إلّا حين تُشغّل الأداة وتضغط الترقيع بنفسك.",
                                        "The tool's file (66 KB) will be downloaded and hash-verified. Nothing in Discord changes until you run it and press its own Patch button."),
                                    () => void run("hub", () => native.installStereoHub())
                                )} />
                            <Btn label={t("افتح المستودع", "Open repository")} onClick={() => open(STEREO_HUB_REPO)} />
                        </Row>
                    </>
                ) : (
                    <>
                        {status.stereoHub.python === null && (
                            <NoticeStrip tone="danger">
                                {t("لم أجد Python على جهازك، والأداة لا تعمل بدونه. ثبّته ثم عُد إلى هنا.",
                                    "No Python was found on your machine and the tool cannot run without it. Install it, then come back.")}
                                <div style={{ marginTop: UNIT }}>
                                    <Btn label={t("صفحة تنزيل Python", "Python download page")} onClick={() => open(PYTHON_DOWNLOAD)} />
                                </div>
                            </NoticeStrip>
                        )}

                        <Detail items={[
                            { k: t("الحالة", "State"), v: patchedClients > 0 ? t(`ديسكورد مُرقَّع (${patchedClients})`, `Discord patched (${patchedClients})`) : t("ديسكورد غير مُرقَّع", "Discord not patched") },
                            { k: "Python", v: status.stereoHub.python ?? t("غير موجود", "not found") },
                            { k: t("المسار", "Path"), v: status.stereoHub.path }
                        ]} />

                        {patchedClients > 0 && (
                            <NoticeStrip>
                                {t("وحدة صوت ديسكورد مُرقَّعة على القرص الآن، فستيريو MicPro مُعطَّل تلقائياً لأنه يُرقّع الوحدة نفسها في الذاكرة. للرجوع: افتح الأداة واضغط «Revert».",
                                    "Discord's voice module is patched on disk, so MicPro's stereo is disabled automatically — it patches the same module in memory. To undo: open the tool and press Revert.")}
                            </NoticeStrip>
                        )}

                        <Row>
                            <Btn tone="accent" label={t("فتح الأداة", "Open the tool")}
                                disabled={busy !== null || status.stereoHub.python === null}
                                onClick={() => void run("open-hub", () => native.openStereoHub())} />
                            <Btn label={t("افتح المستودع", "Open repository")} onClick={() => open(STEREO_HUB_REPO)} />
                            <Btn tone="danger" label={t("إزالة", "Remove")} disabled={busy !== null}
                                onClick={() => confirm(
                                    t("إزالة Stereo Hub", "Remove Stereo Hub"),
                                    t("سيُحذف ملفّ الأداة من جهازك. وإن كنتَ رقّعت ديسكورد بها فالترقيع يبقى — أرجِعه من داخل الأداة قبل إزالتها.",
                                        "The tool's file will be deleted. If you already patched Discord with it, the patch stays — revert it from inside the tool first."),
                                    () => void run("rm-hub", () => native.removeStereoHub())
                                )} />
                        </Row>
                    </>
                )}
            </Card>

            {/* ── مغيّر الصوت VCClient ──────────────────────────────────────── */}
            <Card index={index + 3}
                title={t("مغيّر الصوت VCClient", "VCClient voice changer")}
                subtitle={t("برنامج مستقلّ يُحوّل صوتك آنيّاً بنماذج ذكاء اصطناعي، ويُدخله ديسكورد عبر جهاز صوت افتراضي.",
                    "A standalone program that converts your voice in real time with AI models; Discord receives it through a virtual audio device.")}
                badge={status?.vcClient.installed === true ? t("مثبَّت", "Installed") : t("غير مثبَّت", "Not installed")}
                badgeTone={status?.vcClient.installed === true ? "ok" : "danger"}>

                <NoticeStrip>
                    {t("لماذا برنامج خارجي؟ ديسكورد يلتقط الميكروفون في وحدته الأصلية، ولا تملك أي إضافة باباً تُسلّمه صوتاً مُعالَجاً. فكل مغيّرات الصوت الحيّة — بلا استثناء — تمرّ عبر جهاز صوت افتراضي.",
                        "Why an external program? Discord captures the microphone in its own native module, and no client mod has a door to hand it processed audio. Every live voice changer — without exception — routes through a virtual audio device.")}
                </NoticeStrip>

                {status?.vcClient.installed !== true ? (
                    <>
                        <NoticeStrip tone="danger">
                            <b>{t("اقرأ قبل التثبيت:", "Read before installing:")}</b>
                            <ul style={{ margin: `${UNIT}px 0 0`, paddingInlineStart: UNIT * 2.5 }}>
                                <li>{t("حجمه بالغيغابايتات ويُوزَّع على Hugging Face، ولذلك يُنزّله المستخدم بنفسه من صفحته الرسمية — لا نُنزّله نحن ولا نُشغّل مُثبِّتاً بالنيابة عنك.",
                                    "It is gigabytes in size and distributed on Hugging Face, so you download it yourself from its official page — we neither download it nor run an installer on your behalf.")}</li>
                                <li>{t("يحتاج أيضاً جهاز صوت افتراضياً (مثل VB-Cable) ليصل صوته المُحوَّل إلى ديسكورد، وتثبيت مشغّله يطلب موافقة ويندوز.",
                                    "It also needs a virtual audio device (such as VB-Cable) to get its converted audio into Discord; installing that driver asks for Windows' own approval.")}</li>
                                <li>{t("🔴 ملفّات النماذج بصيغة .pth تُنفّذ كوداً عند تحميلها. لا تُحمّل نموذجاً من مصدر لا تثق به.",
                                    "🔴 Model files in .pth format execute code when loaded. Never load a model from a source you do not trust.")}</li>
                                <li>{t("دقّقتُ مصدره: لا تتبّع ولا تسريب، وخادمه المحلّي يرتبط بـ 127.0.0.1 وحده.",
                                    "I audited its source: no telemetry and no data exfiltration; its local server binds to 127.0.0.1 only.")}</li>
                            </ul>
                        </NoticeStrip>

                        <Source label={t("المستودع", "Repository")} url={VCCLIENT_REPO} open={open} />
                        <Source label={t("صفحة التنزيل", "Download page")} url={VCCLIENT_DOWNLOAD} open={open} />

                        <Row>
                            <Btn tone="accent" label={t("افتح صفحة التنزيل", "Open the download page")} onClick={() => open(VCCLIENT_DOWNLOAD)} />
                            <Btn label={t("حدّدتُه على جهازي", "I installed it — locate it")} disabled={busy !== null}
                                onClick={() => void run("locate", () => native.locateVcClient())} />
                        </Row>
                    </>
                ) : (
                    <>
                        <Detail items={[{ k: t("المسار", "Path"), v: status.vcClient.path ?? "" }]} />
                        <NoticeStrip>
                            {t("بعد تشغيله: اجعل مخرجه هو الكابل الافتراضي، ثم اختر الكابل نفسه «جهاز الإدخال» في بطاقة الأجهزة أعلاه.",
                                "After launching it: set its output to the virtual cable, then pick that same cable as the Input device in the Devices card above.")}
                        </NoticeStrip>
                        <Row>
                            <Btn tone="accent" label={t("فتح البرنامج", "Open the program")} disabled={busy !== null}
                                onClick={() => void run("open-vc", () => native.openVcClient())} />
                            <Btn label={t("افتح المستودع", "Open repository")} onClick={() => open(VCCLIENT_REPO)} />
                            <Btn tone="danger" label={t("إزالة الاختصار", "Forget the shortcut")} disabled={busy !== null}
                                onClick={() => void run("forget", () => native.forgetVcClient())} />
                        </Row>
                    </>
                )}
            </Card>

            {/* ── من أين تأتي الأصوات ───────────────────────────────────────── */}
            <Card index={index + 4}
                title={t("من أين تُنزّل الأصوات؟", "Where do the voices come from?")}
                subtitle={t("نماذج الأصوات لا تأتي مع البرنامج — تُنزَّل من مجتمعات تصنعها وتنشرها.",
                    "Voice models don't ship with the program — they come from communities that build and publish them.")}>
                <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                    <div>{t("① انضمّ إلى خادم AI HUB.", "① Join the AI HUB server.")}</div>
                    <div>{t("② ادخل قسم نماذج الأصوات فيه واختر ما تريد.", "② Open its voice-models channel and pick what you want.")}</div>
                    <div>{t("③ حمّل ملفّي النموذج (‎.pth‎ و‎.index‎) وأضفهما في VCClient.", "③ Download the model's two files (.pth and .index) and add them in VCClient.")}</div>
                </div>

                <div style={{ marginTop: UNIT * 1.5 }}>
                    <Source label={t("الخادم", "Server")} url={AI_HUB_INVITE} open={open} />
                    <Source label={t("قسم النماذج", "Models channel")} url={AI_HUB_CHANNEL} open={open} />
                </div>

                <NoticeStrip tone="danger">
                    {t("🔴 ملفّ ‎.pth‎ صيغةُ pickle تُنفّذ كوداً لحظة تحميلها. لا تأخذ نموذجاً إلّا من قناة موثوقة، ولا تفتح ملفّاً وصلك في رسالة خاصّة.",
                        "🔴 A .pth file is a pickle: it can execute code the moment it loads. Only take models from a trusted channel, and never open one sent to you in a DM.")}
                </NoticeStrip>

                <Row>
                    <Btn tone="accent" label={t("انضمّ إلى AI HUB", "Join AI HUB")} onClick={() => open(AI_HUB_INVITE)} />
                    <Btn label={t("افتح قسم النماذج", "Open the models channel")} onClick={() => open(AI_HUB_CHANNEL)} />
                </Row>
            </Card>
        </>
    );
}
