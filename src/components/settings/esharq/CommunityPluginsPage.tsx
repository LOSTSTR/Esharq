/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./communityPlugins.css";

import { getLoaded } from "@api/CommunityPlugins";
import { Settings } from "@api/Settings";
import { openPluginModal } from "@components/settings/tabs/plugins/PluginModal";
import { Switch } from "@components/Switch";
import { t } from "@utils/esharqI18n";
import { Alerts, useEffect, useState } from "@webpack/common";

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

function PluginRow({ entry, loadError, onChanged }: {
    entry: Entry;
    loadError?: string;
    onChanged: () => void;
}) {
    const [busy, setBusy] = useState(false);

    // كائن الإضافة المُسجَّل — لا يوجد إلّا بعد تحميلها فعلاً (أي بعد إعادة
    // التشغيل). `registeredAs` قد يختلف عن اسم المجلد حين يتعارض اسمان.
    const loadedPlugin = (() => {
        const rec = getLoaded().find(l => l.id === entry.id);
        const name = rec?.registeredAs;
        return name === undefined ? undefined : Vencord.Plugins.plugins[name];
    })();

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
                    t("هذه إضافات ليست من إشراق. نحن نوفّر الميزة التي تُشغّلها فقط — لا نكتبها ولا نُراجعها ولا نُحدّثها ولا نُصلحها.",
                        "These plugins are not Esharq's. We only provide the feature that runs them — we don't write, review, update or fix them."),
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

    const refresh = () => { native()?.list().then(setEntries).catch(() => setEntries([])); };
    useEffect(refresh, []);

    if (native() == null) {
        return (
            <NoticeStrip tone="danger">
                {t("إضافات المجتمع متاحة في تطبيق سطح المكتب فقط.", "Community plugins are available in the desktop app only.")}
            </NoticeStrip>
        );
    }

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
                            <PluginRow key={e.id} entry={e} loadError={errorFor(e.id)} onChanged={refresh} />
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
