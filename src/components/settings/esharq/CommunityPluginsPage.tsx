/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./communityPlugins.css";

import { checkCompatibility, getLoaded } from "@api/CommunityPlugins";
import { Settings } from "@api/Settings";
import { openPluginModal } from "@components/settings/tabs/plugins/PluginModal";
import { Switch } from "@components/Switch";
import { t } from "@utils/esharqI18n";
import { Alerts, React, useEffect, useState } from "@webpack/common";

import { Card, NoticeStrip, StatRow } from "./Card";
import { GateOverlay } from "./GateOverlay";
import { ACCENT, SURFACE, UNIT } from "./tokens";

interface Finding {
    severity: "error" | "warning";
    rule: string;
    file?: string;
    line?: number;
    message: string;
    hint?: string;
}

interface Entry {
    id: string;
    folderName: string;
    name: string;
    description: string;
    authors: string[];
    enabled: boolean;
    importedAt: string;
    hash: string;
    fileCount: number;
    bytes: number;
    sourcePath: string;
    /**
     * الوحدات الخارجية التي تطلبها — تُحسَب عند الاستيراد في العملية الرئيسية.
     * افتراضيّ فارغ لأنّ الإضافات المستورَدة قبل هذه الميزة لا تحمله.
     */
    externals: string[];
    /**
     * الأسماء المطلوبة من كل وحدة خارجية.
     * افتراضيّ غائب: ما استُورد قبل هذه الميزة لا يحمله، فيُعامَل كما كان.
     */
    importedNames?: Record<string, string[]>;
}

const native = () => (window as any).VencordNative?.communityPlugins;

