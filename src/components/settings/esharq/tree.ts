/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * شجرة إعدادات إشراق — **بيانات لا واجهة**.
 *
 * اليوم كل إعدادات إشراق قسمٌ واحد فيه 8 مداخل. التصميم الجديد **5 أقسام
 * و23 صفحة**، وهذا الملف هو مصدر الحقيقة الوحيد لها: الشريط الجانبي
 * والبحث والتنقّل كلّها تقرأ من هنا، فلا يوجد مصدران يفترقان بصمت.
 *
 * ## لماذا بيانات
 *
 * شجرة مكتوبة داخل `buildLayout` لا تُختبَر ولا تُقارَن بمرجع؛ وشجرة
 * كبيانات يمكن التحقّق منها آلياً (العدد · الترتيب · اكتمال الترجمة).
 *
 * ## قاعدتان مفروضتان بالنوع
 *
 * 1. **`Localized` يوجب `ar` و`en`** ⇒ صفحة بلا عربية لا تُصرَّف.
 * 2. **`status` إلزامي** ⇒ لا تظهر صفحة في الشريط دون إعلان صريح:
 *    `ready` لها مكوّن يعمل اليوم · `planned` لم تُبنَ بعد.
 *    **الشريط لا يَعِد بما لا يوجد.**
 */

export interface Localized {
    readonly ar: string;
    readonly en: string;
}

export type SectionId =
    | "essentials"
    | "safety-health"
    | "updates-community"
    | "tools"
    | "data-support";

/** `ready` = مكوّنها موجود ويعمل اليوم · `planned` = تُبنى في التصميم الجديد. */
export type PageStatus = "ready" | "planned";

export interface SettingsPage {
    /** مفتاح ثابت — يدخل في مسار التنقّل، فلا يتغيّر بعد الإصدار. */
    readonly key: string;
    readonly title: Localized;
    readonly section: SectionId;
    readonly status: PageStatus;
    /**
     * المكوّن القائم الذي تُبنى عليه الصفحة، إن وُجد.
     * مذكور بالاسم لا بالاستيراد: هذا ملف بيانات، والربط في طبقة الواجهة.
     */
    readonly existing?: string;
}

export interface SettingsSection {
    readonly id: SectionId;
    readonly title: Localized;
    readonly pages: readonly SettingsPage[];
}

const page = (
    key: string, ar: string, en: string,
    section: SectionId, status: PageStatus, existing?: string
): SettingsPage => existing === undefined
    ? { key, title: { ar, en }, section, status }
    : { key, title: { ar, en }, section, status, existing };

export const SETTINGS_TREE: readonly SettingsSection[] = [
    {
        id: "essentials",
        title: { ar: "الأساسيات", en: "Essentials" },
        pages: [
            page("overview", "نظرة عامّة", "Overview", "essentials", "ready", "VencordTab"),
            page("plugins", "الإضافات", "Plugins", "essentials", "ready", "PluginsTab"),
            page("themes", "الثيمات", "Themes", "essentials", "ready", "ThemesTab"),
            page("theme-creator", "منشئ الثيمات", "Theme Creator", "essentials", "planned"),
            page("theme-library", "مكتبة الثيمات", "Theme Library", "essentials", "planned")
        ]
    },
    {
        id: "safety-health",
        title: { ar: "الأمان والصحّة", en: "Safety & Health" },
        pages: [
            page("privacy-security", "الخصوصية والأمان", "Privacy & Security", "safety-health", "planned"),
            page("plugin-permissions", "صلاحيات الإضافات", "Plugin Permissions", "safety-health", "planned"),
            page("client-health", "صحّة العميل", "Client Health", "safety-health", "ready", "ClientHealthPage"),
            page("compatibility-matrix", "جدول التوافق", "Compatibility Matrix", "safety-health", "planned"),
            page("crash-bisect", "تنصيف الانهيار", "Crash Bisect", "safety-health", "planned"),
            page("performance-budgets", "ميزانيات الأداء", "Performance Budgets", "safety-health", "planned"),
            page("surveillance", "الرصد", "Surveillance", "safety-health", "planned")
        ]
    },
    {
        id: "updates-community",
        title: { ar: "التحديثات والمجتمع", en: "Updates & Community" },
        pages: [
            page("updater", "المُحدِّث", "Updater", "updates-community", "ready", "UpdaterTab"),
            page("release-channels", "قنوات الإصدار", "Release Channels", "updates-community", "planned"),
            page("community-plugins", "إضافات المجتمع", "Community Plugins", "updates-community", "ready", "CommunityPluginsPage"),
            page("changelog", "سجلّ التغييرات", "Changelog", "updates-community", "ready", "ChangelogTab")
        ]
    },
    {
        id: "tools",
        title: { ar: "الأدوات", en: "Tools" },
        pages: [
            page("voice-lab", "مختبر الصوت", "Voice Lab", "tools", "ready", "VoiceLabPage"),
            page("startup-timings", "أزمنة الإقلاع", "Startup Timings", "tools", "ready", "StartupTimingsPage"),
            page("language", "اللغة", "Language", "tools", "ready", "LanguagePage"),
            page("icon-finder", "باحث الأيقونات", "Icon Finder", "tools", "ready", "IconFinderPage")
        ]
    },
    {
        id: "data-support",
        title: { ar: "البيانات والدعم", en: "Data & Support" },
        pages: [
            // 🔴 السحابة قائمة اليوم؛ والمزامنة في التصميم الجديد **محلّية**
            // بقرار المالك: ملف على الجهاز لا خدمة.
            page("sync", "المزامنة", "Sync", "data-support", "ready", "CloudTab"),
            page("backup-restore", "النسخ والاستعادة", "Backup & Restore", "data-support", "ready", "BackupAndRestoreTab"),
            page("support-bundle", "حزمة الدعم", "Support Bundle", "data-support", "ready", "SupportBundlePage")
        ]
    }
];

/** كل الصفحات بترتيب ظهورها في الشريط. */
export function allPages(): SettingsPage[] {
    return SETTINGS_TREE.flatMap(section => [...section.pages]);
}

export function findPage(key: string): SettingsPage | undefined {
    return allPages().find(p => p.key === key);
}

/**
 * الصفحات التي لها مكوّن يعمل اليوم — أوّل ما يُوصَل بالشريط الجديد.
 * ما عداها يظهر بعلامة «قيد البناء» أو لا يظهر، والقرار في طبقة الواجهة.
 */
export function readyPages(): SettingsPage[] {
    return allPages().filter(p => p.status === "ready");
}

/**
 * `PatchHelper` ليست في التصميم الجديد كصفحة مستقلّة — أداة مطوّر تُدمَج
 * لاحقاً في `Client Health`. تُذكر هنا حتى لا تُنسى عند الوصل.
 */
export const DEVELOPER_TOOLS_PENDING = ["PatchHelperTab"] as const;
