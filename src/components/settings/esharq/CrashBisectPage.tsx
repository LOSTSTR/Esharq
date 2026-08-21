/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./crashBisect.css";

import { isPluginEnabled } from "@api/PluginManager";
import { t } from "@utils/esharqI18n";
import { relaunch } from "@utils/native";
import { Alerts, useMemo, useState } from "@webpack/common";

import Plugins from "~plugins";

import { Card, NoticeStrip, StatRow } from "./Card";
import { stagger } from "./motion";

/**
 * **تنصيف الانهيار** — تجد الإضافة المُعطِّلة بنصف التجارب في كل جولة.
 *
 * بدل تعطيل الإضافات واحدةً واحدةً (مئة إعادة تشغيل لمئة إضافة)، يُعطَّل
 * **النصف** في كل جولة فيُقسَم الاحتمال نصفين: مئة إضافة تحتاج سبع جولات لا
 * مئة.
 *
 * 🔴 **ولا تُلمَس إعداداتك المحفوظة.** الجلسة في ملفّ مستقلّ، والإخفاء طبقة
 * فوق الإعدادات لا كتابة فيها. فإن انهار العميل في المنتصف أو أغلقتَه أو
 * نسيتَ — إعداداتك كما تركتها، ويكفي زرّ إلغاء واحد.
 */

interface Session {
    candidates: string[];
    disabled: string[];
    round: number;
    startedWith: number;
    startedAt: string;
}

const native = () => (window as any).VencordNative?.bisect;

/** كم جولةً بقيت على الأكثر — لوغاريتم ثنائيّ لعدد المرشّحين. */
function roundsLeft(n: number): number {
    return n <= 1 ? 0 : Math.ceil(Math.log2(n));
}

