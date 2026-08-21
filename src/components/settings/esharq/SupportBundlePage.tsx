/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./supportBundle.css";

import { PlainSettings, Settings } from "@api/Settings";
import { getPluginStartups } from "@debug/esharqStartup";
import { copyToClipboard } from "@utils/clipboard";
import { t } from "@utils/esharqI18n";
import { saveFile } from "@utils/web";
import { Toasts, useMemo, useState } from "@webpack/common";
import { getBuildNumber, patches } from "@webpack/patcher";

import gitHash from "~git-hash";
import Plugins from "~plugins";

import { Card, NoticeStrip, StatRow } from "./Card";

/**
 * **حزمة الدعم** — تقرير تشخيصيّ يُقرأ قبل أن يُرسَل.
 *
 * ## القاعدة التي بُنيت عليها: قِيَم الإعدادات لا تخرج
 *
 * الطريق السهل أن نُصدّر الإعدادات كلّها ونُنقّيها بمُنقّي الأسرار. لكن ذلك
 * المُنقّي يعمل **بأسماء المفاتيح** (`token`، `apiKey`…)، فحقلٌ اسمه بريء
 * وقيمته شخصية — نصّ حالة، كلمة مرصودة، اسم مجلد — يمرّ سليماً.
 *
 * ⇒ فلا تخرج **قيمة إعداد واحدة**. يخرج بدلها: أي إضافة مُفعَّلة، وأي مفاتيح
 * غيّرها المستخدم عن الافتراضي **بأسمائها لا بقيمها**. وهذا يُجيب سؤال الدعم
 * الحقيقي — «هل غيّرتَ شيئاً؟» — بلا أن يحمل حرفاً من محتواه.
 *
 * ولا يُرفَع شيء تلقائياً. الحزمة تُبنى في الذاكرة، وتُعرَض، ولا تغادر إلّا
 * إن نسخها صاحبها بنفسه.
 */

interface Bundle {
    generatedAt: string;
    esharq: Record<string, string>;
    plugins: {
        enabled: number;
        total: number;
        stalled: string[];
        enabledNames: string[];
        changedSettings: Record<string, string[]>;
    };
    patches: { declared: number; pending: number; byPlugin: Record<string, number>; };
    startup: { measuredPlugins: number; totalMs: number; heaviest: { name: string; ms: number; }[]; };
    community: { count: number; entries: { name: string; hash: string; enabled: boolean; }[]; };
    themes: { enabledFiles: number; enabledLinks: number; quickCss: boolean; };
}

/**
 * أي مفاتيح غيّرها المستخدم عن الافتراضي — **بأسمائها لا بقيمها**.
 *
 * تُقرأ من `PlainSettings` لا من الوكيل: الوكيل يكتب الافتراضيات عند القراءة،
 * فيصير كل مفتاح «موجوداً» ولا يبقى فرق بين ما اختاره المستخدم وما وُضع له.
 */
function changedSettingKeys(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    const stored = (PlainSettings as any)?.plugins ?? {};

    for (const [pluginName, values] of Object.entries(stored)) {
        if (values === null || typeof values !== "object") continue;
        const def = (Plugins as any)[pluginName]?.settings?.def;
        const changed: string[] = [];

        for (const key of Object.keys(values)) {
            if (key === "enabled") continue;
            const setting = def?.[key];
            if (setting === undefined) continue;
            const current = (values as Record<string, unknown>)[key];
            if ("default" in setting && current !== setting.default) changed.push(key);
            else if (!("default" in setting)) changed.push(key);
        }

        if (changed.length > 0) out[pluginName] = changed.sort();
    }
    return out;
}

