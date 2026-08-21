/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./privacySecurity.css";

import { useSettings } from "@api/Settings";
import { isSecretKey } from "@api/SettingsSync/redact";
import { BlockSnapshot, getBlockSnapshot } from "@debug/blockLog";
import type { DnsMode, DnsProvider, DnsState, DnsTestResult } from "@main/secureDns";
import { t } from "@utils/esharqI18n";
import { Button, useEffect, useMemo, useState } from "@webpack/common";

import { Card, NoticeStrip, StatRow } from "./Card";
import { CopyButton } from "./CopyButton";
import { stagger } from "./motion";
import { Section, SectionTabs } from "./SectionTabs";

/**
 * **الخصوصية والأمان** — ماذا يحفظ إشراق عنك، وأين، وما الذي يغادر جهازك.
 *
 * وهي غير «الرصد»: تلك تسأل **إلى أين يُسمح للعميل أن يصل**، وهذه تسأل
 * **ماذا عندك وماذا يخرج منه**.
 *
 * ## مقسومةٌ إلى أقسام
 *
 * كانت بطاقاتٍ متتابعة تُقرأ بالتمرير وحده، فمن يبحث عن «ماذا يُحفَظ على
 * جهازي» يمرّ على كل ما سواه. والأقسام تُعطيه خريطةً في سطرٍ ونقلةً بضغطة —
 * ولا يُرسَم إلّا المفتوح منها، فلا مؤقّتاتٌ ولا طلباتٌ لأقسامٍ لا تُرى.
 *
 * 🔴 **الجرد أحجامٌ ومسارات لا محتوى.** لا يُقرأ ملفّ واحد لأجل هذه الصفحة —
 * قراءة المحتوى لتُجيب سؤال الخصوصية تناقض السؤال.
 *
 * 🔴 **وعدّ الأسرار يقع في جهازك ولا يُعرض أيّ منها.** يُقال «سبعة مفاتيح
 * سرّية عندك، وتُنقّى عند التصدير» ولا يُطبَع مفتاح واحد ولا جزء منه. صفحةٌ
 * تعرض السرّ لتُخبرك أنه محميّ صفحةٌ متناقضة.
 */

const KIND_LABELS: Record<string, { ar: string; en: string; }> = {
    analytics: { ar: "تحليلات", en: "Analytics" },
    metric: { ar: "مقياس", en: "Metric" },
    sentry: { ar: "تقرير عطل", en: "Crash report" },
    science: { ar: "Science", en: "Science" }
};

/** «قبل ثوانٍ» أوضح من طابعٍ زمنيّ لسطرٍ عمرُه لحظات. */
function ago(at: number): string {
    const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
    if (seconds < 60) return t(`قبل ${seconds} ثانية`, `${seconds}s ago`);
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return t(`قبل ${minutes} دقيقة`, `${minutes}m ago`);
    return t(`قبل ${Math.round(minutes / 60)} ساعة`, `${Math.round(minutes / 60)}h ago`);
}

interface HostRule {
    host: string;
    directives: string[];
}

interface DataEntry {
    key: string;
    path: string;
    files: number;
    bytes: number;
    exists: boolean;
}