export function CrashBisectPage() {
    const [session, setSession] = useState<Session | null>(() => {
        try { return native()?.get?.() ?? null; } catch { return null; }
    });
    const [culprit, setCulprit] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    /** المرشّحون: كل إضافة مُفعَّلة غير مخفيّة الآن بالتنصيف نفسه. */
    const candidates = useMemo(
        () => Object.keys(Plugins).filter(n => isPluginEnabled(n) || session?.disabled.includes(n)).sort(),
        [session]
    );

    if (native() == null) {
        return (
            <NoticeStrip tone="danger">
                {t("تنصيف الانهيار متاح في تطبيق سطح المكتب فقط.", "Crash bisect is available in the desktop app only.")}
            </NoticeStrip>
        );
    }

    const begin = () => Alerts.show({
        title: t("ابدأ تنصيف الانهيار", "Start crash bisect"),
        body: (
            <p style={{ textAlign: "center", lineHeight: 1.75 }}>
                {t(`سيُعطَّل نصف إضافاتك مؤقّتاً ثم يُعاد تشغيل ديسكورد، وتُسأل: هل ما زال العطب يحدث؟ ويتكرّر هذا حتى تبقى إضافة واحدة — نحو ${roundsLeft(candidates.length)} جولات لـ${candidates.length} إضافة.\n\nولا تُغيَّر إعداداتك المحفوظة في أي لحظة.`,
                    `Half your plugins will be temporarily disabled and Discord restarted, then you'll be asked: does the problem still happen? This repeats until one plugin remains — about ${roundsLeft(candidates.length)} rounds for ${candidates.length} plugins.\n\nYour saved settings are never changed at any point.`)}
            </p>
        ),
        confirmText: t("ابدأ وأعد التشغيل", "Start and restart"),
        cancelText: t("إلغاء", "Cancel"),
        onConfirm: async () => {
            setBusy(true);
            await native().start(candidates);
            relaunch();
        }
    });

    const respond = async (stillHappens: boolean) => {
        setBusy(true);
        const result = await native().answer(stillHappens);
        if (result && "done" in result) {
            setSession(null);
            setCulprit(result.culprit);
            setBusy(false);
            return;
        }
        setSession(result);
        relaunch();
    };

    const stop = async () => {
        setBusy(true);
        await native().cancel();
        setSession(null);
        setCulprit(null);
        setBusy(false);
        Alerts.show({
            title: t("أُلغي التنصيف", "Bisect cancelled"),
            body: <p style={{ textAlign: "center", lineHeight: 1.7 }}>
                {t("أعد تشغيل ديسكورد لتعود كل إضافاتك. ولم يُغيَّر أي إعداد محفوظ.",
                    "Restart Discord and all your plugins come back. No saved setting was changed.")}
            </p>,
            confirmText: t("أعد التشغيل الآن", "Restart now"),
            cancelText: t("لاحقاً", "Later"),
            onConfirm: () => relaunch()
        });
    };

    return (
        <>
            <NoticeStrip>
                {t("ينهار العميل أو يتعطّل شيء ولا تعرف أي إضافة السبب؟ هذه الصفحة تجدها بأقلّ عدد من إعادات التشغيل.",
                    "Client crashing or something broken and you don't know which plugin causes it? This page finds it in the fewest restarts.")}
            </NoticeStrip>

            {culprit !== null && (
                <Card index={0}
                    title={t("وُجدت", "Found it")}
                    subtitle={t("هذه الإضافة الوحيدة الباقية بعد التنصيف.", "This is the only plugin left after the bisect.")}
                    badge={t("انتهى", "Done")} badgeTone="ok">
                    <div className="esharq-cb-culprit">{culprit}</div>
                    <NoticeStrip>
                        {t("عطّلها من صفحة الإضافات وجرّب. وإن لم يكن العطب منها فربّما كان من تركيبة إضافتين معاً — والتنصيف يجد واحدة لا تركيبة.",
                            "Disable it from the Plugins page and try. If it turns out not to be the cause, the problem may come from two plugins together — a bisect finds one plugin, not a combination.")}
                    </NoticeStrip>
                    <NoticeStrip>
                        {t("أعد تشغيل ديسكورد لتعود بقيّة إضافاتك. ولم يُغيَّر أي إعداد محفوظ طوال البحث.",
                            "Restart Discord to bring the rest of your plugins back. No saved setting was changed throughout.")}
                    </NoticeStrip>
                    <button type="button" className="esharq-cb-btn accent" onClick={() => relaunch()}>
                        {t("أعد التشغيل", "Restart")}
                    </button>
                </Card>
            )}

            {session !== null ? (
                <Card index={1}
                    title={t(`الجولة ${session.round}`, `Round ${session.round}`)}
                    subtitle={t("جرّب العميل الآن، ثم أجب: هل ما زال العطب يحدث؟",
                        "Try the client now, then answer: does the problem still happen?")}
                    badge={t(`${session.candidates.length} مرشّحاً`, `${session.candidates.length} candidates`)}
                    badgeTone="warn">

                    <StatRow items={[
                        { label: t("بدأنا بـ", "Started with"), value: String(session.startedWith) },
                        { label: t("بقي من المرشّحين", "Candidates left"), value: String(session.candidates.length) },
                        { label: t("مُعطَّلة الآن", "Disabled now"), value: String(session.disabled.length) },
                        { label: t("جولات متبقّية", "Rounds left"), value: `~${roundsLeft(session.candidates.length)}` }
                    ]} />

                    <div className="esharq-cb-ask">
                        {t("هل ما زال العطب يحدث في هذه الجولة؟", "Does the problem still happen in this round?")}
                    </div>

                    <div className="esharq-cb-answers">
                        <button type="button" className="esharq-cb-btn danger" disabled={busy} onClick={() => respond(true)}>
                            {t("نعم، ما زال", "Yes, still")}
                        </button>
                        <button type="button" className="esharq-cb-btn ok" disabled={busy} onClick={() => respond(false)}>
                            {t("لا، اختفى", "No, it's gone")}
                        </button>
                    </div>

                    <NoticeStrip>
                        {t("«نعم» تعني أن الجاني بين الإضافات التي ما زالت تعمل. و«لا» تعني أنه بين المُعطَّلة. وفي الحالتين يُقسَم الباقي نصفين ويُعاد التشغيل.",
                            "“Yes” means the culprit is among the plugins still running. “No” means it is among the disabled ones. Either way the remainder is halved and the client restarts.")}
                    </NoticeStrip>

                    <details className="esharq-cb-details">
                        <summary>{t(`المُعطَّلة في هذه الجولة (${session.disabled.length})`, `Disabled this round (${session.disabled.length})`)}</summary>
                        <div className="esharq-cb-chips">
                            {session.disabled.map((n, i) => (
                                <span key={n} className="esharq-cb-chip esharq-rise" style={stagger(i, 12)}>{n}</span>
                            ))}
                        </div>
                    </details>

                    <button type="button" className="esharq-cb-btn" disabled={busy} onClick={stop}>
                        {t("ألغِ التنصيف وأعد كل شيء", "Cancel the bisect and restore everything")}
                    </button>
                </Card>
            ) : culprit === null && (
                <Card index={1}
                    title={t("ابدأ البحث", "Start the search")}
                    subtitle={t("يُعطَّل النصف في كل جولة، فينكمش الاحتمال إلى النصف مع كل إعادة تشغيل.",
                        "Half are disabled each round, so the possibilities halve with every restart.")}
                    badge={t(`${candidates.length} إضافة`, `${candidates.length} plugins`)}
                    badgeTone="info">

                    <StatRow items={[
                        { label: t("إضافات مُفعَّلة", "Enabled plugins"), value: String(candidates.length) },
                        { label: t("إعادات تشغيل متوقّعة", "Expected restarts"), value: `~${roundsLeft(candidates.length)}` },
                        { label: t("لو جرّبتها واحدةً واحدة", "One at a time would be"), value: `~${candidates.length}` },
                        { label: t("إعداداتك المحفوظة", "Your saved settings"), value: t("لا تُمَسّ", "Untouched") }
                    ]} />

                    <button type="button" className="esharq-cb-btn accent" disabled={busy || candidates.length < 2} onClick={begin}>
                        {t("ابدأ تنصيف الانهيار", "Start crash bisect")}
                    </button>

                    {candidates.length < 2 && (
                        <NoticeStrip>{t("تحتاج إضافتين مُفعَّلتين على الأقلّ ليكون هناك ما يُنصَّف.", "You need at least two enabled plugins for there to be anything to bisect.")}</NoticeStrip>
                    )}
                </Card>
            )}

            <Card index={2}
                title={t("كيف يعمل، وما حدوده", "How it works, and its limits")}
                subtitle={t("اقرأها قبل أن تبدأ حتى تعرف ما تُعطيك وما لا تُعطيك.",
                    "Read this before starting, so you know what it gives you and what it doesn't.")}>
                <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                    <div>{t("① يُعطَّل نصف المرشّحين ويُعاد التشغيل. جوابك يحذف نصف الاحتمالات، فينتهي البحث في جولات قليلة.",
                        "① Half the candidates are disabled and the client restarts. Your answer removes half the possibilities, so it ends in few rounds.")}</div>
                    <div>{t("② التعطيل مؤقّت في ملفّ مستقلّ. إعداداتك المحفوظة لا تُقرأ ولا تُكتب — انقطع البحث أو تمّ، تعود كما هي.",
                        "② The disabling is temporary and lives in a separate file. Your saved settings are neither read nor written — whether the search finishes or is interrupted, they come back as they were.")}</div>
                    <div>{t("③ حتى الإضافات الضرورية تدخل البحث: قد تكون هي الجانية، واستثناؤها يجعل البحث عاجزاً عن إيجادها.",
                        "③ Even required plugins take part: one of them may be the culprit, and excluding them would make the search unable to find it.")}</div>
                    <div>{t("④ يجد إضافةً واحدة. فإن كان العطب من تركيبة إضافتين معاً فقد يُشير إلى إحداهما — وهذا حدٌّ في الطريقة نفسها لا في تنفيذها.",
                        "④ It finds one plugin. If the problem comes from two plugins together it may point at one of them — that is a limit of the method itself, not of this implementation.")}</div>
                    <div>{t("⑤ وإن كان العطب متقطّعاً فقد يُضلّلك: أجب «لا» فقط حين تتأكّد أنه اختفى.",
                        "⑤ If the problem is intermittent it can mislead you: answer “no” only when you are sure it is gone.")}</div>
                </div>
            </Card>
        </>
    );
}