function Btn({ label, tone = "plain", disabled, onClick }: {
    label: string; tone?: "accent" | "plain" | "danger"; disabled?: boolean; onClick: () => void;
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

/**
 * نتيجة الفحص حين يُرفض مجلد — **القاعدة والملفّ ورقم السطر**، لا «فشل
 * الاستيراد». من رُفض مجلده يحتاج أن يعرف أين يُصلح.
 */
function Findings({ findings }: { findings: Finding[]; }) {
    if (findings.length === 0) return null;
    return (
        <div className="esharq-cp-findings">
            {findings.map((f, i) => (
                <div key={i} className={`esharq-cp-finding ${f.severity}`}>
                    <div className="esharq-cp-finding-head">
                        <span className="esharq-cp-rule">{f.rule}</span>
                        {f.file !== undefined && (
                            <span className="esharq-cp-where">
                                {f.file}{f.line !== undefined ? `:${f.line}` : ""}
                            </span>
                        )}
                    </div>
                    <div>{f.message}</div>
                    {f.hint !== undefined && <div className="esharq-cp-hint">{f.hint}</div>}
                </div>
            ))}
        </div>
    );
}

function PluginRow({ entry, loadError, onChanged, onRescan, rescanning }: {
    entry: Entry;
    loadError?: string;
    onChanged: () => void;
    /**
     * 🔴 إعادة الفحص تُدار من **الأب** لا من الصفّ.
     *
     * مفتاح الصفّ هو `entry.id`، وهو مشتقٌّ من بصمة المصدر. فلو غيّرت إعادةُ
     * الفحص شيئاً لتغيّر المفتاح، ولفكّ React الصفّ وركّب غيره — فتضيع أي
     * حالةٍ محليّة في اللحظة التي تنجح فيها العملية بالضبط.
     */
    onRescan: (id: string) => void;
    rescanning: boolean;
}) {
    const [busy, setBusy] = useState(false);

    // كائن الإضافة المُسجَّل — لا يوجد إلّا بعد تحميلها فعلاً (أي بعد إعادة
    // التشغيل). `registeredAs` قد يختلف عن اسم المجلد حين يتعارض اسمان.
    const loadedPlugin = (() => {
        const rec = getLoaded().find(l => l.id === entry.id);
        const name = rec?.registeredAs;
        return name === undefined ? undefined : Vencord.Plugins.plugins[name];
    })();

    // يُحسَب مرّةً لكل قائمة وحدات: الخريطة ثابتة، والنتيجة لا تتغيّر إلّا
    // بإعادة الاستيراد — وهي تُبدّل `entry.externals` فتُعيد الحساب.
    const compat = React.useMemo(
        () => ((entry.externals ?? []).length === 0 ? null : checkCompatibility(entry.externals, entry.importedNames)),
        [entry.externals, entry.importedNames]
    );

    /** وحداتٌ حُلّت لكن ينقصها اسمٌ تطلبه الإضافة — تسقط عند أوّل استعمال. */
    const incompleteItems = React.useMemo(
        () => (compat?.items ?? []).filter(i => (i.missingNames?.length ?? 0) > 0),
        [compat]
    );

    const toggle = async (value: boolean) => {
        setBusy(true);
        try {
            await native()?.setEnabled(entry.id, value);
        } finally {
            setBusy(false);
            onChanged();
        }
    };

    const del = () => Alerts.show({
        title: t("حذف الإضافة", "Remove plugin"),
        body: (
            <p style={{ textAlign: "center", lineHeight: 1.7 }}>
                {t(`سيُحذف مجلد «${entry.name}» المُدار من جهازك. مجلدك الأصلي الذي استوردتَ منه لا يُمَسّ.`,
                    `The managed copy of “${entry.name}” will be deleted from your machine. The original folder you imported from is untouched.`)}
            </p>
        ),
        confirmText: t("احذف", "Remove"),
        cancelText: t("إلغاء", "Cancel"),
        onConfirm: async () => { await native()?.remove(entry.id); onChanged(); }
    });

    return (
        <div className={`esharq-cp-row${entry.enabled ? " on" : ""}`}>
            <div className="esharq-cp-main">
                <div className="esharq-cp-title">
                    <span className="esharq-cp-name">{entry.name}</span>
                    {entry.authors.length > 0 && (
                        <span className="esharq-cp-authors">{entry.authors.join(" · ")}</span>
                    )}
                </div>
                {entry.description !== "" && <div className="esharq-cp-desc">{entry.description}</div>}

                <div className="esharq-cp-meta">
                    <span title={t("مجلد المصدر", "Source folder")}>📁 {entry.folderName}</span>
                    <span>{t(`${entry.fileCount} ملفّاً`, `${entry.fileCount} files`)}</span>
                    <span>{Math.max(1, Math.round(entry.bytes / 1024))} KB</span>
                    <span className="esharq-cp-hash" title={t("بصمة المصدر", "Source hash")}>{entry.hash.slice(0, 12)}</span>
                </div>

                {/*
                  * تقرير التوافق: يُعرَض **قبل التفعيل** لا بعده.
                  *
                  * 🔴 لماذا يستحقّ مكاناً على البطاقة: إضافةٌ تطلب `fs` أو
                  * `electron` لن تعمل مهما فعل المستخدم — وقبل هذا كان يكتشف
                  * ذلك بعد تفعيلٍ وإعادة تشغيلٍ كاملة، بخطأٍ لا يقول أيّ سطر
                  * ولا أيّ وحدة. وهو تقريرٌ محليّ محض: يُحسَب من ملفّات على
                  * قرصه بخريطةٍ في حزمته، ولا يُرسَل شيءٌ إلى أحد.
                  */}
                {/* الاستبدال يُعلَن ولو كان كلّ شيء يعمل: صاحب الجهاز يستحقّ
                    أن يعرف أنّ وحدةً بُدّلت له، لا أن يكتشفه من سلوكٍ غريب. */}
                {compat !== null && compat.items.some(i => i.status === "substituted") && (
                    <div className="esharq-cp-pending">
                        <b>{t("وحداتٌ بُدّلت:", "Modules substituted:")}</b>{" "}
                        {compat.items.filter(i => i.status === "substituted").map(i => i.specifier).join(" · ")}
                        <div className="esharq-cp-compat-why">
                            {t("مُترجِم شوكةٍ أخرى لا يصل مع المجلّد. وُضع مكانه بديلٌ يُرجع النصّ الإنجليزي — وهو ما يفعله الأصل نفسه لمن لغته إنجليزية، فالإضافة تعمل كاملةً.",
                                "Another fork's translator does not ship with the folder. A stand-in returns the English text — exactly what the original does for English users, so the plugin works fully.")}
                        </div>
                    </div>
                )}

                {/* 🔴 «نظيفةٌ كذباً»: الوحدة تُحلّ والاسم ليس فيها.
                    كان التقرير يقول «سليمة» ثمّ تسقط الإضافة عند أوّل استعمال
                    على `undefined.something`. لا يُصلَح — اختراع قيمةٍ يجعلها
                    تعمل وتكذب — لكنّه يُقال **قبل** التفعيل. */}
                {incompleteItems.length > 0 && (
                    <div className="esharq-cp-error">
                        <b>{t("أسماءٌ مطلوبة لا نملكها:", "Names it needs that we don't have:")}</b>{" "}
                        <span className="esharq-cp-swap">
                            {incompleteItems.map(i => `${i.specifier} → ${(i.missingNames ?? []).join(", ")}`).join("  ·  ")}
                        </span>
                        <div className="esharq-cp-compat-why">
                            {t("الوحدة موجودة عندنا لكنّ هذه الأسماء ليست فيها — غالباً أضافتها شوكةٌ أخرى لنفسها. الإضافة ستُحمَّل ثمّ تتعثّر عند أوّل استعمالٍ لها. لا نصنع بديلاً: بديلٌ مخترَع يعمل ويكذب.",
                                "We do have the module, but not these names — most likely another fork added them for itself. The plugin will load and then fail the moment it uses one. We do not invent a stand-in: an invented one runs and lies.")}
                        </div>
                    </div>
                )}

                {compat !== null && !compat.ok && (compat.blocked > 0 || compat.missing > 0) && (
                    <div className={compat.blocked > 0 ? "esharq-cp-error" : "esharq-cp-pending"}>
                        <b>{compat.blocked > 0
                            ? t("لن تعمل كاملةً:", "Will not fully work:")
                            : t("وحداتٌ لا نعرفها:", "Modules we don't know:")}</b>{" "}
                        {compat.items.filter(i => i.status !== "ok" && i.status !== "substituted").map(i => i.specifier).join(" · ")}
                        <div className="esharq-cp-compat-why">
                            {compat.blocked > 0
                                ? t("هذه من Node أو من العملية الرئيسية، ولا تصلها أيّ إضافة داخل صفحة ديسكورد — ولا إضافات إشراق نفسها.",
                                    "These come from Node or the main process, and no plugin inside the Discord page can reach them — not even Esharq's own.")
                                : t("أسماءٌ خاصّة بشوكةٍ أخرى غالباً. استورد الإضافة التي تُكمّلها، أو احذف السطر إن كان لزينةٍ لا تُستعمل.",
                                    "Most likely names specific to another fork. Import the plugin that completes it, or delete the line if it is unused.")}
                        </div>
                    </div>
                )}

                {loadError !== undefined && (
                    <div className="esharq-cp-error">
                        <b>{t("لم تُحمَّل:", "Did not load:")}</b> {loadError}
                    </div>
                )}
                {entry.enabled && loadError === undefined && getLoaded().every(l => l.id !== entry.id) && (
                    <div className="esharq-cp-pending">
                        {t("مُفعَّلة — تعمل بعد إعادة تشغيل ديسكورد.", "Enabled — it runs after you restart Discord.")}
                    </div>
                )}
            </div>

            <div className="esharq-cp-side">
                <Switch checked={entry.enabled} disabled={busy} onChange={toggle} />
                <div className="esharq-cp-actions">
                    {/*
                      * 🔴 إضافات المجتمع تُسجَّل بـ`hidden: true` لتُدار من هنا وحدها،
                      * فلا تظهر في صفحة إضافات إشراق — ومعها اختفى **الطريق الوحيد**
                      * إلى إعداداتها. من ثبّت إضافةً لها خيارات لم يجد كيف يبلغها.
                      *
                      * يُفتَح هنا نفس المُكوّن الذي تفتحه صفحة الإضافات
                      * (`openPluginModal`) لا نافذةٌ مخترَعة: فأي خيار تدعمه تلك
                      * الصفحة يعمل هنا بلا صيانة ثانية.
                      */}
                    {loadedPlugin !== undefined && (
                        <button type="button" title={t("إعدادات الإضافة", "Plugin settings")}
                            onClick={() => openPluginModal(loadedPlugin as any)}>⚙️</button>
                    )}
                    {/*
                      * 🔴 «افحص وأصلح»: يُعاد الاستيراد من النسخة المحفوظة
                      * بمُحرّكٍ صار يعرف أكثر.
                      *
                      * ما استُورد قبل أن يتعلّم إشراق وحدةً جديدة يبقى على
                      * حاله: حزمته المبنيّة قديمة، ولا يحمل جرد الأسماء
                      * المطلوبة فلا يُفحَص فحصاً كاملاً. وكل تحديثٍ يُضيف
                      * وحدةً يجعل إضافاتٍ كانت تسقط قابلةً للعمل — بلا أن
                      * يعرف صاحبها.
                      *
                      * ويُقرأ `source/` لا مجلد المستخدم: البصمة تخرج مطابقة
                      * فالمعرّف نفسه ⇒ لا بطاقة ثانية ولا حالة تفعيلٍ تضيع،
                      * ولا يُكتب حرفٌ في مجلده.
                      */}
                    <button type="button" disabled={busy || rescanning}
                        title={t("افحص وأصلح", "Scan and fix")}
                        aria-label={t("افحص وأصلح", "Scan and fix")}
                        onClick={() => onRescan(entry.id)}>{rescanning ? "…" : "🩹"}</button>
                    <button type="button" title={t("افتح مجلد المصدر", "Open source folder")}
                        onClick={() => native()?.openFolder(entry.id)}>📂</button>
                    <button type="button" className="danger" title={t("حذف", "Remove")} onClick={del}>🗑</button>
                </div>
            </div>
        </div>
    );
}

/**
 * **صفحة إضافات المجتمع.**
 *
 * إضافات المجتمع **لا تظهر في قائمة إضافات إشراق**: تُسجَّل بـ`hidden` ويُدار
 * تفعيلها من هنا وحدها. والسبب أن خلطهما يُوهم أن إشراق يقف خلفها — وهو لا
 * يقف. هنا مكانها، وهنا يُقال من يملكها.
 */
/**
 * الصفحة خلف بوّابة: لا تُصيَّر أصلاً حتى يقرأ العضو التحذير ويسحب الشريط.
 *
 * والموافقة تُحفَظ (`Settings.communityPluginsUnlocked`) فلا تُطلَب كل زيارة،
 * ومعها زرّ إعادة قفل لمن يشارك جهازه.
 */
export function CommunityPluginsPage() {
    const [unlocked, setUnlocked] = useState(
        () => Settings.plugins.Settings?.communityPluginsUnlocked === true
    );

    if (!unlocked) {
        return (
            <GateOverlay
                unlocked={false}
                title={t("إضافات المجتمع", "Community plugins")}
                subtitle={t("قسم يُشغّل إضافات كتبها أشخاص من خارج إشراق.",
                    "A section that runs plugins written by people outside Esharq.")}
                slideLabel={t("اسحب لفتح القسم", "Slide to open the section")}
                warnings={[
                    t("هذه إضافات ليست من إشراق. نحن نوفّر الميزة التي تُشغّلها فقط — لا نكتبها ولا نُراجعها ولا نُحدّثها.",
                        "These plugins are not Esharq's. We only provide the feature that runs them — we don't write, review or update them."),
                    // 🔴 كان البند الأوّل يقول «ولا نُصلحها» — وصار العميل يُصلح
                    // فروق البنية فعلاً. تركُ الجملة يجعل وعدنا كاذباً أوّل مرّة،
                    // فتُحدَّد حدود ما نفعله بدل أن يُنفى أصله.
                    t("ونُصلح فروق البنية وحدها: أسماء وحداتٍ تختلف بين الشوكات، وصيغةَ استيرادٍ لا يفهمها مُترجِمنا. لا نُغيّر منطق الإضافة ولا نُصلح أعطالها، وما لا نعرف له مقابلاً نتركه ونقوله لك باسمه.",
                        "And we only bridge structural differences: module names that differ between forks, and an import form our compiler does not understand. We never change a plugin's logic or fix its bugs, and anything we have no counterpart for is left alone and named for you."),
                    t("الإضافة تعمل داخل ديسكورد بصلاحيات أي إضافة، فتستطيع ما تستطيعه أي إضافة. لا تُشغّل إلّا ما تثق بمصدره أنت.",
                        "A plugin runs inside Discord with the same privileges as any plugin, so it can do whatever any plugin can. Only run what you trust."),
                    t("ما تستورده يبقى على جهازك وحده: لا يُرفَع ولا يُشارَك، ولا يصل إشراق ولا أي مستخدم آخر، ولا يدخل النسخ الاحتياطية ولا المزامنة.",
                        "What you import stays on your machine alone: never uploaded or shared, never reaching Esharq or any other user, and never included in backups or sync."),
                    t("القرار قرارك وحدك، وإشراق لا يتحمّل مسؤولية ما تستورده ولا ما ينتج عنه.",
                        "The decision is yours alone. Esharq takes no responsibility for what you import, or for what comes of it.")
                ]}
                onUnlock={() => {
                    Settings.plugins.Settings.communityPluginsUnlocked = true;
                    setUnlocked(true);
                }}
            />
        );
    }

    return <CommunityPluginsContent onRelock={() => {
        Settings.plugins.Settings.communityPluginsUnlocked = false;
        setUnlocked(false);
    }} />;
}

function CommunityPluginsContent({ onRelock }: { onRelock: () => void; }) {
    const [entries, setEntries] = useState<Entry[] | null>(null);
    const [findings, setFindings] = useState<Finding[]>([]);
    const [importing, setImporting] = useState(false);
    const [justImported, setJustImported] = useState<string | null>(null);
    /** معرّف الإضافة التي يجري فحصها الآن — يُحفَظ في الأب (انظر `onRescan`). */
    const [rescanId, setRescanId] = useState<string | null>(null);
    /** حصيلة آخر فحصٍ يدويّ: ما بُدّل وما تُرك. */
    const [rescanResult, setRescanResult] = useState<{ name: string; findings: Finding[]; } | null>(null);

    const refresh = () => { native()?.list().then(setEntries).catch(() => setEntries([])); };
    useEffect(refresh, []);

    if (native() == null) {
        return (
            <NoticeStrip tone="danger">
                {t("إضافات المجتمع متاحة في تطبيق سطح المكتب فقط.", "Community plugins are available in the desktop app only.")}
            </NoticeStrip>
        );
    }

    /**
     * إعادة فحصٍ وإصلاح لإضافةٍ مستورَدة — بعد موافقةٍ صريحة.
     *
     * 🔴 لا يقع تعديلٌ بلا إذن: التعديل يمسّ نسخةً من كود شخصٍ آخر، وصاحب
     * الجهاز هو من يقرّر. والنصّ يقول حدود ما نفعله بالضبط، لا وعداً عامّاً.
     */
    const doRescan = (id: string) => {
        const entry = entries?.find(e => e.id === id);
        Alerts.show({
            title: t("سنُعدّل نسخةً من الإضافة", "We will edit a copy of the plugin"),
            body: (
                <p style={{ textAlign: "center", lineHeight: 1.75 }}>
                    {t(`الإصلاح يقع على النسخة التي يحتفظ بها إشراق. مجلدك الأصلي يُقرأ ولا يُكتَب فيه حرف.

وما يُبدَّل فروقُ البنية وحدها: اسم وحدةٍ من شوكةٍ أخرى يُوضَع مكانه ما يقابله عندنا، وصيغةُ استيرادٍ لا يفهمها مُترجِمنا. لا يُضاف منطق ولا يُحذف سطرٌ يفعل شيئاً.

وما لا نعرف له مقابلاً يبقى كما هو ويُقال لك باسمه — البديل المخترَع أسوأ من عطلٍ صريح، لأنّه يعمل ويكذب.

كل هذا على جهازك: لا يُرفَع مصدرٌ ولا يُرسَل طلب. وسترى ما تغيّر قبل أن تُفعّل شيئاً.`,
                        `The fix is applied to the copy Esharq keeps. Your original folder is read, never written to.

Only structural differences change: a module name from another fork is replaced with its counterpart here, and an import form our compiler does not understand. No logic is added, and no working line is removed.

Anything we have no counterpart for is left exactly as it is and named for you — an invented stand-in is worse than an honest failure, because it runs and lies.

All of this is on your machine: no source is uploaded and no request is sent. And you will see what changed before you enable anything.`)}
                </p>
            ),
            confirmText: t("افحص وأصلح", "Scan and fix"),
            cancelText: t("اتركها كما هي", "Leave it as it is"),
            onConfirm: async () => {
                setRescanId(id);
                setRescanResult(null);
                try {
                    const r = await native()!.rescan(id);
                    setRescanResult({ name: entry?.name ?? id, findings: r.findings ?? [] });
                } catch (e: any) {
                    setRescanResult({
                        name: entry?.name ?? id,
                        findings: [{ severity: "error", rule: "failed", message: String(e?.message ?? e) }]
                    });
                } finally {
                    setRescanId(null);
                    refresh();
                }
            }
        });
    };

    const doImport = async () => {
        setImporting(true);
        setFindings([]);
        setJustImported(null);
        try {
            const result = await native().pickAndImport();
            if (result?.cancelled) return;
            setFindings(result?.findings ?? []);
            if (result?.ok) setJustImported(result.entry?.name ?? "");
        } catch (e: any) {
            setFindings([{ severity: "error", rule: "failed", message: String(e?.message ?? e) }]);
        } finally {
            setImporting(false);
            refresh();
        }
    };

    const list = entries ?? [];
    const enabled = list.filter(e => e.enabled).length;
    const loadedNow = getLoaded();
    const errorFor = (id: string) => loadedNow.find(l => l.id === id)?.error;

    return (
        <>
            <NoticeStrip tone="danger">
                {t("هذه إضافات ليست من إشراق: لا نكتبها ولا نُراجعها ولا نُحدّثها. تعمل بصلاحيات أي إضافة داخل ديسكورد، وما تستورده يبقى على جهازك وحده. القرار قرارك.",
                    "These plugins are not Esharq's: we don't write, review or update them. They run with the same privileges as any plugin inside Discord, and what you import stays on your machine alone. The decision is yours.")}
            </NoticeStrip>

            <Card index={0}
                title={t("إضافات المجتمع", "Community plugins")}
                subtitle={t("استورد مجلد إضافة من جهازك. بلا بناء وبلا أدوات مطوّرين — تعمل بعد إعادة التشغيل.",
                    "Import a plugin folder from your machine. No build, no developer tools — it runs after a restart.")}
                badge={list.length === 0 ? t("لا شيء بعد", "None yet") : t(`${enabled} من ${list.length}`, `${enabled} of ${list.length}`)}
                badgeTone={list.length === 0 ? "warn" : enabled > 0 ? "ok" : "warn"}>

                <StatRow items={[
                    { label: t("مستورَدة", "Imported"), value: String(list.length) },
                    { label: t("مُفعَّلة", "Enabled"), value: String(enabled) },
                    { label: t("تعمل الآن", "Running now"), value: String(loadedNow.filter(l => l.error === undefined).length) },
                    { label: t("يُرفَع تلقائياً", "Uploaded automatically"), value: t("أبداً", "Never") }
                ]} />

                <div style={{ display: "flex", gap: UNIT, flexWrap: "wrap", marginTop: UNIT * 2 }}>
                    <Btn tone="accent" disabled={importing}
                        label={importing ? t("جارٍ…", "Working…") : t("استورد مجلد إضافة", "Import a plugin folder")}
                        onClick={doImport} />
                    <Btn label={t("تحديث القائمة", "Refresh")} onClick={refresh} />
                    <Btn label={t("أعد قفل القسم", "Lock the section again")} onClick={onRelock} />
                </div>

                {justImported !== null && (
                    <NoticeStrip>
                        {t(`استُوردت «${justImported}». فعّلها من الأسفل ثم أعد تشغيل ديسكورد.`,
                            `“${justImported}” was imported. Enable it below, then restart Discord.`)}
                    </NoticeStrip>
                )}

                <Findings findings={findings} />

                {/* 🔴 حصيلة الفحص اليدويّ **منفصلة** عن `findings`.
                    `Findings` يُلوّن بالخطورة وحدها، فدسّ نتائج الإصلاح فيه
                    يجعل النجاح يُعرَض بلون العطل. */}
                {rescanResult !== null && (
                    <div className="esharq-cp-rescan">
                        <NoticeStrip tone={rescanResult.findings.some(f => f.severity === "error") ? "danger" : undefined}>
                            {(() => {
                                const fixes = rescanResult.findings.filter(f => f.rule.startsWith("fix:")).length;
                                const failed = rescanResult.findings.some(f => f.severity === "error");
                                if (failed) {
                                    return t(`تعذّر فحص «${rescanResult.name}» — التفصيل أدناه.`,
                                        `“${rescanResult.name}” could not be scanned — details below.`);
                                }
                                return fixes > 0
                                    ? t(`فُحصت «${rescanResult.name}» وأُصلح ${fixes} موضعاً. أعد تشغيل ديسكورد ليسري.`,
                                        `“${rescanResult.name}” was scanned and ${fixes} places were fixed. Restart Discord for it to take effect.`)
                                    : t(`فُحصت «${rescanResult.name}» ولم نجد ما نعرف كيف نُصلحه. ما بقي مذكورٌ بسببه على بطاقتها.`,
                                        `“${rescanResult.name}” was scanned and we found nothing we know how to fix. What remains is listed with its reason on its card.`);
                            })()}
                        </NoticeStrip>
                        {/* مجلدك لا يُمَسّ — يُقال في كل مرّة، لا مرّةً في نصٍّ يُقرأ ثمّ يُنسى. */}
                        <div className="esharq-cp-compat-why">
                            {t("عُدّلت نسخة إشراق وحدها؛ مجلدك الأصلي كما تركتَه.",
                                "Only Esharq's copy was edited; your original folder is exactly as you left it.")}
                        </div>
                        <Findings findings={rescanResult.findings} />
                    </div>
                )}
            </Card>

            <Card index={1}
                title={t("المستورَدة", "Imported")}
                subtitle={t("تفعيلها وتعطيلها من هنا — ولا تظهر في قائمة إضافات إشراق.",
                    "Enable and disable them here — they never appear in the Esharq plugins list.")}>
                {entries === null ? (
                    <div className="esharq-cp-empty">{t("جارٍ القراءة…", "Reading…")}</div>
                ) : list.length === 0 ? (
                    <div className="esharq-cp-empty">
                        {t("لم تستورد شيئاً بعد. اضغط «استورد مجلد إضافة» أعلاه.",
                            "Nothing imported yet. Press “Import a plugin folder” above.")}
                    </div>
                ) : (
                    <div className="esharq-cp-list">
                        {list.map(e => (
                            <PluginRow key={e.id} entry={e} loadError={errorFor(e.id)} onChanged={refresh}
                                onRescan={doRescan} rescanning={rescanId === e.id} />
                        ))}
                    </div>
                )}
            </Card>

            <Card index={2}
                title={t("كيف تكتب إضافة تعمل هنا", "How to write a plugin that works here")}
                subtitle={t("لمن يكتب إضافته بنفسه أو يستورد إضافة كتبها غيره.",
                    "For anyone writing their own plugin, or importing one written by someone else.")}>
                <div style={{ fontSize: 13, lineHeight: 1.9 }}>
                    <div>{t("① مجلد فيه ملفّ بدايةٍ اسمه index.ts أو index.tsx.", "① A folder with an entry file named index.ts or index.tsx.")}</div>
                    <div>{t("② يُصدّر الإضافة: export default definePlugin({ name, description, authors }).", "② It exports the plugin: export default definePlugin({ name, description, authors }).")}</div>
                    <div>{t("③ استورد ما تحتاج من @utils · @api · @components · @webpack — تُحلّ حيّاً.", "③ Import what you need from @utils · @api · @components · @webpack — resolved at runtime.")}</div>
                    <div>{t("④ TypeScript وJSX مدعومان ويُحوَّلان عند الاستيراد؛ لا تحتاج بناءً.", "④ TypeScript and JSX are supported and converted at import time; no build needed.")}</div>
                </div>
                <NoticeStrip>
                    {t("وحدات Node مثل fs وchild_process لا تعمل هنا — ليس منعاً منّا، بل لأن صفحة ديسكورد تعمل بلا Node، وهذا يسري على إضافات إشراق نفسها.",
                        "Node modules such as fs and child_process do not work here — not a restriction we impose, but because Discord's page runs without Node. The same applies to Esharq's own plugins.")}
                </NoticeStrip>
            </Card>
        </>
    );
}