const ENTRY_LABELS: Record<string, { ar: string; en: string; whatAr: string; whatEn: string; }> = {
    settings: {
        ar: "الإعدادات", en: "Settings",
        whatAr: "اختياراتك في إشراق وإضافاته. تبقى هنا، ولا تُرسَل إلّا إن فعّلتَ المزامنة السحابية بنفسك.",
        whatEn: "Your choices in Esharq and its plugins. They stay here, and are sent only if you turn on cloud sync yourself."
    },
    themes: {
        ar: "الثيمات", en: "Themes",
        whatAr: "ملفّات الثيمات التي أضفتَها. لا تغادر جهازك.",
        whatEn: "Theme files you added. They never leave your machine."
    },
    plugins: {
        ar: "بيانات الإضافات", en: "Plugin data",
        whatAr: "ما تحفظه الإضافات لنفسها — قوائم وتفضيلات. محلّيّ بالكامل.",
        whatEn: "What plugins save for themselves — lists and preferences. Entirely local."
    },
    community: {
        ar: "إضافات المجتمع", en: "Community plugins",
        whatAr: "ما استوردته من مجلدات على جهازك. لا يُرفَع ولا يُشارَك أبداً.",
        whatEn: "What you imported from folders on your machine. Never uploaded or shared."
    },
    tools: {
        ar: "أدوات خارجية", en: "External tools",
        whatAr: "ما نزّلته من أدوات اختيارية، ونسخُك الأصلية إن رقّعت شيئاً.",
        whatEn: "Optional tools you downloaded, plus your original backups if you patched anything."
    },
    messageLogger: {
        ar: "سجلّ الرسائل", en: "Message logger",
        whatAr: "رسائل حفظتها إضافة سجلّ الرسائل إن كانت مُفعَّلة عندك. محلّيّ، ولا يُصدَّر مع حزمة الدعم.",
        whatEn: "Messages saved by the message logger plugin if you enabled it. Local, and never included in the support bundle."
    }
};

/** ما لا يفعله إشراق أبداً — بنودٌ كلٌّ منها قابل للتحقّق في المستودع. */
const NEVER = [
    ["لا يُرسل رسائلك ولا محتواها إلى أي جهة.", "It never sends your messages or their contents anywhere."],
    ["لا يُرسل توكن حسابك إلى أي جهة غير ديسكورد نفسه.", "It never sends your account token anywhere except Discord itself."],
    ["لا يجمع إحصاءات استعمال ولا يُرسل تقارير أعطال تلقائياً.", "It collects no usage analytics and sends no crash reports automatically."],
    ["لا يرفع إضافات المجتمع التي تستوردها.", "It never uploads the community plugins you import."],
    ["لا شيء يُرفَع تلقائياً — كل إرسالٍ يبدأ بضغطة منك.", "Nothing is uploaded automatically — every send starts with a press from you."]
] as const;

function human(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
}

/**
 * كم مفتاحاً سرّياً في إعداداتك — **عدداً لا قيمةً**.
 *
 * يُحسَب بنفس الدالّة التي تُنقّي التصدير، فالرقم يصف ما سيُنقّى فعلاً لا
 * تقديراً موازياً يفترق عنه.
 */
function countSecrets(node: unknown, depth = 0): number {
    if (depth > 8 || node === null || typeof node !== "object") return 0;
    let n = 0;
    for (const [key, value] of Object.entries(node)) {
        if (isSecretKey(key) && value !== null && value !== undefined && value !== "") n++;
        else n += countSecrets(value, depth + 1);
    }
    return n;
}