function buildBundle(): Bundle {
    const names = Object.keys(Plugins);
    const enabledNames = names.filter(n => Settings.plugins[n]?.enabled || Plugins[n].required);
    const stalled = enabledNames.filter(n => Plugins[n].start && !Plugins[n].started);

    const byPlugin: Record<string, number> = {};
    let declared = 0;
    for (const name of names) {
        const count = Plugins[name].patches?.length ?? 0;
        if (count > 0 && enabledNames.includes(name)) {
            byPlugin[name] = count;
            declared += count;
        }
    }

    const startups = getPluginStartups().map(r => ({ name: r.name, ms: Math.round((r.startMs + r.patchMs) * 10) / 10 }));
    startups.sort((a, b) => b.ms - a.ms);

    let community: Bundle["community"] = { count: 0, entries: [] };
    try {
        // أسماء وبصمات فقط — **لا شيء من المصدر إطلاقاً**.
        const bundles = (window as any).VencordNative?.communityPlugins?.getBundle?.() ?? [];
        community = {
            count: bundles.length,
            entries: bundles.map((b: any) => ({ name: String(b.name), hash: String(b.hash).slice(0, 16), enabled: true }))
        };
    } catch { /* غير متاح على الويب */ }

    let build = "unknown";
    try { build = String(getBuildNumber()); } catch { /* لم يُقرأ */ }

    return {
        generatedAt: new Date().toISOString(),
        esharq: {
            version: gitHash.slice(0, 7),
            platform: IS_WEB ? "Web" : IS_VESKTOP ? "Vesktop" : IS_EQUIBOP ? "Equibop" : "Discord Desktop",
            standalone: String(IS_STANDALONE),
            discordBuild: build
        },
        plugins: {
            enabled: enabledNames.length,
            total: names.length,
            stalled,
            enabledNames: [...enabledNames].sort(),
            changedSettings: changedSettingKeys()
        },
        patches: { declared, pending: patches.length, byPlugin },
        startup: {
            measuredPlugins: startups.length,
            totalMs: Math.round(startups.reduce((n, s) => n + s.ms, 0)),
            heaviest: startups.slice(0, 8)
        },
        community,
        themes: {
            enabledFiles: Settings.enabledThemes?.length ?? 0,
            enabledLinks: Settings.enabledThemeLinks?.length ?? 0,
            quickCss: Settings.useQuickCss === true
        }
    };
}

const INCLUDED = [
    ["إصدار إشراق والمنصّة وبناء ديسكورد", "Esharq version, platform and Discord build"],
    ["أسماء الإضافات المُفعَّلة وعددها", "The names and count of your enabled plugins"],
    ["أي إضافة لم تبدأ", "Which plugins failed to start"],
    ["عدد الرقع لكل إضافة", "How many patches each plugin declares"],
    ["أثقل الإضافات على الإقلاع بالميلي ثانية", "The heaviest plugins on startup, in milliseconds"],
    ["أسماء مفاتيح الإعدادات التي غيّرتها — بلا قيمها", "The names of settings you changed — without their values"],
    ["أسماء إضافات المجتمع وبصماتها — بلا مصدرها", "Community plugin names and hashes — without their source"],
    ["عدد الثيمات المُفعَّلة", "How many themes are enabled"]
] as const;

const EXCLUDED = [
    ["توكن ديسكورد أو أي مفتاح خدمة", "Your Discord token or any service key"],
    ["معرّفك أو اسمك أو أي معرّف حساب", "Your user ID, username or any account identifier"],
    ["محتوى أي رسالة", "The content of any message"],
    ["قيمة أي إعداد — الأسماء فقط تخرج", "The value of any setting — only names leave"],
    ["مصدر أي إضافة مجتمع", "The source of any community plugin"],
    ["مسارات جهازك أو روابط ثيماتك", "Your file paths or theme URLs"],
    ["أي شيء يُرفَع تلقائياً — لا شيء يغادر إلّا بنسخك أنت", "Anything uploaded automatically — nothing leaves unless you copy it"]
] as const;

