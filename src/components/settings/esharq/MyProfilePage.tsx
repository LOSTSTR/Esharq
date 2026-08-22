/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./myProfile.css";

import { _getBadges } from "@api/Badges";
import ErrorBoundary from "@components/ErrorBoundary";
import { Switch } from "@components/Switch";
import { getSelfServeBadges } from "@plugins/_api/badges";
import {
    type BadgeKind, fetchRemote, hasLink, isHiddenLocally, onLinkChange,
    type RemoteState, setHiddenLocally, setRemote
} from "@plugins/_api/badges/control";
import { t } from "@utils/esharqI18n";
import { useEffect, useMemo, UserStore, useState } from "@webpack/common";

import { Card, NoticeStrip } from "./Card";
import { stagger } from "./motion";

/**
 * **ملفّك الشخصيّ** — من أنت في إشراق، وأين تظهر شارتك.
 *
 * ## 🔴 التحكّم عامّ لا محلّيّ
 *
 * أوّل نسخة جعلت المفتاح يُخفي الشارة **على جهاز صاحبها وحده**. ورفضه المالك
 * بحقّ: مفتاحٌ يوهم الداعم أنه أخفى شارته عن الناس وهو لم يُخفها إلّا عن
 * نفسه **أسوأ من غياب المفتاح**.
 *
 * ⇒ الحالة تُقرأ الآن من **الخادم**: حقل `surfaces` يأتي مع بيانات الشارة في
 * `selfserve.json`، فيراه كل عميل ويحترمه في الملفّ الشخصيّ والمحادثة معاً.
 *
 * ## ولماذا يقع التبديل في الموقع لا هنا
 *
 * تغيير الحالة يحتاج سلطةً: **رابطٌ موقَّع** يُنتجه `/badge` في ديسكورد ويُثبت
 * الهويّة، ثم **يُعاد فحص دور الداعم** عند ديسكورد قبل الكتابة — لأن الرابط
 * يبقى صالحاً مدّته بينما الدور قد يُسحَب داخلها.
 *
 * والعميل لا يملك ذلك الرابط، وإعطاؤه سلطةً خاصّةً به يعني **باباً ثانياً
 * أضعف** إلى نفس البيانات. فالتبديل يُفتح في الموقع، والحالة هنا تُقرأ من
 * الخادم فتصدُق سواء بُدّلت من هنا أو من هناك.
 */

/** صفحة التحكّم — السلطة هناك: رابط موقَّع من `/badge` ثم فحص الدور. */
const BADGE_CONTROL_URL = "https://esharq.org/badge";

interface Badge {
    id?: string;
    description?: string;
    /** الحقل الحقيقيّ في واجهة الشارات. `image` بقيّة من واجهة أقدم. */
    iconSrc?: string;
    image?: string;
    component?: any;
    props?: any;
}

type Surface = "profile" | "chat";

/**
 * أهي شارة من إشراق أم من غيره؟
 *
 * المعرّف أوّلاً: شارات إشراق كلّها `esharq_*`، وهو أوثق من تفتيش النصّ —
 * شارةٌ مكوّنٌ بلا وصف كانت تفلت من الفحص النصّيّ فتغيب عن هذه الصفحة.
 * ويبقى فحص النصّ لما يأتي من بيانات (شارة داعم بنصٍّ يختاره صاحبه).
 */
function isEsharqBadge(badge: Badge): boolean {
    if (badge.id?.startsWith("esharq")) return true;
    const src = `${badge.description ?? ""} ${badge.iconSrc ?? badge.image ?? ""}`.toLowerCase();
    return src.includes("esharq") || src.includes("إشراق");
}

/** الشارات التي لها تحكّم، وأسماؤها كما يراها صاحبها. */
const CONTROLLABLE: { kind: BadgeKind; ar: string; en: string; }[] = [
    { kind: "tier", ar: "شارة رتبتك", en: "Your rank badge" },
    { kind: "user", ar: "شارة مستخدم إشراق", en: "Esharq User badge" },
    { kind: "custom", ar: "شارتك المخصّصة", en: "Your custom badge" },
    { kind: "selfserve", ar: "شارتك الخاصّة", en: "Your own badge" }
];

