/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./pluginPermissions.css";

import { type NativeBridge, type PluginScan, scanNativeBridges, scanPlugins } from "@debug/pluginScan";
import { t } from "@utils/esharqI18n";
import { useMemo, useState } from "@webpack/common";

import { Card, NoticeStrip, StatRow } from "./Card";
import { stagger } from "./motion";

/**
 * **صلاحيات الإضافات** — ماذا تلمس كل إضافة، لا كم تُكلّف.
 *
 * والفرق بينها وبين «أزمنة الإقلاع» فرقُ سؤال: تلك تسأل **كم**، وهذه تسأل
 * **ماذا**. إضافةٌ تكلّف ميلي ثانية واحدة وتملك جسراً أصلياً أخطرُ من أخرى
 * تكلّف خمسين وليس لها إلّا زرّ.
 *
 * 🔴 والترتيب **بالصلاحية لا بالاسم**: أوّل ما يُرى ما يملك جسراً أصلياً، ثم
 * ما يُرقّع شيفرة ديسكورد، ثم ما يستمع، ثم ما يرسم. القائمة الأبجدية تُخفي
 * الأخطر بين الأقل خطراً.
 */

/** ترتيب الصلاحيات من الأعلى — يُستعمل للفرز والعرض معاً. */
const CAPABILITIES = [
    {
        key: "native",
        ar: "جسر أصليّ", en: "Native bridge",
        tone: "danger" as const,
        of: (p: PluginScan) => p.nativeMethods,
        whyAr: "يتجاوز حدود المُصيِّر: يقرأ القرص ويصل الشبكة خارج سياسة المحتوى.",
        whyEn: "Goes beyond the renderer: reads the disk and reaches the network outside the content policy."
    },
    {
        key: "patches",
        ar: "ترقيع شيفرة", en: "Code patches",
        tone: "warn" as const,
        of: (p: PluginScan) => p.patches,
        whyAr: "يُعدّل شيفرة ديسكورد نفسها وقت التحميل — أوسع أثراً من أي إعداد.",
        whyEn: "Rewrites Discord's own code at load time — wider reaching than any setting."
    },
    {
        key: "listeners",
        ar: "استماع للأحداث", en: "Event listeners",
        tone: "warn" as const,
        of: (p: PluginScan) => p.listeners,
        whyAr: "يرى الأحداث وهي تجري — ومنها إرسال رسائلك وتعديلها.",
        whyEn: "Sees events as they happen — including your messages being sent and edited."
    },
    {
        key: "ui",
        ar: "حقن واجهة", en: "UI injection",
        tone: "info" as const,
        of: (p: PluginScan) => p.uiInjects,
        whyAr: "يُضيف عناصر إلى واجهة ديسكورد — أثره بصريّ.",
        whyEn: "Adds elements to Discord's interface — a visual effect."
    },
    {
        key: "commands",
        ar: "أوامر", en: "Commands",
        tone: "info" as const,
        of: (p: PluginScan) => p.commands,
        whyAr: "لا يفعل شيئاً حتى تكتب الأمر بنفسك.",
        whyEn: "Does nothing until you type the command yourself."
    }
] as const;

type CapKey = typeof CAPABILITIES[number]["key"];

/** رتبة الصلاحية العليا لهذه الإضافة — الأصغر أخطر. */
function rank(p: PluginScan): number {
    for (let i = 0; i < CAPABILITIES.length; i++) {
        if (CAPABILITIES[i].of(p) > 0) return i;
    }
    return CAPABILITIES.length;
}

