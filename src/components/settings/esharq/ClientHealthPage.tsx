/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab } from "@components/settings/tabs/BaseTab";
import { clearIssues, getDroppedIssueCount, getIssues, Issue } from "@debug/esharqErrors";
import { t } from "@utils/esharqI18n";
import { ARABIC_TABLE_GLOBAL } from "@utils/esharqLocale";
import { Margins } from "@utils/margins";
import { relaunch } from "@utils/native";
import { React, useMemo, useState } from "@webpack/common";
import { getBuildNumber, patches } from "@webpack/patcher";

import gitHash from "~git-hash";

import { Card, NoticeStrip, StatRow, StatusRow } from "./Card";
import { CopyButton } from "./CopyButton";
import { RADIUS, SURFACE, UNIT } from "./tokens";

/**
 * صحّة العميل — **ما يمكن قياسه فعلاً في بناءٍ مشحون**.
 *
 * ## 🔴 لماذا لا تُقرأ الأرقام من `reporterData`
 *
 * كان مخطّطاً أن تُبنى على `reporterData` (رقع بلا أثر · باحثات فاشلة) وعلى
 * `patchTimings`. وقراءة المصدر تقول غير ذلك:
 *
 * - `reporterData` لا يُملأ إلّا تحت **`IS_COMPANION_TEST`**
 *   (`patchWebpack.ts:578` وما بعده).
 * - `patchTimings` لا يُملأ إلّا تحت **`IS_REPORTER`** (`patchWebpack.ts:568`).
 * - و`beginTrace`/`traceFunction` دوالّ فارغة خارج `IS_DEV || IS_REPORTER`
 *   (`debug/Tracer.ts:26`).
 *
 * ⇒ في بناء المستخدم هذه **مصفوفات فارغة دائماً**. وصفحةٌ تعرض «0 رقعة
 * فاشلة» وهي لا تقيس شيئاً أسوأ من صفحة لا تعرضها: تمنح ثقةً كاذبة.
 *
 * ولذلك تُقرأ من مصدر آخر يعمل في البناء المشحون: **سجلّ المشاكل**
 * (`debug/esharqErrors.ts`)، وهو يلتقط من `Logger` نفسه — المسار الذي تمرّ
 * به الرقعة الفاشلة والباحث الفاشل والإضافة المنفجرة بلا استثناء.
 *
 * ## ما تعرضه — كلّه محسوب من حالة حيّة
 *
 * أهمّ إشارة: **إضافة مُفعَّلة لم تبدأ**. `startPlugin` يلتقط الاستثناء
 * ويُسجّله في الكونسول ويُبقي `started` على `false`
 * (`api/PluginManager.ts:238`)، فلا يرى المستخدم شيئاً — لكنّ الفرق بين
 * «مُفعَّلة في الإعدادات» و«بدأت فعلاً» يكشفه بلا أي طبقة مراقبة.
 */

interface PluginState {
    name: string;
    enabled: boolean;
    started: boolean;
    required: boolean;
    /** واجهة تخدم غيرها ولا تفعل شيئاً وحدها. */
    api: boolean;
    patchCount: number;
}

function readPlugins(): PluginState[] {
    const registry = Vencord.Plugins.plugins;
    const settings = Vencord.Settings.plugins;

    return Object.values(registry).map(plugin => ({
        name: plugin.name,
        // `required` تُشغَّل دائماً بصرف النظر عن المخزن.
        enabled: plugin.required === true || settings[plugin.name]?.enabled === true,
        started: plugin.started === true,
        required: plugin.required === true,
        // اللاحقة `API` اصطلاح ثابت في هذا المستودع (15 إضافة تحمله).
        api: plugin.name.endsWith("API"),
        patchCount: plugin.patches?.length ?? 0
    }));
}

/**
 * أسماء المجموعة كرقائق.
 *
 * 🔴 الرقم وحده لا يكفي: «99 تعمل» لا يقول **أيّها**، والمستخدم الذي يسأل
 * «ما هذه التسعة والتسعون؟» لا يجد في الصفحة جواباً. والتقسيم ثلاثةً هو
 * الجواب الحقيقي: **عشرٌ لا خيار فيها، وخمس عشرة آلةٌ تخدم غيرها، والباقي
 * ما اخترته أنت** — وهو وحده ما يُسأل عنه فعلاً.
 */