const SURFACES: { key: Surface; ar: string; en: string; }[] = [
    { key: "profile", ar: "في الملفّ الشخصيّ", en: "On your profile" },
    { key: "chat", ar: "في المحادثة", en: "In chat" }
];

/**
 * بطاقة التحكّم.
 *
 * النطاق خيارٌ صريح لا افتراض: **محليّ** يسري على هذا الجهاز وحده وفوريّ،
 * و**لدى إشراق بالكامل** يُكتب على الخادم فتختفي الشارة عن الناس جميعاً.
 * إخفاءٌ محليّ يتظاهر بأنّه عامّ خداعٌ للمستخدم، ولذلك يُسمّى كلٌّ باسمه.
 *
 * النطاق العامّ يحتاج رابطاً موقَّعاً من `/badge` — الخادم لا يثق بادّعاء
 * العميل، وإلّا غيّر أيّ أحدٍ شارات أيّ أحد.
 */
function BadgeControl({ held }: { held: BadgeKind[]; }) {
    const [scope, setScope] = useState<"local" | "global">("local");
    const [linked, setLinked] = useState(hasLink());
    const [remote, setRemoteState] = useState<RemoteState | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [, force] = useState(0);

    useEffect(() => onLinkChange(() => setLinked(hasLink())), []);

    useEffect(() => {
        if (scope !== "global" || !linked) return;
        let alive = true;
        fetchRemote().then(r => { if (alive) setRemoteState(r); });
        return () => { alive = false; };
    }, [scope, linked]);

    const globalVisible = (kind: BadgeKind, surface: Surface): boolean => {
        if (kind === "selfserve") return remote?.surfaces?.[surface] !== false;
        return remote?.badges?.[kind as "tier" | "user" | "custom"]?.[surface] !== false;
    };

    const flip = async (kind: BadgeKind, surface: Surface, visible: boolean) => {
        setError(null);
        if (scope === "local") {
            setHiddenLocally(kind, surface, !visible);
            force(n => n + 1);
            return;
        }
        // 🔴 لا تفاؤل: لا يُقلب المفتاح قبل جواب الخادم. مفتاحٌ يبدو مُطفأً
        // بينما الخادم رفض يجعل صاحبه يظنّ شارته مخفيّة وهي ظاهرة للجميع.
        const key = `${kind}:${surface}`;
        setBusyKey(key);
        const failure = await setRemote(kind, surface, visible);
        setBusyKey(null);
        if (failure !== null) { setError(failure); return; }
        setRemoteState(await fetchRemote());
    };

    return (
        <>
            <div className="esharq-mp-scope">
                {([
                    { id: "local" as const, ar: "محليّ", en: "This device" },
                    { id: "global" as const, ar: "لدى إشراق بالكامل", en: "All of Esharq" }
                ]).map(option => (
                    <button
                        key={option.id}
                        type="button"
                        className={"esharq-mp-scope-btn" + (scope === option.id ? " on" : "")}
                        onClick={() => setScope(option.id)}
                    >{t(option.ar, option.en)}</button>
                ))}
            </div>

            <div className="esharq-mp-scope-note">
                {scope === "local"
                    ? t("يسري على هذا الجهاز وحده. الآخرون يظلّون يرون شارتك.",
                        "Applies to this device only. Other people still see your badge.")
                    : t("يسري على كلّ مستخدمي إشراق. ما تُخفيه هنا لا يراه أحد.",
                        "Applies to every Esharq user. What you hide here, nobody sees.")}
            </div>

            {scope === "global" && !linked && (
                <NoticeStrip tone="info">
                    {t("اكتب /badge في أيّ قناة بخادم إشراق، وسيلتقط التطبيق إذنك تلقائياً (صالح ١٥ دقيقة).",
                        "Type /badge in any channel in the Esharq server; the app picks up your authorisation automatically (valid 15 minutes).")}
                </NoticeStrip>
            )}

            {error !== null && <NoticeStrip tone="danger">{error}</NoticeStrip>}

            {CONTROLLABLE.filter(b => held.includes(b.kind)).map(badge => (
                <div key={badge.kind} className="esharq-mp-ctl">
                    <div className="esharq-mp-ctl-name">{t(badge.ar, badge.en)}</div>
                    {SURFACES.map(surface => {
                        const key = `${badge.kind}:${surface.key}`;
                        const on = scope === "local"
                            ? !isHiddenLocally(badge.kind, surface.key)
                            : globalVisible(badge.kind, surface.key);
                        const disabled = scope === "global" && (!linked || busyKey !== null);
                        return (
                            <label key={surface.key} className={"esharq-mp-choice" + (on ? " on" : "")}>
                                <span>{t(surface.ar, surface.en)}</span>
                                <input
                                    type="checkbox"
                                    checked={on}
                                    disabled={disabled}
                                    aria-busy={busyKey === key}
                                    onChange={e => flip(badge.kind, surface.key, e.currentTarget.checked)}
                                />
                            </label>
                        );
                    })}
                </div>
            ))}
        </>
    );
}

