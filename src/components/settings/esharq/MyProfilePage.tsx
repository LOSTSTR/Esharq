/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./myProfile.css";

import { _getBadges } from "@api/Badges";
import { Settings, useSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Switch } from "@components/Switch";
import { t } from "@utils/esharqI18n";
import { useMemo, UserStore, useState } from "@webpack/common";

import { Card, NoticeStrip, StatRow } from "./Card";
import { stagger } from "./motion";

/**
 * **ملفّك الشخصيّ** — صورتك وشاراتك في موضع واحد، ومفتاحٌ لكل شارة من إشراق.
 *
 * ## 🔴 حدود الإخفاء — مكتوبةٌ في الواجهة لا في تعليقٍ وحده
 *
 * شارات إشراق تُقرأ من ملفّات في مستودع عامّ **يجلبها كل عميل بنفسه**. فزرٌّ
 * هنا يُغيّر ما يراه صاحب الجهاز ولا يصل غيره. وإخفاؤها عن الناس يحتاج تعديل
 * تلك الملفّات على الخادم — وهو مسارٌ مُوثَّق يخصّ الموقع لا العميل.
 *
 * ⇒ فالمفتاح هنا **معاينة**: يُخفي الشارة عن عينك أنت. والواجهة تقولها
 * صراحةً، لأن مفتاحاً يوهم صاحبه أنه أخفى شيئاً عن الناس وهو لم يفعل أسوأ من
 * ألّا يكون هناك مفتاح.
 *
 * ## ولماذا لا توجد مفاتيح لشارات ديسكورد
 *
 * بحثتُ في العميل الحيّ: **لا مفتاح تفضيل واحد** يخصّ إظهار الشارات في حزمة
 * ديسكورد كلّها (`hidden_badges` · `badge_visibility` · `show_badges` — لا شيء)،
 * وما يُسمّى `hideBadge` فيها يخصّ **شارات المتجر** لا الملفّ الشخصيّ.
 * فديسكورد لا يُتيح هذا، ولا نخترع له مفتاحاً لا يعمل.
 *
 * ## وعن الحظر
 *
 * كل ما هنا **قراءةٌ ورسمٌ محلّيّان**: لا طلب واحد إلى واجهة ديسكورد، ولا
 * تعديل لأي بيانات حساب. لا سطح خطر أصلاً.
 */

interface Badge {
    description?: string;
    image?: string;
    component?: any;
    props?: any;
    link?: string;
}

/** أهي شارة من إشراق أم من ديسكورد أم من المُعدِّل الأصليّ؟ */
function originOf(badge: Badge): "esharq" | "discord" | "upstream" {
    const src = `${badge.description ?? ""} ${badge.image ?? ""}`.toLowerCase();
    if (src.includes("esharq") || src.includes("إشراق")) return "esharq";
    if (src.includes("vencord") || src.includes("equicord")) return "upstream";
    return "discord";
}

function readHidden(): string[] {
    const list = (Settings as any).esharq?.hiddenBadges;
    return Array.isArray(list) ? list : [];
}

function writeHidden(list: string[]) {
    const store = Settings as Record<string, any>;
    store.esharq = { ...(store.esharq ?? {}), hiddenBadges: list };
}

function BadgeTile({ badge, index, hidden, onToggle }: {
    badge: Badge;
    index: number;
    hidden: boolean;
    onToggle?: (v: boolean) => void;
}) {
    const origin = originOf(badge);
    const label = badge.description ?? t("شارة بلا اسم", "Unnamed badge");

    return (
        <div className={`esharq-mp-badge esharq-rise origin-${origin}` + (hidden ? " off" : "")} style={stagger(index, 10)}>
            <div className="esharq-mp-badge-art">
                {/* شارةٌ تنفجر عند الرسم يجب ألّا تُسقط الصفحة. */}
                <ErrorBoundary noop>
                    {badge.component
                        ? <badge.component {...(badge.props ?? {})} />
                        : badge.image
                            ? <img src={badge.image} alt="" width={32} height={32} {...(badge.props ?? {})} />
                            : <span className="esharq-mp-noart">?</span>}
                </ErrorBoundary>
            </div>

            <div className="esharq-mp-badge-body">
                <div className="esharq-mp-badge-name">{label}</div>
                <div className={`esharq-mp-origin ${origin}`}>
                    {origin === "esharq" ? t("من إشراق", "From Esharq")
                        : origin === "upstream" ? t("من المُعدِّل الأصليّ", "From the upstream mod")
                            : t("من ديسكورد", "From Discord")}
                </div>
            </div>

            {onToggle ? (
                <Switch checked={!hidden} onChange={v => onToggle(!v)} />
            ) : (
                <span className="esharq-mp-locked" title={t("شارات ديسكورد لا يُتيح ديسكورد إخفاءها", "Discord does not allow hiding its own badges")}>
                    🔒
                </span>
            )}
        </div>
    );
}