function PluginRow({ scan, index }: { scan: PluginScan; index: number; }) {
    const top = rank(scan);
    const tone = top < CAPABILITIES.length ? CAPABILITIES[top].tone : "info";

    return (
        <div className={`esharq-pp-row esharq-rise tone-${tone}`} style={stagger(index, 12)}>
            <span className="esharq-pp-name">
                {scan.name}
                {scan.required && <span className="esharq-pp-flag req">{t("ضرورية", "Required")}</span>}
                {scan.hidden && <span className="esharq-pp-flag">{t("مخفيّة", "Hidden")}</span>}
            </span>

            <span className="esharq-pp-caps">
                {CAPABILITIES.map(cap => {
                    const n = cap.of(scan);
                    if (n === 0) return null;
                    return (
                        <span key={cap.key} className={`esharq-pp-cap ${cap.tone}`} title={t(cap.whyAr, cap.whyEn)}>
                            {t(cap.ar, cap.en)}
                            <b>{n}</b>
                        </span>
                    );
                })}
                {scan.pendingPatches > 0 && (
                    <span className="esharq-pp-cap pending"
                        title={t("رقعة لم تُطابق وحدتها بعد — قد تكون وحدة كسولة لم تُحمَّل، لا رقعة مكسورة.",
                            "A patch whose module hasn't matched yet — it may be a lazy module, not a broken patch.")}>
                        {t("معلّقة", "Pending")}<b>{scan.pendingPatches}</b>
                    </span>
                )}
                {rank(scan) === CAPABILITIES.length && (
                    <span className="esharq-pp-cap none">{t("لا شيء يُذكر", "Nothing notable")}</span>
                )}
            </span>

            <span className={"esharq-pp-type " + scan.type}>
                {scan.type === "continuous" ? t("مستمرّة", "Continuous") : t("عند الطلب", "On demand")}
            </span>
        </div>
    );
}

/** صفّ جسر: الاسم وعدد دوالّه، وهل إضافته مُفعَّلة الآن. */
function BridgeRow({ bridge, index }: { bridge: NativeBridge; index: number; }) {
    return (
        <div className="esharq-pp-row esharq-rise tone-danger" style={stagger(index, 12)}>
            <span className="esharq-pp-name">
                {bridge.plugin}
                {!bridge.known && <span className="esharq-pp-flag">{t("إضافة غير معروفة", "Unknown plugin")}</span>}
            </span>
            <span className="esharq-pp-caps">
                <span className="esharq-pp-cap danger">
                    {t("دالّة أصلية", "Native methods")}<b>{bridge.methods}</b>
                </span>
            </span>
            <span className={"esharq-pp-type " + (bridge.enabled ? "continuous" : "")}>
                {bridge.enabled ? t("إضافتها مُفعَّلة", "Its plugin is on") : t("معطَّلة — والجسر قائم", "Off — bridge still there")}
            </span>
        </div>
    );
}