/**
 * **بطاقة شارتك**: الشارة دائرةً كبيرة في الأعلى، والخيارات تحتها.
 *
 * والترتيب مقصود: يرى صاحبها شارته كما يراها الناس **قبل** أن يقرّر أين تظهر.
 * وصفٌّ أفقيّ صغير لا يُري المرء ما يُقرّر بشأنه.
 */
function BadgeShowcase({ badge, index, busy, onToggle }: {
    badge: { id: string; image: string; tooltip: string; effect: string; surfaces: { profile: boolean; chat: boolean; }; };
    index: number;
    busy: boolean;
    onToggle: (surface: Surface, visible: boolean) => void;
}) {
    const { surfaces } = badge;
    const nowhere = !surfaces.profile && !surfaces.chat;

    const CHOICES = [
        {
            key: "profile" as Surface,
            ar: "أظهر شارتك في الملفّ الشخصيّ", en: "Show your badge on your profile",
            subAr: "تظهر بجوار اسمك حين يفتح أحدٌ ملفّك.",
            subEn: "It appears beside your name when someone opens your profile."
        },
        {
            key: "chat" as Surface,
            ar: "أظهر شارتك في المحادثة", en: "Show your badge in chat",
            subAr: "تظهر بجوار اسمك في كل رسالة تكتبها.",
            subEn: "It appears beside your name on every message you send."
        }
    ];

    return (
        <div className="esharq-mp-showcase esharq-rise" style={stagger(index, 6)}>
            <div className={"esharq-mp-ring" + (nowhere ? " off" : "")}>
                <ErrorBoundary noop>
                    <img src={badge.image} alt="" />
                </ErrorBoundary>
            </div>

            <div className="esharq-mp-tooltip">{badge.tooltip || t("شارتك", "Your badge")}</div>

            {nowhere && (
                <div className="esharq-mp-nowhere">
                    {t("شارتك مخفيّة في الموضعين — لا يراها أحد الآن.",
                        "Your badge is hidden in both places — nobody sees it right now.")}
                </div>
            )}

            <div className="esharq-mp-choices">
                {CHOICES.map((choice, i) => (
                    <label key={choice.key}
                        className={"esharq-mp-choice esharq-rise" + (surfaces[choice.key] ? " on" : "")}
                        style={stagger(i, 4)}>
                        <div className="esharq-mp-choice-text">
                            <div className="esharq-mp-choice-title">{t(choice.ar, choice.en)}</div>
                            <div className="esharq-mp-choice-sub">{t(choice.subAr, choice.subEn)}</div>
                        </div>
                        <Switch
                            checked={surfaces[choice.key]}
                            disabled={busy}
                            onChange={v => onToggle(choice.key, v)}
                        />
                    </label>
                ))}
            </div>
        </div>
    );
}