function NameGrid({ names }: { names: readonly string[]; }) {
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: UNIT, marginTop: UNIT }}>
            {names.map(name => (
                <span key={name} style={{
                    fontSize: 12,
                    padding: `2px ${UNIT}px`,
                    borderRadius: RADIUS / 2,
                    background: SURFACE[2],
                    color: "var(--text-muted)"
                }}>
                    {name}
                </span>
            ))}
        </div>
    );
}

/** أطول قائمة تُعرَض — الباقي يُقال عدده ويخرج كاملاً في النسخ. */
const SHOWN_ISSUES = 12;

const KIND_LABEL: Record<Issue["kind"], () => string> = {
    patch: () => t("رقعة", "patch"),
    find: () => t("باحث", "finder"),
    start: () => t("بدء إضافة", "plugin start"),
    render: () => t("عرض", "render"),
    other: () => t("أخرى", "other")
};

/** «قبل ٣ د» — البلاغ الذي وقع الآن يُقرأ غير الذي وقع عند الإقلاع. */
function sinceLabel(lastAt: number): string {
    const seconds = Math.max(0, Math.round((performance.now() - lastAt) / 1000));
    if (seconds < 60) return t(`قبل ${seconds} ث`, `${seconds}s ago`);
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return t(`قبل ${minutes} د`, `${minutes}m ago`);
    return t(`قبل ${Math.round(minutes / 60)} س`, `${Math.round(minutes / 60)}h ago`);
}

function IssueRow({ issue }: { issue: Issue; }) {
    const danger = issue.level === "error";

    return (
        <div style={{
            marginTop: UNIT,
            padding: UNIT,
            borderRadius: RADIUS / 2,
            background: SURFACE[2],
            borderInlineStart: `2px solid ${danger ? "var(--status-danger)" : "var(--status-warning)"}`
        }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: UNIT, alignItems: "baseline" }}>
                <strong style={{ fontSize: 13 }}>{issue.plugin ?? issue.source}</strong>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{KIND_LABEL[issue.kind]()}</span>
                {issue.count > 1 && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {t(`تكرّر ${issue.count} مرّة`, `${issue.count}×`)}
                    </span>
                )}
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginInlineStart: "auto" }}>
                    {sinceLabel(issue.lastAt)}
                </span>
            </div>
            <pre style={{
                margin: `${UNIT / 2}px 0 0`,
                fontSize: 11,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "var(--text-muted)",
                direction: "ltr",
                textAlign: "left"
            }}>{issue.message}</pre>
        </div>
    );
}