export function PrivacySecurityPage() {
    const settings = useSettings();
    const [data, setData] = useState<{ root: string; entries: DataEntry[]; } | null>(null);
    const [failed, setFailed] = useState(false);
    const [hosts, setHosts] = useState<{ builtIn: HostRule[]; custom: HostRule[]; } | null>(null);
    const [blocks, setBlocks] = useState<BlockSnapshot>(() => getBlockSnapshot());
    const [dns, setDns] = useState<(DnsState & { providers: DnsProvider[]; }) | null>(null);
    const [dnsTest, setDnsTest] = useState<DnsTestResult | "running" | null>(null);

    useEffect(() => {
        const api = (window as any).VencordNative?.dataInventory;
        if (api?.read == null) return setFailed(true);
        api.read().then(setData).catch(() => setFailed(true));

        // الوجهات تُقرأ مرّةً كذلك — قائمةٌ ثابتة لا تتغيّر أثناء الجلسة.
        (window as any).VencordNative?.csp?.listPolicies?.()
            .then(setHosts)
            .catch(() => setHosts({ builtIn: [], custom: [] }));

        (window as any).VencordNative?.secureDns?.getState?.()
            .then(setDns)
            .catch(() => setDns(null));

        // 🔴 المؤقّت يعيش مع الصفحة ويموت معها.
        //
        // العدّاد حيّ فيجب أن يتحرّك أمام الناظر، لكنّ مؤقّتاً يبقى بعد إغلاق
        // الصفحة تكلفةٌ دائمة لأجل شاشةٍ لا تُرى. وثانيتان تكفيان لعينٍ تقرأ.
        const timer = setInterval(() => setBlocks(getBlockSnapshot()), 2000);
        return () => clearInterval(timer);
    }, []);

    const secrets = useMemo(() => {
        try { return countSecrets((window as any).VencordNative?.settings?.get?.() ?? {}); } catch { return 0; }
    }, []);

    const cloudOn = settings.cloud?.authenticated === true;
    const totalBytes = data?.entries.reduce((n, e) => n + e.bytes, 0) ?? 0;
    const totalFiles = data?.entries.reduce((n, e) => n + e.files, 0) ?? 0;

    /**
     * الأقسام الأربعة.
     *
     * التقسيم بالسؤال الذي يطرحه القارئ، لا بترتيب بنائها: «ما الذي يخرج؟»
     * و«ما المحفوظ عندي؟» و«أين يُسمح له بالاتّصال؟» و«كيف أتحقّق بنفسي؟».
     */
    const sections: Section[] = [
        {
            key: "outbound",
            ar: "ما يغادر جهازك", en: "What leaves",
            count: cloudOn ? t("المزامنة", "Sync") : t("لا شيء", "None"),
            tone: cloudOn ? "warn" : "ok",
            render: () => (
                <>
                    <Card index={0}
                title={t("ماذا يغادر جهازك", "What leaves your machine")}
                subtitle={t("القاعدة: لا شيء — إلّا ما تبدأه أنت بنفسك.", "The rule: nothing — except what you start yourself.")}
                badge={cloudOn ? t("المزامنة مُفعَّلة", "Sync is on") : t("لا شيء تلقائيّ", "Nothing automatic")}
                badgeTone={cloudOn ? "warn" : "ok"}>

                <div className="esharq-ps-never">
                    {NEVER.map(([ar, en], i) => (
                        <div key={i} className="esharq-ps-never-row esharq-rise" style={stagger(i, 8)}>
                            <span className="esharq-ps-x" aria-hidden="true">✕</span>
                            <span>{t(ar, en)}</span>
                        </div>
                    ))}
                </div>

                <div className="esharq-ps-sends">
                    <div className="esharq-ps-subhead">{t("وما يخرج فعلاً، ومتى", "And what does go out, and when")}</div>
                    <div className="esharq-ps-send-row">
                        <b>{t("فحص التحديثات", "Update checks")}</b>
                        <span>{t("يسأل GitHub «هل يوجد إصدار أحدث؟». لا يحمل السؤال شيئاً عنك.",
                            "Asks GitHub “is there a newer release?”. The question carries nothing about you.")}</span>
                    </div>
                    <div className="esharq-ps-send-row">
                        <b>{t("ملفّات الثيمات", "Theme files")}</b>
                        <span>{t("تُنزَّل من مواقع الثيمات لتُعرَض لك. الاتّجاه إليك لا منك.",
                            "Downloaded from theme sites to be shown to you. The direction is toward you, not from you.")}</span>
                    </div>
                    <div className="esharq-ps-send-row">
                        <b>{t("المزامنة السحابية", "Cloud sync")}</b>
                        <span>{cloudOn
                            ? t("مُفعَّلة عندك الآن: تُرسل إعداداتك إلى الخادم الذي اخترته، ومفاتيحك تُنقّى قبل الإرسال.",
                                "On for you right now: it sends your settings to the server you chose, with your keys redacted before sending.")
                            : t("مُطفأة عندك. ما دامت كذلك لا تُرسَل إعداداتك إلى أي مكان.",
                                "Off for you. While it stays off, your settings are sent nowhere.")}</span>
                    </div>
                    <div className="esharq-ps-send-row">
                        <b>{t("حزمة الدعم", "Support bundle")}</b>
                        <span>{t("لا تُرفَع أبداً. تُبنى وتُعرَض، ولا تغادر إلّا إن نسختها بنفسك.",
                            "Never uploaded. It is built and shown, and leaves only if you copy it yourself.")}</span>
                    </div>
                </div>
            </Card>
                    <Card index={1}
                title={t("أسرارك في الإعدادات", "Your secrets in the settings")}
                subtitle={t("مفاتيح خدمات أدخلتَها في إضافات — تُنقّى تلقائياً من أي نسخة تُصدّرها.",
                    "Service keys you entered into plugins — automatically redacted from any backup you export.")}
                badge={secrets === 0 ? t("لا مفاتيح", "No keys") : t(`${secrets} مفتاحاً`, `${secrets} keys`)}
                badgeTone={secrets === 0 ? "ok" : "warn"}>
                <NoticeStrip>
                    {secrets === 0
                        ? t("لم أجد مفتاحاً سرّياً في إعداداتك. وإن أدخلتَ واحداً لاحقاً فسيُنقّى من التصدير تلقائياً.",
                            "I found no secret keys in your settings. If you enter one later, it will be redacted from exports automatically.")
                        : t(`عندك ${secrets} مفتاحاً سرّياً محفوظاً محلّياً. لم يُعرَض أيٌّ منها هنا ولن يُعرَض — العدد وحده يكفي للجواب. وكلّها تُستبدَل بعلامة تنقية في أي نسخة احتياطية تُصدّرها أو تُزامنها.`,
                            `You have ${secrets} secret keys stored locally. None is shown here and none will be — the count alone answers the question. All of them are replaced with a redaction marker in any backup you export or sync.`)}
                </NoticeStrip>
                <div className="esharq-ps-note">
                    {t("العدّ يجري بنفس الدالّة التي تُنقّي التصدير، فالرقم يصف ما سيُنقّى فعلاً لا تقديراً موازياً.",
                        "The count uses the very function that redacts exports, so the number describes what will actually be redacted — not a parallel estimate.")}
                </div>
            </Card>
                </>
            )
        },
        {
            key: "stored",
            ar: "المحفوظ على جهازك", en: "Stored here",
            count: data === null ? undefined : human(totalBytes),
            tone: "info",
            render: () => <Card index={0}
                title={t("ماذا يُحفَظ على جهازك", "What is stored on your machine")}
                subtitle={t("أحجام ومسارات — ولا يُقرأ محتوى ملفّ واحد لأجل هذه الصفحة.",
                    "Sizes and paths — and not one file's contents is read for this page.")}
                badge={data === null ? t("جارٍ…", "Working…") : `${human(totalBytes)}`}
                badgeTone="info">

                {failed ? (
                    <NoticeStrip tone="danger">
                        {t("الجرد متاح في تطبيق سطح المكتب فقط.", "The inventory is available in the desktop app only.")}
                    </NoticeStrip>
                ) : data === null ? (
                    <div className="esharq-ps-empty">{t("جارٍ القراءة…", "Reading…")}</div>
                ) : (
                    <>
                        <StatRow items={[
                            { label: t("المساحة", "Space"), value: human(totalBytes) },
                            { label: t("ملفّاً", "Files"), value: String(totalFiles) },
                            { label: t("مجلداً مستعملاً", "Folders in use"), value: String(data.entries.filter(e => e.files > 0).length) },
                            { label: t("يُرفَع تلقائياً", "Uploaded automatically"), value: t("لا شيء", "Nothing") }
                        ]} />

                        <div className="esharq-ps-list">
                            {data.entries.map((e, i) => {
                                const label = ENTRY_LABELS[e.key];
                                return (
                                    <div key={e.key} className={"esharq-ps-row esharq-rise" + (e.files === 0 ? " empty" : "")} style={stagger(i, 8)}>
                                        <div className="esharq-ps-row-head">
                                            <span className="esharq-ps-name">{label ? t(label.ar, label.en) : e.key}</span>
                                            <span className="esharq-ps-size">
                                                {e.files === 0 ? t("فارغ", "Empty") : `${e.files} · ${human(e.bytes)}`}
                                            </span>
                                        </div>
                                        {label && <div className="esharq-ps-what">{t(label.whatAr, label.whatEn)}</div>}
                                        <div className="esharq-ps-path">{e.path}</div>
                                    </div>
                                );
                            })}
                        </div>

                        <button type="button" className="esharq-ps-open"
                            onClick={() => (window as any).VencordNative?.dataInventory?.openRoot?.()}>
                            {t("افتح المجلد لتراه بنفسك", "Open the folder and see for yourself")}
                        </button>
                    </>
                )}
            </Card>
        },
        {
            key: "dns",
            ar: "الاتّصال المشفّر", en: "Secure Connect",
            count: dns === null ? undefined : (dns.mode === "off" ? t("مُطفأ", "Off") : t("يعمل", "On")),
            tone: dns?.mode === "off" ? "info" : "ok",
            render: () => {
                const provider = dns?.providers.find(p => p.id === dns.providerId);

                async function applyDns(mode: DnsMode, providerId: string) {
                    setDnsTest(null);
                    const result = await (window as any).VencordNative?.secureDns?.set?.(mode, providerId);
                    if (result?.ok) setDns(prev => (prev ? { ...prev, ...result.state } : prev));
                }

                async function runTest() {
                    setDnsTest("running");
                    const result = await (window as any).VencordNative?.secureDns?.test?.(dns?.providerId ?? "cloudflare");
                    setDnsTest(result ?? null);
                }

                return (
                    <>
                        <Card index={0}
                            title={t("الاتّصال المشفّر", "Secure Connect")}
                            subtitle={t("يُشفّر سؤال «ما عنوان discord.com؟» فلا يقرؤه مزوّد خدمتك.",
                                "Encrypts the question “what is discord.com's address?” so your ISP can't read it.")}
                            badge={dns === null ? t("جارٍ…", "Working…") : dns.mode === "off" ? t("مُطفأ", "Off") : t("يعمل", "Active")}
                            badgeTone={dns?.mode === "off" ? "info" : "ok"}>

                            {dns === null ? (
                                <NoticeStrip>{t("يقرأ الحالة…", "Reading state…")}</NoticeStrip>
                            ) : (
                                <>
                                    <div className="esharq-ps-line">
                                        <div className="esharq-ps-line-text">
                                            <div className="esharq-ps-line-label">{t("الوضع", "Mode")}</div>
                                            <div className="esharq-ps-line-hint">
                                                {t("«تلقائيّ» يستعمل المشفَّر إن أمكن ويرجع إلى العاديّ عند تعذّره. و«مشفَّر فقط» لا يرجع أبداً — أأمن، لكن إن سقط المُحوّل انقطع ديسكورد.",
                                                    "“Automatic” uses encrypted when it can and falls back to plain when it can't. “Encrypted only” never falls back — safer, but if the resolver goes down, Discord goes with it.")}
                                            </div>
                                        </div>
                                        <div className="esharq-ps-choices">
                                            {([
                                                { key: "off" as const, ar: "مُطفأ", en: "Off" },
                                                { key: "automatic" as const, ar: "تلقائيّ", en: "Automatic" },
                                                { key: "secure" as const, ar: "مشفَّر فقط", en: "Encrypted only" }
                                            ]).map(option => (
                                                <button
                                                    key={option.key}
                                                    type="button"
                                                    className={"esharq-ps-choice" + (dns.mode === option.key ? " on" : "")}
                                                    onClick={() => applyDns(option.key, dns.providerId)}>
                                                    {t(option.ar, option.en)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="esharq-ps-line">
                                        <div className="esharq-ps-line-text">
                                            <div className="esharq-ps-line-label">{t("المُحوِّل", "Resolver")}</div>
                                            <div className="esharq-ps-line-hint">
                                                {provider ? t(provider.ar, provider.en) : t("اختر من يُجيب أسئلتك.", "Choose who answers your questions.")}
                                            </div>
                                        </div>
                                        <select
                                            className="esharq-ps-select"
                                            value={dns.providerId}
                                            onChange={e => applyDns(dns.mode, e.currentTarget.value)}
                                            aria-label={t("المُحوِّل", "Resolver")}>
                                            {dns.providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>

                                    <StatRow items={[
                                        { label: t("الحالة", "State"), value: dns.mode === "off" ? t("مُطفأ", "Off") : t("مُطبَّق", "Applied") },
                                        { label: t("المُحوِّل", "Resolver"), value: provider?.name ?? "—" },
                                        { label: t("آخر اختبار", "Last test"), value: typeof dnsTest === "object" && dnsTest?.ms != null ? `${dnsTest.ms} ms` : "—" }
                                    ]} />

                                    {dns.appliedTemplate && (
                                        <div className="esharq-ps-endpoint">
                                            <code>{dns.appliedTemplate}</code>
                                        </div>
                                    )}

                                    <div className="esharq-ps-actions">
                                        <Button size={Button.Sizes.SMALL} disabled={dnsTest === "running"} onClick={runTest}>
                                            {dnsTest === "running" ? t("يختبر…", "Testing…") : t("اختبر المُحوِّل", "Test resolver")}
                                        </Button>
                                        {dns.mode !== "off" && (
                                            <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} look={Button.Looks.LINK}
                                                onClick={() => applyDns("off", dns.providerId)}>
                                                {t("أوقفه", "Turn off")}
                                            </Button>
                                        )}
                                    </div>

                                    {typeof dnsTest === "object" && dnsTest !== null && (
                                        <NoticeStrip tone={dnsTest.ok ? "info" : "danger"}>
                                            {dnsTest.ok
                                                ? t(`ردّ المُحوِّل في ${dnsTest.ms} مللي ثانية بـ${dnsTest.answers} إجابة. الاتّصال المشفَّر يعمل.`,
                                                    `The resolver answered in ${dnsTest.ms} ms with ${dnsTest.answers} answers. Encrypted lookup works.`)
                                                : dnsTest.reason === "timeout"
                                                    ? t("لم يردّ المُحوِّل خلال ستّ ثوانٍ. جرّب غيره أو تحقّق من شبكتك.",
                                                        "The resolver didn't answer within six seconds. Try another, or check your network.")
                                                    : t(`تعذّر الاختبار (${dnsTest.reason ?? "خطأ"}). المُحوِّل قد يكون محجوباً على شبكتك.`,
                                                        `The test failed (${dnsTest.reason ?? "error"}). This resolver may be blocked on your network.`)}
                                        </NoticeStrip>
                                    )}

                                    <NoticeStrip>
                                        {t("الاختبار يبدأ بضغطتك وحدها — لا شيء يجري تلقائياً في الخلفية، ولا اسم يخصّك يُسأل عنه.",
                                            "The test only runs when you press it — nothing happens automatically in the background, and no name of yours is looked up.")}
                                    </NoticeStrip>
                                </>
                            )}
                        </Card>

                        <Card index={1}
                            title={t("ما لا يفعله هذا", "What this does not do")}
                            subtitle={t("لأن نصف الحقيقة في الخصوصية أسوأ من لا شيء.",
                                "Because half a truth about privacy is worse than none.")}>
                            <div className="esharq-ps-how">
                                <div>{t("① لا يُخفي أنك تستعمل ديسكورد: عنوان الوجهة يبقى مكشوفاً لمزوّدك. الذي يُخفى هو السؤال لا الاتّصال.",
                                    "① It does not hide that you use Discord: the destination address stays visible to your ISP. What is hidden is the question, not the connection.")}</div>
                                <div>{t("② وليس VPN: لا يُغيّر موقعك ولا يتخطّى حجباً.",
                                    "② It is not a VPN: it does not change your location or bypass blocks.")}</div>
                                <div>{t("③ وثقتك تنتقل من مزوّد خدمتك إلى المُحوِّل الذي تختاره — اختيارٌ لا إلغاء.",
                                    "③ Your trust moves from your ISP to the resolver you pick — a choice, not an elimination.")}</div>
                                <div>{t("④ ويُشفَّر DNS وحده (DoH). ومُحوّل كروميوم لا يدعم DoT، فلا نعرض زرّاً له.",
                                    "④ Only DNS is encrypted (DoH). Chromium's resolver has no DoT support, so we don't offer a button for it.")}</div>
                            </div>
                        </Card>
                    </>
                );
            }
        },
        {
            key: "blocked",
            ar: "ما حُجب الآن", en: "Blocked now",
            count: blocks.total,
            tone: blocks.total > 0 ? "ok" : "info",
            render: () => (
                <Card index={0}
                    title={t("تتبّع ديسكورد المحجوب", "Discord tracking, blocked")}
                    subtitle={t("عدّادٌ حيّ لما أوقفه إشراق منذ إقلاعك — لا وعدٌ مكتوب.",
                        "A live count of what Esharq stopped since you started — not a written promise.")}
                    badge={blocks.total > 0 ? String(blocks.total) : t("لا شيء بعد", "Nothing yet")}
                    badgeTone={blocks.total > 0 ? "ok" : "info"}>

                    <StatRow items={[
                        { label: t("المجموع", "Total"), value: String(blocks.total) },
                        { label: t("أحداث تحليلية", "Analytics"), value: String(blocks.counts.analytics) },
                        { label: t("مقاييس", "Metrics"), value: String(blocks.counts.metric) },
                        { label: t("تقارير أعطال", "Crash reports"), value: String(blocks.counts.sentry) }
                    ]} />

                    <div className="esharq-ps-since">
                        {t(`منذ إقلاع العميل قبل ${Math.max(1, Math.round((Date.now() - blocks.since) / 60000))} دقيقة.`,
                            `Since the client started ${Math.max(1, Math.round((Date.now() - blocks.since) / 60000))} minutes ago.`)}
                    </div>

                    {blocks.recent.length === 0 ? (
                        <NoticeStrip>
                            {t("لم يُحجَب شيء بعد. وهذا طبيعيّ في أوّل دقائق الجلسة — ديسكورد يُرسل قياساته على فترات، لا فور الإقلاع.",
                                "Nothing has been blocked yet. That is normal in the first minutes — Discord sends its measurements periodically, not at startup.")}
                        </NoticeStrip>
                    ) : (
                        <>
                            <div className="esharq-ps-sub">{t("آخر ما حُجب", "Most recent")}</div>
                            <div className="esharq-ps-blocks">
                                {blocks.recent.slice(0, 12).map((entry, i) => (
                                    <div key={entry.at + entry.label + i} className="esharq-ps-block esharq-rise" style={stagger(Math.min(i, 10), 4)}>
                                        <span className={"esharq-ps-kind " + entry.kind}>{t(KIND_LABELS[entry.kind].ar, KIND_LABELS[entry.kind].en)}</span>
                                        <code>{entry.label}</code>
                                        <span className="esharq-ps-ago">{ago(entry.at)}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    <div className="esharq-ps-actions">
                        <CopyButton
                            text={() => JSON.stringify({
                                total: blocks.total,
                                counts: blocks.counts,
                                minutes: Math.round((Date.now() - blocks.since) / 60000),
                                recent: blocks.recent.map(e => ({ kind: e.kind, label: e.label, secondsAgo: Math.round((Date.now() - e.at) / 1000) }))
                            }, null, 2)}
                            label={t("انسخ التقرير", "Copy report")}
                        />
                    </div>

                    <NoticeStrip>
                        {t("يُسجَّل نوع الحدث ووقته فقط — لا محتواه ولا أي شيء منك. وصفحةٌ تعرض ما مُنع إرساله لتُطمئنك أنه لم يُرسَل صفحةٌ تناقض نفسها.",
                            "Only the event's type and time are recorded — never its contents, and nothing of yours. A page that shows you what was stopped from being sent, in order to reassure you it wasn't sent, would contradict itself.")}
                    </NoticeStrip>
                </Card>
            )
        },
        {
            key: "hosts",
            ar: "الوجهات المسموح بها", en: "Allowed destinations",
            count: hosts === null ? undefined : hosts.builtIn.length + hosts.custom.length,
            tone: "info",
            render: () => (
                <Card index={0}
                    title={t("إلى أين يُسمح لإشراق أن يتّصل", "Where Esharq is allowed to connect")}
                    subtitle={t("قائمةٌ مغلقة يفرضها العميل نفسه: ما ليس فيها يُمنَع، ولو طلبته إضافة.",
                        "A closed list the client itself enforces: anything not on it is blocked, even if a plugin asks for it.")}
                    badge={hosts === null ? t("جارٍ…", "Working…") : String(hosts.builtIn.length + hosts.custom.length)}
                    badgeTone="info">

                    {hosts === null ? (
                        <NoticeStrip>{t("يقرأ القائمة…", "Reading the list…")}</NoticeStrip>
                    ) : (
                        <>
                            <StatRow items={[
                                { label: t("وجهات مُدمَجة", "Built in"), value: String(hosts.builtIn.length) },
                                { label: t("أضفتَها أنت", "Added by you"), value: String(hosts.custom.length) }
                            ]} />

                            <div className="esharq-ps-hosts">
                                {[...hosts.builtIn, ...hosts.custom]
                                    .slice()
                                    .sort((a, b) => a.host.localeCompare(b.host))
                                    .map((entry, i) => (
                                        <div key={entry.host} className="esharq-ps-host esharq-rise" style={stagger(Math.min(i, 14), 4)}>
                                            <code>{entry.host}</code>
                                            <span>{entry.directives.join(" · ")}</span>
                                        </div>
                                    ))}
                            </div>

                            <NoticeStrip>
                                {t("هذه هي سياسة المحتوى التي يفرضها المتصفّح نفسه، لا قائمةٌ نكتبها للعرض. وطلبٌ إلى مضيفٍ خارجها يفشل قبل أن يخرج من جهازك.",
                                    "This is the content policy the browser itself enforces, not a list written for display. A request to a host outside it fails before it leaves your machine.")}
                            </NoticeStrip>
                        </>
                    )}
                </Card>
            )
        },
        {
            key: "verify",
            ar: "تحقّق بنفسك", en: "Check yourself",
            render: () => <Card index={0}
                title={t("كيف تتحقّق بنفسك", "How to check for yourself")}
                subtitle={t("لا تُصدّق صفحةً تقول عن نفسها إنها آمنة — هذه طرق التحقّق.",
                    "Don't take a page's word that it is safe — here is how to check.")}>
                <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                    <div>{t("① افتح المجلد بالزرّ أعلاه وانظر ما فيه بعينك.", "① Open the folder with the button above and look at what's inside.")}</div>
                    <div>{t("② صفحة «الرصد» تسرد كل موقع يُسمح للعميل بجلب شيء منه — وما ليس فيها ممنوع.", "② The Surveillance page lists every site the client may fetch from — and anything not listed is blocked.")}</div>
                    <div>{t("③ صفحة «صلاحيات الإضافات» تقول أي إضافة تلمس ماذا.", "③ The Plugin Permissions page says which plugin touches what.")}</div>
                    <div>{t("④ ومصدر إشراق كلّه علنيّ على GitHub — كل جملة هنا يمكن مطابقتها بالكود.", "④ And Esharq's entire source is public on GitHub — every claim here can be matched against the code.")}</div>
                </div>
            </Card>
        }
    ];

    return (
        <>
            <NoticeStrip>
                {t("هذه الصفحة تُجيب سؤالين: ماذا يحفظ إشراق عنك على جهازك، وما الذي يغادر الجهاز ومتى. والأقسام أدناه تفصل الجواب فلا تطول الصفحة.",
                    "This page answers two questions: what Esharq keeps about you on your machine, and what leaves it and when. The sections below split the answer so the page stays short.")}
            </NoticeStrip>

            <SectionTabs sections={sections} />
        </>
    );
}