export function MyProfilePage() {
    const [busy, setBusy] = useState(false);
    const [opened, setOpened] = useState(false);

    const me = useMemo(() => {
        try { return UserStore.getCurrentUser(); } catch { return null; }
    }, []);

    /**
     * شارات الخدمة الذاتية **من الخادم** — قائمةٌ لا واحدة.
     *
     * الداعم اليوم له واحدة، وقد يصير له ثلاث. وبطاقةٌ لكل شارة تُظهر كلّ
     * شيء دفعةً واحدة بلا وضعٍ مخفيّ — أوضح من شارةٍ كبيرة وشريطِ مصغّرات
     * يُخفي خيارات ما لم يُختَر.
     */
    const selfServe = useMemo(() => (me == null ? [] : getSelfServeBadges(me.id)), [me]);

    const badges = useMemo<Badge[]>(() => {
        if (me == null) return [];
        try { return _getBadges({ userId: me.id, guildId: "" } as any) as Badge[]; } catch { return []; }
    }, [me]);

    if (me == null) {
        return <NoticeStrip tone="danger">{t("لم أتمكّن من قراءة حسابك.", "I couldn't read your account.")}</NoticeStrip>;
    }

    const esharqBadges = badges.filter(isEsharqBadge);
    const isSupporter = selfServe.length > 0 || esharqBadges.length > 0;
    const avatar = me.getAvatarURL?.(undefined, 128) ?? "";

    const openControl = () => {
        setBusy(true);
        try { (window as any).VencordNative?.native?.openExternal?.(BADGE_CONTROL_URL); } catch { /* تُعرَض الرسالة أدناه */ }
        setOpened(true);
        setTimeout(() => setBusy(false), 900);
    };

    // الشارات التي يملكها فعلاً — لا يُعرَض مفتاحٌ لشارةٍ لا يملكها.
    const heldKinds: BadgeKind[] = [
        ...(esharqBadges.some(b => b.id === "esharq_tier_badge") ? ["tier" as const] : []),
        ...(esharqBadges.some(b => b.id === "esharq_user_badge") ? ["user" as const] : []),
        ...(esharqBadges.some(b => b.id === "esharq_custom_badge") ? ["custom" as const] : []),
        ...(selfServe.length > 0 ? ["selfserve" as const] : [])
    ];

    const shownCount = selfServe.filter(b => b.surfaces.profile || b.surfaces.chat).length;
    const state = selfServe.length === 0
        ? { text: t("لا شارة", "No badge"), tone: "warn" as const }
        : shownCount === selfServe.length
            ? { text: selfServe.length > 1 ? t(`${selfServe.length} ظاهرة`, `${selfServe.length} visible`) : t("ظاهرة", "Visible"), tone: "ok" as const }
            : shownCount > 0
                ? { text: t(`${shownCount} من ${selfServe.length} ظاهرة`, `${shownCount} of ${selfServe.length} visible`), tone: "warn" as const }
                : { text: t("مخفيّة", "Hidden"), tone: "danger" as const };

    return (
        <>
            <Card index={0}
                title={t("ملفّك الشخصيّ", "Your profile")}
                subtitle={t("كما يراك إشراق.", "As Esharq sees you.")}
                badge={isSupporter ? t("داعم", "Supporter") : t("عضو", "Member")}
                badgeTone={isSupporter ? "ok" : "info"}>
                <div className="esharq-mp-head">
                    {avatar !== "" && <img className="esharq-mp-avatar" src={avatar} alt="" width={72} height={72} />}
                    <div className="esharq-mp-who">
                        <div className="esharq-mp-name">{me.globalName ?? me.username}</div>
                        <div className="esharq-mp-tag">@{me.username}</div>
                    </div>
                </div>
            </Card>

            {heldKinds.length > 0 && (
                <Card index={1}
                    title={t("أين تظهر شاراتك", "Where your badges appear")}
                    subtitle={t("اختر النطاق أوّلاً، ثمّ الموضع.", "Choose the scope first, then the place.")}
                    badge={t("جديد", "New")} badgeTone="info">
                    <BadgeControl held={heldKinds} />
                </Card>
            )}

            <Card index={1}
                title={t("شارتك في إشراق", "Your Esharq badge")}
                subtitle={selfServe.length > 0
                    ? t("تحكّم بأين تظهر كل شارة — والتغيير يسري على كل مستخدمي إشراق.",
                        "Control where each badge appears — the change applies to every Esharq user.")
                    : t("للداعمين شارة خاصّة يتحكّمون بأين تظهر.",
                        "Supporters get their own badge and control where it appears.")}
                badge={state.text} badgeTone={state.tone}>

                {selfServe.length > 0 ? (
                    <>
                        <div className={"esharq-mp-cases" + (selfServe.length > 1 ? " many" : "")}>
                            {selfServe.map((b, i) => (
                                <BadgeShowcase key={b.id} badge={b} index={i} busy={busy} onToggle={openControl} />
                            ))}
                        </div>

                        {opened && (
                            <NoticeStrip>
                                {t("فُتحت صفحة التحكّم في متصفّحك. اكتب /badge في خادم إشراق لتحصل على رابطك إن طُلب منك.",
                                    "The control page opened in your browser. Type /badge in the Esharq server to get your link if it asks for one.")}
                            </NoticeStrip>
                        )}

                        <NoticeStrip>
                            {t("التبديل يجري في الموقع لأنه يحتاج إثبات أنك صاحب الشارة — رابطٌ موقَّع من /badge ثم فحصٌ لدورك عند ديسكورد. ولا نمنح العميل سلطةً ثانيةً أضعف على البيانات نفسها.",
                                "The switch happens on the website because it must prove the badge is yours — a signed link from /badge, then a check of your role at Discord. We don't give the client a second, weaker authority over the same data.")}
                        </NoticeStrip>

                        <NoticeStrip>
                            {t("وما تُغيّره يصل بقيّة المستخدمين خلال نصف ساعة على الأكثر — وهي دورة تحديث الشارات عند كل عميل.",
                                "What you change reaches other users within half an hour at most — that is how often each client refreshes badges.")}
                        </NoticeStrip>
                    </>
                ) : (
                    <div className="esharq-mp-empty">
                        <div className="esharq-mp-empty-title">{t("لا شارة خاصّة بك بعد", "You don't have your own badge yet")}</div>
                        <p>{t("ادعم إشراق فتختار صورتك ونصّك ومؤثّرك، وتتحكّم بأين تظهر من هنا.",
                            "Support Esharq and you choose your own image, text and effect — then control where it appears from here.")}</p>
                    </div>
                )}
            </Card>

            {esharqBadges.length > 0 && (
                <Card index={2}
                    title={t("شاراتك الأخرى من إشراق", "Your other Esharq badges")}
                    subtitle={t("شارات يمنحها إشراق، ولا تُضبَط من هنا.", "Badges granted by Esharq; not configured here.")}
                    badge={String(esharqBadges.length)} badgeTone="info">
                    <div className="esharq-mp-list">
                        {esharqBadges.map((b, i) => (
                            <div key={(b.description ?? "") + i} className="esharq-mp-badge esharq-rise" style={stagger(i, 10)}>
                                <div className="esharq-mp-badge-art">
                                    <ErrorBoundary noop>
                                        {b.component
                                            // `_getBadges` يدمج `userId` في كائن الشارة نفسه،
                                            // والمكوّن يحتاجه ليعرف الرتبة. تمريرُ `props` وحدها
                                            // كان يُصيّر شارة الرتبة فارغةً بلا خطأ.
                                            ? <b.component {...b} {...(b.props ?? {})} />
                                            : (b.iconSrc ?? b.image)
                                                ? <img src={b.iconSrc ?? b.image} alt="" width={32} height={32} />
                                                : <span className="esharq-mp-noart">?</span>}
                                    </ErrorBoundary>
                                </div>
                                <div className="esharq-mp-badge-body">
                                    <div className="esharq-mp-badge-name">{b.description ?? t("شارة", "Badge")}</div>
                                    <div className="esharq-mp-origin esharq">{t("من إشراق", "From Esharq")}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <Card index={3}
                title={t("هل يُعرّض هذا حسابك للحظر؟", "Does this put your account at risk?")}
                subtitle={t("الجواب مبنيّ على ما تفعله الصفحة لا على الطمأنة.",
                    "The answer is based on what the page does, not on reassurance.")}>
                <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                    <div>{t("① الصفحة تقرأ وترسم فقط. لا تُرسل طلباً واحداً إلى ديسكورد.",
                        "① The page only reads and renders. It sends not one request to Discord.")}</div>
                    <div>{t("② ولا تُعدّل بيانات حسابك: لا اسمك ولا شاراتك ولا أي حقل عند ديسكورد.",
                        "② It changes nothing on your account: not your name, not your badges, not any field at Discord.")}</div>
                    <div>{t("③ وشارات إشراق ليست شارات ديسكورد أصلاً — يرسمها العميل عندك ولا وجود لها في حسابك.",
                        "③ Esharq badges aren't Discord badges at all — your client draws them, and they don't exist on your account.")}</div>
                </div>
            </Card>
        </>
    );
}