export function ClientHealthPage() {
    // نقرأ المخزن كي تُعاد الصفحة عند تبديل إضافة أو قالب.
    const settings = useSettings([
        "plugins.*", "enabledThemes", "enabledThemeLinks", "useQuickCss",
        "cloud.authenticated", "plugins.Settings.arabicMode"
    ]);

    const plugins = useMemo(readPlugins, [settings]);

    // السجلّ يتراكم بعد أوّل عرض. يُقرأ بطلبٍ لا بمؤقّت يدور في الخلفية:
    // صفحةُ تشخيصٍ تستهلك دورةً كل ثانية تصير هي نفسها عطلاً يُشتكى منه.
    const [issueTick, setIssueTick] = useState(0);
    const issues = useMemo(getIssues, [issueTick]);
    const droppedIssues = useMemo(getDroppedIssueCount, [issueTick]);
    const errorIssues = issues.filter(i => i.level === "error");
    const issueKinds = useMemo(() => {
        const counts = { patch: 0, find: 0, start: 0, render: 0, other: 0 };
        for (const issue of issues) counts[issue.kind]++;
        return counts;
    }, [issues]);

    const enabled = plugins.filter(p => p.enabled);
    // 🔴 الإشارة الأهمّ: مُفعَّلة في الإعدادات ولم تبدأ ⇒ `start()` انفجر.
    // ولا تُحتسب التي لا `start` لها: تلك «بدأت» بلا عمل تفعله.
    const stalled = enabled.filter(p => !p.started);
    const running = enabled.filter(p => p.started);
    const requiredRunning = running.filter(p => p.required);
    const apiRunning = running.filter(p => !p.required && p.api);
    const chosenRunning = running.filter(p => !p.required && !p.api);
    const patchedPlugins = enabled.filter(p => p.patchCount > 0);
    const declaredPatches = patchedPlugins.reduce((sum, p) => sum + p.patchCount, 0);

    // 🔴 `patches` **يُستهلَك ولا يُراكم**: كل رقعة تُشطَب منه فور أن تُطبَّق
    // (`patchWebpack.ts:526` و`:664`). فطولُه ليس «عدد الرقع» بل **ما ينتظر
    // وحدته بعد**، وديسكورد يُحمّل وحداته كسولاً فيبقى فيه شيء دائماً.
    // أوّل نسخة سمّته «رقع مُسجَّلة» فأعطت «21 رقعة من 272 إضافة» — رقم
    // مقلوب يبدو معقولاً حتى تُقرأ الصفحة بعناية.
    const pendingPatches = patches.length;

    const build = useMemo(() => {
        try { return String(getBuildNumber()); } catch { return t("غير معروف", "unknown"); }
    }, []);

    const arabicKeys = useMemo(() => {
        const table = (globalThis as Record<string, unknown>)[ARABIC_TABLE_GLOBAL];
        return table === null || typeof table !== "object" ? 0 : Object.keys(table).length;
    }, []);

    const themeCount = (settings.enabledThemes?.length ?? 0) + (settings.enabledThemeLinks?.length ?? 0);
    /** يخصّ تشغيل الإضافات وحده — لا يُخلط ببلاغات السجلّ. */
    const healthy = stalled.length === 0;
    const allClear = healthy && issues.length === 0;

    const platform = IS_WEB
        ? "Web"
        : IS_VESKTOP ? "Vesktop" : IS_EQUIBOP ? "Equibop" : IS_DISCORD_DESKTOP ? "Discord Desktop" : "Standalone";

    /** تقرير نصّي يُلصَق في تذكرة دعم — أنفع من وصف الحال بالكلام. */
    const report = useMemo(() => [
        `Esharq       : ${gitHash.slice(0, 7)}`,
        `Platform     : ${platform}`,
        `Discord build: ${build}`,
        `Plugins      : ${enabled.length} enabled of ${plugins.length}`,
        `Stalled      : ${stalled.length}${stalled.length ? ` (${stalled.map(p => p.name).join(", ")})` : ""}`,
        `Patches      : ${declaredPatches} declared from ${patchedPlugins.length} plugins, ${pendingPatches} pending`,
        `Themes       : ${themeCount} enabled`,
        `QuickCSS     : ${settings.useQuickCss ? "on" : "off"}`,
        `Arabic table : ${arabicKeys} keys`,
        `Cloud        : ${settings.cloud?.authenticated ? "connected" : "not connected"}`,
        `Issues       : ${issues.length} distinct, ${errorIssues.length} of them errors${droppedIssues > 0 ? `, ${droppedIssues} dropped past the cap` : ""}`,
        // القائمة كاملةً في النسخ وإن عُرض منها اثنا عشر: من ينسخ يريد كل شيء.
        ...(issues.length === 0 ? [] : [
            "",
            "--- Problem log (this session, newest first) ---",
            ...issues.map(i => `[${i.level}] ${i.plugin ?? i.source} (${i.kind}) x${i.count}: ${i.message.replace(/\n/g, " | ")}`)
        ])
    ].join("\n"), [plugins, stalled, build, arabicKeys, themeCount, settings, issues, droppedIssues]);

    return (
        <SettingsTab>
            <Card
                index={0}
                title={t("صحّة العميل", "Client health")}
                subtitle={t(
                    "ما يعمل فعلاً في هذه الجلسة: الإضافات التي بدأت، والرقع المُعلَنة، وحال ما يعتمد عليه إشراق.",
                    "What is actually running this session: which plugins started, how many patches are declared, and the state of what Esharq depends on."
                )}
                badge={allClear
                    ? t("لا خلل ظاهر", "Nothing wrong")
                    : stalled.length > 0
                        ? t(`${stalled.length} إضافة متعثّرة`, `${stalled.length} stalled`)
                        : t(`${issues.length} بلاغاً`, `${issues.length} issues`)}
                badgeTone={allClear ? "ok" : "danger"}
            />

            {!healthy && (
                <Card
                    index={1}
                    title={t("إضافات لم تبدأ", "Plugins that did not start")}
                    subtitle={t(
                        "هذه مُفعَّلة في إعداداتك لكن تشغيلها انفجر، فهي لا تفعل شيئاً الآن. والسبب مكتوب في كونسول المطوّر.",
                        "These are enabled in your settings but their start-up threw, so they are doing nothing. The reason is written in the developer console."
                    )}
                    badge={String(stalled.length)}
                    badgeTone="danger"
                >
                    <NoticeStrip tone="danger">
                        {t(
                            "إضافة تنفجر عند التشغيل لا تُظهر شيئاً للمستخدم — لا رسالة ولا علامة. هذه الصفحة هي ما يكشفها.",
                            "A plugin that throws on start shows the user nothing at all — no message, no mark. This page is what surfaces it."
                        )}
                    </NoticeStrip>
                    {stalled.map((plugin, index) => (
                        <StatusRow
                            key={plugin.name}
                            index={index}
                            title={plugin.name}
                            detail={plugin.patchCount > 0
                                ? t(`${plugin.patchCount} رقعة مُعلَنة`, `${plugin.patchCount} patches declared`)
                                : undefined}
                            state={{ text: t("لم تبدأ", "Did not start"), tone: "warn" }}
                        />
                    ))}
                </Card>
            )}

            <Card
                index={2}
                title={t("سجلّ المشاكل", "Problem log")}
                subtitle={t(
                    "كل خطأ وتحذير أبلغ عنه إشراق منذ فتح ديسكورد: رقعة لم تُحدث أثراً، باحث لم يجد وحدته، إضافة انفجرت، مكوّن انهار. يُسجَّل هنا بدل أن يمرّ في الكونسول ويضيع.",
                    "Every error and warning Esharq reported since Discord opened: a patch that had no effect, a finder that found nothing, a plugin that threw, a component that crashed. Recorded here instead of scrolling past in the console."
                )}
                badge={issues.length === 0
                    ? t("نظيف", "Clean")
                    : t(`${issues.length} بلاغاً`, `${issues.length} issues`)}
                badgeTone={errorIssues.length > 0 ? "danger" : issues.length > 0 ? "warn" : "ok"}
            >
                {issues.length === 0 ? (
                    <Paragraph color="text-subtle">
                        {t(
                            "لا شيء بعد. وهذا صادق: السجلّ يلتقط منذ لحظة الإقلاع، فخلوّه يعني أنّ شيئاً لم يُبلَّغ عنه لا أنّ القياس معطّل.",
                            "Nothing yet. And that is honest: the log captures from start-up onward, so an empty one means nothing was reported — not that measuring is off."
                        )}
                    </Paragraph>
                ) : (
                    <>
                        <StatRow items={[
                            { label: t("رقع بلا أثر", "Patches with no effect"), value: String(issueKinds.patch) },
                            { label: t("باحثات فاشلة", "Failed finders"), value: String(issueKinds.find) },
                            { label: t("إضافات انفجرت", "Plugins that threw"), value: String(issueKinds.start) },
                            { label: t("مكوّنات انهارت", "Components that crashed"), value: String(issueKinds.render) }
                        ]} />

                        {issueKinds.patch > 0 && (
                            <NoticeStrip tone="danger">
                                {t(
                                    "رقعة بلا أثر تعني أن ديسكورد غيّر الشيفرة التي كانت تُمسك بها: الإضافة تبدو مُفعَّلة وتعمل، لكن ميزتها لا تحدث. هذا أكثر ما يكسر بعد كل تحديث لديسكورد.",
                                    "A patch with no effect means Discord changed the code it was holding on to: the plugin looks enabled and running, but its feature simply does not happen. This is what breaks most after each Discord update."
                                )}
                            </NoticeStrip>
                        )}

                        {issues.slice(0, SHOWN_ISSUES).map(issue => (
                            <IssueRow key={`${issue.level}${issue.source}${issue.message}`} issue={issue} />
                        ))}

                        {issues.length > SHOWN_ISSUES && (
                            <Paragraph className={Margins.top8} color="text-subtle">
                                {t(
                                    `و${issues.length - SHOWN_ISSUES} بلاغاً آخر — تخرج كلّها في «نسخ تقرير الحالة» أسفل الصفحة.`,
                                    `And ${issues.length - SHOWN_ISSUES} more — all of them are included in "Copy status report" at the bottom of this page.`
                                )}
                            </Paragraph>
                        )}

                        {droppedIssues > 0 && (
                            <Paragraph className={Margins.top8} color="text-subtle">
                                {t(
                                    `وسقط ${droppedIssues} بلاغاً بعد امتلاء السقف. يُقال عددها بدل أن تُبتلع صامتة.`,
                                    `${droppedIssues} further reports were dropped once the cap filled. Their number is stated rather than swallowed silently.`
                                )}
                            </Paragraph>
                        )}
                    </>
                )}

                <Flex className={Margins.top16} gap={`${UNIT}px`}>
                    <Button size="small" variant="secondary" onClick={() => setIssueTick(tick => tick + 1)}>
                        {t("تحديث", "Refresh")}
                    </Button>
                    {issues.length > 0 && (
                        <Button size="small" variant="secondary" onClick={() => { clearIssues(); setIssueTick(tick => tick + 1); }}>
                            {t("إفراغ السجلّ", "Clear log")}
                        </Button>
                    )}
                </Flex>
            </Card>

            <Card
                index={3}
                title={t("نظرة سريعة", "At a glance")}
                subtitle={t(
                    "أرقام هذه الجلسة كما هي الآن.",
                    "This session's figures as they stand."
                )}
            >
                <StatRow items={[
                    {
                        label: t("إضافات تعمل", "Plugins running"),
                        value: `${enabled.length - stalled.length} / ${plugins.length}`
                    },
                    { label: t("رقع مُعلَنة", "Patches declared"), value: String(declaredPatches) },
                    { label: t("قوالب مُفعَّلة", "Themes enabled"), value: String(themeCount) },
                    { label: t("مفاتيح عربية", "Arabic keys"), value: arabicKeys.toLocaleString() }
                ]} />
            </Card>

            <Card
                index={4}
                title={t("ما الذي يعمل", "What is running")}
                subtitle={t(
                    "الرقم أعلاه مفتوحاً: عشرٌ لا خيار لك فيها، وواجهاتٌ تخدم غيرها، وما اخترته أنت.",
                    "The figure above, opened up: ten you have no say in, the interfaces that serve the rest, and what you chose yourself."
                )}
                badge={String(running.length)}
                badgeTone="ok"
            >
                <StatusRow
                    index={0}
                    title={t("ضرورية", "Required")}
                    detail={t(
                        "أساس إشراق — تُشغَّل دائماً ولا يمكن تعطيلها.",
                        "Esharq's own foundation — always started, cannot be disabled."
                    )}
                    state={{ text: String(requiredRunning.length), tone: "idle" }}
                />
                <NameGrid names={requiredRunning.map(p => p.name)} />

                <StatusRow
                    index={1}
                    title={t("واجهات", "Interfaces")}
                    detail={t(
                        "لا تفعل شيئاً وحدها؛ غيرها يبني عليها. تُفعَّل تلقائياً حين تحتاجها إضافة.",
                        "They do nothing on their own; others build on them. Enabled automatically when a plugin needs one."
                    )}
                    state={{ text: String(apiRunning.length), tone: "idle" }}
                />
                <NameGrid names={apiRunning.map(p => p.name)} />

                <StatusRow
                    index={2}
                    title={t("اخترتَها أنت", "Chosen by you")}
                    detail={t(
                        "هذه وحدها ما يُسأل عنه فعلاً — وتعطيل أيّها من صفحة الإضافات.",
                        "These are the only ones actually worth asking about — disable any of them from the Plugins page."
                    )}
                    state={{ text: String(chosenRunning.length), tone: "ok" }}
                />
                <NameGrid names={chosenRunning.map(p => p.name)} />
            </Card>

            <Card
                index={5}
                title={t("الفحوص", "Checks")}
                subtitle={t(
                    "كل سطر يُقرأ من حالة حيّة، لا من إعداد محفوظ.",
                    "Every line is read from live state, not from a stored setting."
                )}
            >
                <StatusRow
                    index={0}
                    title={t("تشغيل الإضافات", "Plugin start-up")}
                    detail={t(
                        `${enabled.length} مُفعَّلة، منها ${enabled.length - stalled.length} بدأت`,
                        `${enabled.length} enabled, ${enabled.length - stalled.length} of them started`
                    )}
                    state={healthy
                        ? { text: t("سليم", "Healthy"), tone: "ok" }
                        : { text: t("فيه خلل", "Degraded"), tone: "warn" }}
                />
                <StatusRow
                    index={1}
                    title={t("محرّك الرقع", "Patch engine")}
                    detail={t(
                        `${declaredPatches} رقعة من ${patchedPlugins.length} إضافة · ${pendingPatches} تنتظر وحدتها`,
                        `${declaredPatches} patches from ${patchedPlugins.length} plugins · ${pendingPatches} still waiting for their module`
                    )}
                    state={declaredPatches > 0
                        ? { text: t("يعمل", "Running"), tone: "ok" }
                        : { text: t("لا رقع", "No patches"), tone: "warn" }}
                />
                <StatusRow
                    index={2}
                    title={t("جدول التعريب", "Arabic message table")}
                    detail={arabicKeys > 0
                        ? t(`${arabicKeys.toLocaleString()} مفتاحاً محمّلاً`, `${arabicKeys.toLocaleString()} keys loaded`)
                        : t("لم يُحمَّل — التعريب لن يظهر", "not loaded — Arabic will not appear")}
                    state={arabicKeys > 0
                        ? { text: t("محمّل", "Loaded"), tone: "ok" }
                        : { text: t("غائب", "Missing"), tone: "warn" }}
                />
                <StatusRow
                    index={3}
                    title={t("CSS المخصّص", "Custom CSS")}
                    state={settings.useQuickCss
                        ? { text: t("مُفعَّل", "On"), tone: "ok" }
                        : { text: t("مُعطَّل", "Off"), tone: "idle" }}
                />
                <StatusRow
                    index={4}
                    title={t("المزامنة السحابية", "Cloud sync")}
                    state={settings.cloud?.authenticated
                        ? { text: t("متّصلة", "Connected"), tone: "ok" }
                        : { text: t("غير متّصلة", "Not connected"), tone: "danger" }}
                />
            </Card>

            <Card
                index={6}
                title={t("البيئة", "Environment")}
                subtitle={t(
                    "انسخ هذا حين تطلب المساعدة — يختصر أسئلةً كثيرة.",
                    "Copy this when you ask for help — it saves a lot of questions."
                )}
                badge={platform} badgeTone="info"
            >
                <StatRow items={[
                    { label: t("إصدار إشراق", "Esharq version"), value: gitHash.slice(0, 7) },
                    { label: t("بناء ديسكورد", "Discord build"), value: build },
                    { label: t("المنصّة", "Platform"), value: platform }
                ]} />

                <Flex className={Margins.top16} gap={`${UNIT}px`}>
                    <CopyButton text={report} label={t("نسخ تقرير الحالة", "Copy status report")} />
                    {!IS_WEB && (
                        <Button size="small" variant="secondary" onClick={relaunch}>
                            {t("إعادة تشغيل ديسكورد", "Restart Discord")}
                        </Button>
                    )}
                </Flex>

                {/* 🔴 حدّان يُقالان صراحةً، لئلّا يُقرأ السجلّ الفارغ أكثر ممّا
                    يعني: مداه الجلسة الواحدة، ونطاقه إشراق لا ديسكورد. */}
                <Paragraph className={Margins.top16} color="text-subtle">
                    {t(
                        "سجلّ المشاكل يبدأ من فتح ديسكورد وينتهي بإغلاقه — لا يُكتب على القرص ولا يغادر جهازك سطرٌ منه. ولا يحوي إلّا ما يُبلّغ عنه إشراق: أعطال ديسكورد نفسه لا تدخله، حتى لا يُنسب إلينا ما ليس منّا.",
                        "The problem log starts when Discord opens and ends when it closes — nothing is written to disk and not a line leaves your machine. And it holds only what Esharq itself reports: Discord's own failures stay out of it, so we are not blamed for what is not ours."
                    )}
                </Paragraph>
            </Card>
        </SettingsTab>
    );
}
