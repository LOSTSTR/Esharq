/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useSettings } from "@api/Settings";
import { downloadSettingsBackup, uploadSettingsBackup } from "@api/SettingsSync/offline";
import { Button } from "@components/Button";
import { Card, NoticeStrip } from "@components/settings/esharq/Card";
import { SURFACE, UNIT } from "@components/settings/esharq/tokens";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import { t } from "@utils/esharqI18n";
import { React } from "@webpack/common";

/**
 * النسخ والاستعادة — بتصميم بطاقات إشراق.
 *
 * 🔴 **الشريط يقول ما يفعله الكود فعلاً**: التصدير يُنقّي المفاتيح الحسّاسة
 * (`api/SettingsSync/redact`) قبل أن يغادر الملف الجهاز. لو لم يكن يفعل
 * لَما كُتب الشريط — وعدٌ بالأمان لا يفي به الكود أسوأ من لا وعد، لأنه
 * يدفع المستخدم إلى مشاركة الملف باطمئنان.
 */

/** أنواع المحتوى في النسخة — الشارات وأزرار الاستيراد والتصدير تقرأ منها. */
const PARTS = [
    { key: "plugins", ar: "إعدادات الإضافات", en: "Plugin settings" },
    { key: "css", ar: "CSS المخصّص", en: "Custom CSS" },
    { key: "datastore", ar: "بيانات المخزن", en: "DataStore data" }
] as const;

function Chip({ children }: { children: React.ReactNode; }) {
    return (
        <span style={{
            fontSize: 12,
            padding: `4px ${UNIT * 1.5}px`,
            borderRadius: 6,
            background: SURFACE[2],
            color: "var(--text-muted)"
        }}>
            {children}
        </span>
    );
}

function Row({ children }: { children: React.ReactNode; }) {
    return <div style={{ display: "flex", gap: UNIT, flexWrap: "wrap" }}>{children}</div>;
}

function BackupAndRestoreTab() {
    useSettings(["plugins.Settings.arabicMode"]);

    return (
        <SettingsTab>
            <Card
                index={0}
                title={t("النسخ والاستعادة", "Backup & Restore")}
                subtitle={t(
                    "انقل إعدادات إشراق بين أجهزتك، أو احتفظ بنسخة تعود إليها.",
                    "Move your Esharq settings between devices, or keep a copy you can return to."
                )}
                badge={t("ملف JSON محلّي", "Local JSON")} badgeTone="info"
            />

            <NoticeStrip>
                {t(
                    "المفاتيح الحسّاسة (مفاتيح الخدمات والرموز وعناوين الخطّافات) تُستثنى من كل تصدير تلقائياً — تُستبدل قيمتها ويبقى اسمها لتعرف ما عليك إعادة إدخاله بعد الاستعادة.",
                    "Sensitive values — service keys, tokens, webhook URLs — are excluded from every export automatically. The value is replaced and the name kept, so you know what to re-enter after restoring."
                )}
            </NoticeStrip>

            <Card
                index={1}
                title={t("محتوى النسخة", "What a backup holds")}
                subtitle={t(
                    "تستطيع أخذ نسخة كاملة، أو جزءاً بعينه.",
                    "Take a complete copy, or just one part of it."
                )}
            >
                <Row>{PARTS.map(part => <Chip key={part.key}>{t(part.ar, part.en)}</Chip>)}</Row>
            </Card>

            <Card
                index={2}
                title={t("الاستيراد", "Import")}
                subtitle={t(
                    "اختر ملفاً صدّرته سابقاً لاستعادة إعداداتك منه.",
                    "Choose a file you exported earlier to restore your settings from it."
                )}
            >
                <NoticeStrip tone="danger">
                    {t(
                        "الاستيراد يستبدل الأجزاء المختارة من إعداداتك الحالية. صدّر نسخة أوّلاً إن كنت قد تحتاج الرجوع.",
                        "Importing replaces the selected parts of your current settings. Export a copy first if you might need to go back."
                    )}
                </NoticeStrip>
                <Row>
                    <Button className="esharq-press" variant="secondary" size="small" onClick={() => uploadSettingsBackup("all")}>
                        {t("استيراد الكل", "Import everything")}
                    </Button>
                    {PARTS.map(part => (
                        <Button key={part.key} className="esharq-press" size="small" onClick={() => uploadSettingsBackup(part.key)}>
                            {t(part.ar, part.en)}
                        </Button>
                    ))}
                </Row>
            </Card>

            <Card
                index={3}
                title={t("التصدير", "Export")}
                subtitle={t(
                    "نزّل إعداداتك الحالية ملفاً واحداً — منقّىً من المفاتيح الحسّاسة.",
                    "Download your current settings as a single file, with sensitive values stripped."
                )}
            >
                <Row>
                    <Button className="esharq-press" variant="secondary" size="small" onClick={() => downloadSettingsBackup("all")}>
                        {t("تصدير الكل", "Export everything")}
                    </Button>
                    {PARTS.map(part => (
                        <Button key={part.key} className="esharq-press" size="small" onClick={() => downloadSettingsBackup(part.key)}>
                            {t(part.ar, part.en)}
                        </Button>
                    ))}
                </Row>
            </Card>
        </SettingsTab>
    );
}

export default wrapTab(BackupAndRestoreTab, "Backup & Restore");