export function PluginPermissionsPage() {
    const [filter, setFilter] = useState<"all" | CapKey | "continuous">("all");
    const [query, setQuery] = useState("");

    const scans = useMemo(() => scanPlugins(), []);

    const counts = useMemo(() => {
        const out = {} as Record<CapKey, number>;
        for (const cap of CAPABILITIES) out[cap.key] = scans.filter(s => cap.of(s) > 0).length;
        return out;
    }, [scans]);

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return scans
            .filter(s => q === "" || s.name.toLowerCase().includes(q))
            .filter(s => {
                if (filter === "all") return true;
                if (filter === "continuous") return s.type === "continuous";
                return CAPABILITIES.find(c => c.key === filter)!.of(s) > 0;
            })
            .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    }, [scans, filter, query]);

    // 🔴 كل الجسور لا جسور المُفعَّلة: الجسر يُسجَّل وقت البناء ويبقى قابلاً
    // للاستدعاء ولو كانت إضافته معطَّلة. مقيس: 25 جسراً، 19 منها لمعطَّلة.
    const bridges = useMemo(() => scanNativeBridges(), []);
    const bridgesOff = bridges.filter(b => !b.enabled);
    const continuous = scans.filter(s => s.type === "continuous").length;

    const tabs: { key: "all" | CapKey | "continuous"; label: string; count: number; }[] = [
        { key: "all", label: t("الكلّ", "All"), count: scans.length },
        ...CAPABILITIES.map(c => ({ key: c.key as CapKey, label: t(c.ar, c.en), count: counts[c.key] })),
        { key: "continuous", label: t("مستمرّة", "Continuous"), count: continuous }
    ];

    return (
        <>
            <NoticeStrip>
                {t("ماذا تلمس كل إضافة مُفعَّلة عندك — لا كم تُكلّف. مقروءةً من تعريف الإضافة نفسه لحظة فتح الصفحة.",
                    "What each of your enabled plugins touches — not what it costs. Read from the plugin's own definition the moment you open this page.")}
            </NoticeStrip>

            {bridges.length > 0 && (
                <Card index={0}
                    title={t("أعلى صلاحية: جسر أصليّ", "Highest privilege: a native bridge")}
                    subtitle={t("هذه وحدها تتجاوز حدود المُصيِّر — تقرأ القرص وتصل الشبكة خارج سياسة المحتوى.",
                        "These alone go beyond the renderer — they read the disk and reach the network outside the content policy.")}
                    badge={String(bridges.length)} badgeTone="danger">
                    <div className="esharq-pp-list">
                        {bridges.map((b, i) => <BridgeRow key={b.plugin} bridge={b} index={i} />)}
                    </div>
                    <NoticeStrip tone="danger">
                        {t(`الجسر يُسجَّل وقت البناء لا وقت التفعيل، فيبقى قابلاً للاستدعاء ولو كانت إضافته معطَّلة — و${bridgesOff.length} من ${bridges.length} هنا لإضافات معطَّلة عندك الآن. وإضافات المجتمع المستوردة لا تملك جسراً إطلاقاً.`,
                            `A bridge is registered at build time, not when a plugin is enabled, so it stays callable even while its plugin is off — and ${bridgesOff.length} of the ${bridges.length} here belong to plugins currently disabled for you. Imported community plugins never get a bridge at all.`)}
                    </NoticeStrip>
                </Card>
            )}

            <Card index={1}
                title={t("صلاحيات الإضافات", "Plugin permissions")}
                subtitle={t("مرتّبةً بالصلاحية الأعلى أوّلاً، لا بالاسم — الترتيب الأبجديّ يُخفي الأخطر بين الأقلّ.",
                    "Sorted by highest privilege first, not by name — an alphabetical list hides the riskiest among the harmless.")}
                badge={`${shown.length} / ${scans.length}`} badgeTone="info">

                <StatRow items={[
                    { label: t("مُفعَّلة", "Enabled"), value: String(scans.length) },
                    { label: t("تُرقّع الشيفرة", "Patch code"), value: String(counts.patches) },
                    { label: t("تستمع للأحداث", "Listen to events"), value: String(counts.listeners) },
                    { label: t("تعمل باستمرار", "Run continuously"), value: String(continuous) }
                ]} />

                <div className="esharq-pp-search">
                    <span aria-hidden="true">🔍</span>
                    <input type="text" value={query}
                        placeholder={t("ابحث عن إضافة…", "Search for a plugin…")}
                        aria-label={t("ابحث عن إضافة", "Search for a plugin")}
                        onChange={e => setQuery(e.currentTarget.value)} />
                    {query !== "" && <button type="button" onClick={() => setQuery("")} aria-label={t("امسح", "Clear")}>✕</button>}
                </div>

                <div className="esharq-pp-tabs" role="tablist">
                    {tabs.map(tab => (
                        <button key={tab.key} type="button" role="tab"
                            aria-selected={filter === tab.key}
                            className={filter === tab.key ? "on" : undefined}
                            onClick={() => setFilter(tab.key)}>
                            {tab.label}<span className="esharq-pp-tabcount">{tab.count}</span>
                        </button>
                    ))}
                </div>

                {shown.length === 0 ? (
                    <div className="esharq-pp-empty">{t("لا إضافة تطابق.", "No plugin matches.")}</div>
                ) : (
                    <div className="esharq-pp-list">
                        {shown.map((s, i) => <PluginRow key={s.name} scan={s} index={i} />)}
                    </div>
                )}
            </Card>

            <Card index={2}
                title={t("ماذا تعني كل صلاحية", "What each permission means")}
                subtitle={t("بلغةٍ تُقرأ، لا بأسماء حقول.", "In plain words, not field names.")}>
                <div className="esharq-pp-legend">
                    {CAPABILITIES.map(cap => (
                        <div key={cap.key} className={`esharq-pp-legend-row ${cap.tone}`}>
                            <span className={`esharq-pp-cap ${cap.tone}`}>{t(cap.ar, cap.en)}</span>
                            <span>{t(cap.whyAr, cap.whyEn)}</span>
                        </div>
                    ))}
                </div>
                <NoticeStrip>
                    {t("«مستمرّة» تعمل في الخلفية طول الجلسة. و«عند الطلب» لا تفعل شيئاً حتى تتصرّف أنت — فتكلفتها صفر ما لم تستعملها.",
                        "“Continuous” runs in the background all session. “On demand” does nothing until you act — so it costs nothing unless you use it.")}
                </NoticeStrip>
            </Card>
        </>
    );
}
