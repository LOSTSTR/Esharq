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
import { t } from "@utils/esharqI18n";
import { ARABIC_TABLE_GLOBAL } from "@utils/esharqLocale";
import { Margins } from "@utils/margins";
import { relaunch } from "@utils/native";
import { React, useMemo } from "@webpack/common";
import { getBuildNumber, patches } from "@webpack/patcher";

import gitHash from "~git-hash";

import { Card, NoticeStrip, StatRow, StatusRow } from "./Card";
import { CopyButton } from "./CopyButton";
import { RADIUS, SURFACE, UNIT } from "./tokens";

/**
 * صحّة العميل — **ما يمكن قياسه فعلاً في بناءٍ مشحون**.
 *
 * ## 🔴 ما لا تعرضه هذه الصفحة، ولماذا
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

export function ClientHealthPage() {
    // نقرأ المخزن كي تُعاد الصفحة عند تبديل إضافة أو قالب.
    const settings = useSettings([
        "plugins.*", "enabledThemes", "enabledThemeLinks", "useQuickCss",
        "cloud.authenticated", "plugins.Settings.arabicMode"
    ]);

    const plugins = useMemo(readPlugins, [settings]);

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
    const healthy = stalled.length === 0;

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
        `Cloud        : ${settings.cloud?.authenticated ? "connected" : "not connected"}`
    ].join("\n"), [plugins, stalled, build, arabicKeys, themeCount, settings]);

    return (
        <SettingsTab>
            <Card
                index={0}
                title={t("صحّة العميل", "Client health")}
                subtitle={t(
                    "ما يعمل فعلاً في هذه الجلسة: الإضافات التي بدأت، والرقع المُعلَنة، وحال ما يعتمد عليه إشراق.",
                    "What is actually running this session: which plugins started, how many patches are declared, and the state of what Esharq depends on."
                )}
                badge={healthy
                    ? t("لا خلل ظاهر", "Nothing wrong")
                    : t(`${stalled.length} إضافة متعثّرة`, `${stalled.length} stalled`)}
                badgeTone={healthy ? "ok" : "danger"}
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
                index={3}
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
                index={4}
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
                index={5}
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

                {/* 🔴 يُقال صراحةً: هذه الصفحة لا تقيس فشل الرقع ولا الباحثات،
                    لأن تسجيلهما مُعطَّل في بناء المستخدم. الصمت هنا يوهم أن
                    الصفر يعني «لا فشل» وهو يعني «لم يُقَس». */}
                <Paragraph className={Margins.top16} color="text-subtle">
                    {t(
                        "لا تُحصى هنا الرقعُ التي لم تُحدث أثراً ولا الباحثات الفاشلة: تسجيلهما مُعطَّل في بناء المستخدم، وعرض صفرٍ لم يُقَس أسوأ من عدم عرضه. وهي تظهر في كونسول المطوّر عند وقوعها.",
                        "Patches that had no effect and failed finders are not counted here: their recording is disabled in user builds, and showing a zero that was never measured is worse than showing nothing. They do appear in the developer console when they happen."
                    )}
                </Paragraph>
            </Card>
        </SettingsTab>
    );
}