export function SupportBundlePage() {
    const [expanded, setExpanded] = useState(false);
    const [bundle, setBundle] = useState(() => buildBundle());

    const text = useMemo(() => JSON.stringify(bundle, null, 2), [bundle]);
    const sizeKb = Math.max(1, Math.round(new TextEncoder().encode(text).length / 1024));

    const copy = () => {
        copyToClipboard(text);
        Toasts.show({ id: Toasts.genId(), type: Toasts.Type.SUCCESS, message: t("نُسخت حزمة الدعم", "Support bundle copied") });
    };

    const save = () => {
        const name = `esharq-support-${new Date().toISOString().slice(0, 10)}.json`;
        saveFile(new File([new TextEncoder().encode(text)], name, { type: "application/json" }));
    };

    return (
        <>
            <NoticeStrip>
                {t("تقرير تشخيصيّ يُبنى على جهازك، تقرؤه قبل أن ترسله. لا يُرفَع تلقائياً ولا يغادر إلّا إن نسخته بنفسك.",
                    "A diagnostic report built on your machine, for you to read before sending. It is never uploaded automatically and leaves only if you copy it yourself.")}
            </NoticeStrip>

            <Card index={0}
                title={t("حزمة الدعم", "Support bundle")}
                subtitle={t("ما يحتاجه من يساعدك، بلا ما لا يحتاجه.", "What someone helping you needs, without what they don't.")}
                badge={`${sizeKb} KB`} badgeTone="info">

                <StatRow items={[
                    { label: t("إضافات مُفعَّلة", "Enabled plugins"), value: `${bundle.plugins.enabled} / ${bundle.plugins.total}` },
                    { label: t("لم تبدأ", "Did not start"), value: String(bundle.plugins.stalled.length) },
                    { label: t("رقع مُعلَنة", "Declared patches"), value: String(bundle.patches.declared) },
                    { label: t("تكلفة الإقلاع", "Startup cost"), value: `${bundle.startup.totalMs} ms` }
                ]} />

                <div className="esharq-sb-actions">
                    <button type="button" className="accent" onClick={copy}>{t("انسخ الحزمة", "Copy the bundle")}</button>
                    <button type="button" onClick={save}>{t("احفظها ملفّاً", "Save as a file")}</button>
                    <button type="button" onClick={() => setBundle(buildBundle())}>{t("أعد بناءها", "Rebuild")}</button>
                </div>
            </Card>

            <Card index={1}
                title={t("ما فيها وما ليس فيها", "What is in it, and what is not")}
                subtitle={t("مكتوبةً بندًا بندًا — لا تُرسل ما لا تعرف محتواه.",
                    "Written out item by item — never send something whose contents you don't know.")}>
                <div className="esharq-sb-two">
                    <div className="esharq-sb-col in">
                        <div className="esharq-sb-colhead">{t("يخرج معها", "Included")}</div>
                        <ul>{INCLUDED.map(([ar, en], i) => <li key={i}>{t(ar, en)}</li>)}</ul>
                    </div>
                    <div className="esharq-sb-col out">
                        <div className="esharq-sb-colhead">{t("لا يخرج أبداً", "Never included")}</div>
                        <ul>{EXCLUDED.map(([ar, en], i) => <li key={i}>{t(ar, en)}</li>)}</ul>
                    </div>
                </div>
                <NoticeStrip>
                    {t("قِيَم الإعدادات لا تخرج إطلاقاً — أسماء المفاتيح التي غيّرتها فقط. لأن مُنقّي الأسرار يعمل بأسماء المفاتيح، فحقلٌ اسمه بريء وقيمته شخصية كان سيمرّ.",
                        "Setting values never leave — only the names of the keys you changed. The secret redactor works by key name, so a field with an innocent name and personal content would have slipped through.")}
                </NoticeStrip>
            </Card>

            <Card index={2}
                title={t("معاينة", "Preview")}
                subtitle={t("هذا نصّها كما هو. اقرأه قبل أن ترسله.", "This is its exact text. Read it before you send it.")}
                badge={expanded ? t("كاملة", "Full") : t("مختصرة", "Trimmed")}
                badgeTone="info">
                <pre className={"esharq-sb-pre" + (expanded ? " full" : "")}>{text}</pre>
                <button type="button" className="esharq-sb-toggle" onClick={() => setExpanded(v => !v)}>
                    {expanded ? t("اطوِ", "Collapse") : t("اعرضها كاملة", "Show it in full")}
                </button>
            </Card>
        </>
    );
}