export function MyProfilePage() {
    useSettings(["esharq" as any]);
    const [hidden, setHidden] = useState<string[]>(readHidden);

    const me = useMemo(() => {
        try { return UserStore.getCurrentUser(); } catch { return null; }
    }, []);

    /**
     * كل الشارات كما يراها المُصيِّر — **بلا مرشِّح الإخفاء**، وإلّا اختفت
     * الشارة المُطفأة من الصفحة التي يُفترض أن يُعيد منها تشغيلها.
     */
    const badges = useMemo<Badge[]>(() => {
        if (me == null) return [];
        try {
            const previous = (Settings as any).esharq?.hiddenBadges;
            const store = Settings as Record<string, any>;
            store.esharq = { ...(store.esharq ?? {}), hiddenBadges: [] };
            const all = _getBadges({ userId: me.id, guildId: "" } as any) as Badge[];
            store.esharq = { ...(store.esharq ?? {}), hiddenBadges: previous };
            return all;
        } catch {
            return [];
        }
        // مرّة واحدة عند الفتح: القائمة لا تتغيّر بتبديل مفتاح.
    }, [me]);

    if (me == null) {
        return <NoticeStrip tone="danger">{t("لم أتمكّن من قراءة حسابك.", "I couldn't read your account.")}</NoticeStrip>;
    }

    const esharqBadges = badges.filter(b => originOf(b) === "esharq");
    const otherBadges = badges.filter(b => originOf(b) !== "esharq");
    const isSupporter = esharqBadges.length > 0;

    const toggle = (description: string | undefined, hide: boolean) => {
        if (description == null) return;
        const next = hide
            ? [...new Set([...hidden, description])]
            : hidden.filter(d => d !== description);
        writeHidden(next);
        setHidden(next);
    };

    const avatar = me.getAvatarURL?.(undefined, 128) ?? "";

    return (
        <>
            <Card index={0}
                title={t("ملفّك الشخصيّ", "Your profile")}
                subtitle={t("كما يراك إشراق: صورتك وشاراتك كلّها في موضع واحد.",
                    "As Esharq sees you: your avatar and all your badges in one place.")}
                badge={isSupporter ? t("داعم", "Supporter") : t("عضو", "Member")}
                badgeTone={isSupporter ? "ok" : "info"}>

                <div className="esharq-mp-head">
                    {avatar !== "" && <img className="esharq-mp-avatar" src={avatar} alt="" width={72} height={72} />}
                    <div className="esharq-mp-who">
                        <div className="esharq-mp-name">{me.globalName ?? me.username}</div>
                        <div className="esharq-mp-tag">@{me.username}</div>
                    </div>
                </div>

                <StatRow items={[
                    { label: t("شاراتك كلّها", "All your badges"), value: String(badges.length) },
                    { label: t("من إشراق", "From Esharq"), value: String(esharqBadges.length) },
                    { label: t("مُخفاة عندك", "Hidden for you"), value: String(hidden.length) },
                    { label: t("حالتك", "Your status"), value: isSupporter ? t("داعم", "Supporter") : t("عضو", "Member") }
                ]} />
            </Card>

            <Card index={1}
                title={t("شارات إشراق", "Esharq badges")}
                subtitle={isSupporter
                    ? t("لك مفتاحٌ لكل شارة. اقرأ ما تحته قبل أن تُطفئ شيئاً.", "You get a switch for each. Read the note below before turning one off.")
                    : t("تظهر هنا لمن يدعم إشراق.", "These appear here for those who support Esharq.")}
                badge={String(esharqBadges.length)}
                badgeTone={isSupporter ? "ok" : "warn"}>

                {isSupporter ? (
                    <>
                        <NoticeStrip tone="danger">
                            {t("الإطفاء يُخفي الشارة عن عينك أنت وحدك — لا عن بقيّة مستخدمي إشراق. وشارات إشراق تُقرأ من ملفّ يجلبه كل عميل بنفسه، فإخفاؤها عن الناس يحتاج تعديل ذلك الملفّ لا زرّاً هنا. وهذا المفتاح معاينة، وسنربطه بالمسار العامّ حين يجهز.",
                                "Turning one off hides it from your own view only — not from other Esharq users. Esharq badges are read from a file every client fetches itself, so hiding one from everyone means changing that file, not pressing a button here. This switch is a preview; it will be connected to the global path once that exists.")}
                        </NoticeStrip>
                        <div className="esharq-mp-list">
                            {esharqBadges.map((b, i) => (
                                <BadgeTile key={(b.description ?? "") + i} badge={b} index={i}
                                    hidden={b.description != null && hidden.includes(b.description)}
                                    onToggle={v => toggle(b.description, v)} />
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="esharq-mp-empty">
                        <div className="esharq-mp-empty-title">{t("لا شارات إشراق بعد", "No Esharq badges yet")}</div>
                        <p>{t("ادعم إشراق لتظهر شاراتك الخاصّة هنا، وتتحكّم بها من هذه الصفحة.",
                            "Support Esharq and your own badges appear here, with control over them from this page.")}</p>
                    </div>
                )}
            </Card>

            <Card index={2}
                title={t("شارات ديسكورد وغيرها", "Discord badges and others")}
                subtitle={t("تأتي من حسابك في ديسكورد أو من المُعدِّل الأصليّ.",
                    "These come from your Discord account or from the upstream mod.")}
                badge={String(otherBadges.length)} badgeTone="info">
                {otherBadges.length === 0 ? (
                    <div className="esharq-mp-empty">
                        <div className="esharq-mp-empty-title">{t("لا شارات هنا", "No badges here")}</div>
                        <p>{t("حسابك لا يحمل شارات ديسكورد ظاهرة.", "Your account carries no visible Discord badges.")}</p>
                    </div>
                ) : (
                    <div className="esharq-mp-list">
                        {otherBadges.map((b, i) => (
                            <BadgeTile key={(b.description ?? "") + i} badge={b} index={i} hidden={false} />
                        ))}
                    </div>
                )}
                <NoticeStrip>
                    {t("شارات ديسكورد بلا مفاتيح لأن ديسكورد لا يُتيح إخفاءها: بحثتُ في العميل فلم أجد تفضيلاً واحداً لذلك، وما يحمل اسم «إخفاء شارة» عنده يخصّ شارات المتجر لا الملفّ الشخصيّ. ولا نضع مفتاحاً لا يفعل شيئاً.",
                        "Discord badges have no switches because Discord offers no way to hide them: I searched the client and found no such preference, and what is named “hide badge” there belongs to store badges, not profile ones. We don't add a switch that does nothing.")}
                </NoticeStrip>
            </Card>

            <Card index={3}
                title={t("هل يُعرّض هذا حسابك للحظر؟", "Does this put your account at risk?")}
                subtitle={t("الجواب مبنيّ على ما تفعله الصفحة لا على الطمأنة.",
                    "The answer is based on what the page does, not on reassurance.")}>
                <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                    <div>{t("① الصفحة تقرأ وترسم فقط. لا تُرسل طلباً واحداً إلى ديسكورد.", "① The page only reads and renders. It sends not one request to Discord.")}</div>
                    <div>{t("② ولا تُعدّل بيانات حسابك: لا اسمك ولا شاراتك ولا أي حقل عند ديسكورد.", "② It changes nothing on your account: not your name, not your badges, not any field at Discord.")}</div>
                    <div>{t("③ والإخفاء يقع في جهازك وحده، ولا يعلمه ديسكورد ولا يعنيه.", "③ Hiding happens on your machine alone; Discord neither knows nor cares.")}</div>
                    <div>{t("④ وشارات إشراق ليست شارات ديسكورد أصلاً — يرسمها العميل عندك ولا وجود لها في حسابك.", "④ Esharq badges aren't Discord badges at all — your client draws them, and they don't exist on your account.")}</div>
                </div>
            </Card>
        </>
    );
}
