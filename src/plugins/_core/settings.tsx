/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { AttachmentIcon, BackupRestoreIcon, ClockIcon, CloudDownloadIcon, CloudIcon, ColorPaletteIcon, ComponentsIcon, EyeIcon, FolderIcon, HammerAndChiselIcon, HeadphonesIcon, LogIcon, LogsIcon, MagnifyingGlassIcon, MainSettingsIcon, PaintbrushIcon, PatchHelperIcon, PluginIcon, PluginsIcon, SafetyIcon, ShieldIcon, SkullIcon, UpdaterIcon, WebsiteIcon } from "@components/Icons";
import {
    BackupAndRestoreTab,
    ChangelogTab,
    CloudTab,
    PatchHelperTab,
    PluginsTab,
    ThemesTab,
    UpdaterTab,
    VencordTab,
} from "@components/settings";
import { ClientHealthPage } from "@components/settings/esharq/ClientHealthPage";
import { ComingSoon } from "@components/settings/esharq/ComingSoon";
import { CommunityPluginsPage } from "@components/settings/esharq/CommunityPluginsPage";
import { LanguagePage } from "@components/settings/esharq/LanguagePage";
import { StartupTimingsPage } from "@components/settings/esharq/StartupTimingsPage";
import { SECTION_ORDER } from "@components/settings/esharq/tokens";
import { SETTINGS_TREE } from "@components/settings/esharq/tree";
import { VoiceLabPage } from "@components/settings/esharq/VoiceLabPage";
import { gitHashShort } from "@shared/vencordUserAgent";
import { Devs } from "@utils/constants";
import { initArabicFont } from "@utils/esharqFont";
import { t } from "@utils/esharqI18n";
import { readArabicFont } from "@utils/esharqPrefs";
import { isTruthy } from "@utils/guards";
import definePlugin, { IconProps, OptionType } from "@utils/types";
import { waitFor } from "@webpack";
import { React } from "@webpack/common";
import type { ComponentType, PropsWithChildren, ReactNode } from "react";

const enum LayoutType {
    ROOT = 0,
    SECTION = 1,
    SIDEBAR_ITEM = 2,
    PANEL = 3,
    SPLIT = 4,
    CATEGORY = 5,
    ACCORDION = 6,
    LIST = 7,
    RELATED = 8,
    FIELD_SET = 9,
    TAB_ITEM = 10,
    STATIC = 11,
    BUTTON = 12,
    TOGGLE = 13,
    SLIDER = 14,
    SELECT = 15,
    RADIO = 16,
    NAVIGATOR = 17,
    CUSTOM = 18
}

let LayoutTypes = {
    SECTION: 1,
    SIDEBAR_ITEM: 2,
    PANEL: 3,
    CATEGORY: 5,
    CUSTOM: 19,
};
waitFor(["SECTION", "SIDEBAR_ITEM", "PANEL", "CUSTOM"], v => LayoutTypes = v);

const enum SectionType {
    HEADER = "HEADER",
    DIVIDER = "DIVIDER",
    CUSTOM = "CUSTOM"
}

interface SettingsLayoutNode {
    type: LayoutType;
    key?: string;
    legacySearchKey?: string;
    getLegacySearchKey?(): string;
    useLabel?(): string;
    useTitle?(): string;
    buildLayout?(): SettingsLayoutNode[];
    icon?(): ReactNode;
    render?(): ReactNode;
    StronglyDiscouragedCustomComponent?(): ReactNode;
}

interface EntryOptions {
    key: string;
    title: string;
    panelTitle?: string;
    Component: ComponentType<{}>;
    Icon: ComponentType<IconProps>;
}

interface SettingsLayoutBuilder {
    key?: string;
    buildLayout(): SettingsLayoutNode[];
}

// 🔴 `settingsLocation` حُذف عمداً: التصميم الجديد يضع أقسام إشراق **بعد
// تسجيل الخروج** دائماً (قرار المالك)، فلم يعد للمكان خيار. إبقاء القائمة
// المنسدلة كان يعني ضابطاً يحرّكه المستخدم فلا يحدث شيء.
const settings = definePluginSettings({
    // موافقة العضو على فتح صفحة إضافات المجتمع — سجلّ قرارٍ لا مفتاح يُقلَّب،
    // ولذلك `CUSTOM` فلا يظهر في صفحة الإضافات. يُفتح بالسحب ويُغلق بزرّ.
    communityPluginsUnlocked: {
        type: OptionType.CUSTOM,
        description: "",
        default: false
    },
    includeVencordInfoWhenCopying: {
        type: OptionType.BOOLEAN,
        description: "Also copy Esharq info (Esharq, Electron, Chromium) when clicking the version info in the bottom left area of the Settings page",
        default: true
    }
});

export default definePlugin({
    name: "Settings",
    description: "Adds the settings UI and debug info",
    authors: [Devs.Ven, Devs.Megu],
    tags: ["Utility"],
    required: true,

    settings,

    start() {
        // خطّ التعريب العربي: يُحقن مرّة ويطبّق الخطّ المحفوظ (Tajawal افتراضياً).
        // الخيار نفسه يسكن في إعدادات DiscordArabicizer، لكنّ التطبيق يبقى هنا (إضافة
        // أساسية دائمة التشغيل) كي يعمل الخطّ حتى لو أطفأ المستخدم إضافة التعريب.
        initArabicFont(readArabicFont());
    },

    patches: [
        {
            find: "#{intl::COPY_VERSION}",
            replacement: [
                {
                    match: /\.RELEASE_CHANNEL/,
                    replace: "$&.replace(/^./, c => c.toUpperCase())"
                },
                {
                    match: /"text-xxs\/normal".{0,300}?(?=null!=(\i)&&(.{0,20}\i\.\i.{0,200}?,children:).{0,15}?("span"),({className:\i\.\i,children:\["Build Override: ",\1\.id\]\})\)\}\))/,
                    replace: (m, _buildOverride, makeRow, component, props) => {
                        props = props.replace(/children:\[.+\]/, "");
                        return `${m},$self.makeInfoElements(${component},${props}).map(e=>${makeRow}e})),`;
                    }
                },
                {
                    match: /copyValue:\i\.join\(" "\)/g,
                    replace: "$& + $self.getInfoString()"
                }
            ]
        },
        {
            find: ".buildLayout().map",
            replacement: {
                match: /(\i)\.buildLayout\(\)(?=\.map)/,
                replace: "$self.buildLayout($1)"
            }
        }
    ],

    buildEntry(options: EntryOptions): SettingsLayoutNode {
        const { key, title, panelTitle = title, Component, Icon } = options;

        const panel: SettingsLayoutNode = {
            key: key + "_panel",
            type: LayoutTypes.PANEL,
            useTitle: () => panelTitle,
            buildLayout: () => [{
                type: LayoutTypes.CATEGORY,
                key: key + "_category",
                buildLayout: () => [{
                    type: LayoutTypes.CUSTOM,
                    key: key + "_custom",
                    Component: Component,
                    useSearchTerms: () => [title]
                }]
            }]
        };

        return ({
            key,
            type: LayoutTypes.SIDEBAR_ITEM,
            useTitle: () => title,
            icon: () => <Icon width={20} height={20} />,
            buildLayout: () => [panel]
        });
    },

    buildLayout(originalLayoutBuilder: SettingsLayoutBuilder) {
        const layout = originalLayoutBuilder.buildLayout();
        if (originalLayoutBuilder.key !== "$Root") return layout;
        if (!Array.isArray(layout)) return layout;
        if (layout.some(s => typeof s?.key === "string" && s.key.startsWith("esharq_section_"))) return layout;

        const { buildEntry } = this;

        // التصميم الجديد: 5 أقسام لا قسم واحد. كل صفحة جاهزة تُوصَل بمكوّنها
        // القائم، وكل مخطَّطة تعرض «قيد البناء». المصدر الوحيد `SETTINGS_TREE`.
        const componentFor: Record<string, ComponentType | null> = {
            VencordTab, PluginsTab, ThemesTab, UpdaterTab,
            ChangelogTab, CloudTab, BackupAndRestoreTab,
            // صفحات بناها إشراق — لا تُشتقّ من الأصل.
            LanguagePage, ClientHealthPage, VoiceLabPage, CommunityPluginsPage, StartupTimingsPage
        };
        // أيقونة مميّزة لكل صفحة — لا ترس واحد للكلّ (قرار المالك).
        const iconFor: Record<string, ComponentType<IconProps>> = {
            // الأساسيات
            "overview": MainSettingsIcon, "plugins": PluginsIcon, "themes": PaintbrushIcon,
            "theme-creator": ColorPaletteIcon, "theme-library": FolderIcon,
            // الأمان والصحّة
            "privacy-security": ShieldIcon, "plugin-permissions": SafetyIcon,
            "client-health": LogsIcon, "compatibility-matrix": ComponentsIcon,
            "crash-bisect": SkullIcon, "performance-budgets": HammerAndChiselIcon,
            "surveillance": EyeIcon,
            // التحديثات والمجتمع
            "updater": UpdaterIcon, "release-channels": CloudDownloadIcon,
            "community-plugins": PluginIcon, "changelog": LogIcon,
            // الأدوات
            "voice-lab": HeadphonesIcon, "startup-timings": ClockIcon,
            "language": WebsiteIcon, "icon-finder": MagnifyingGlassIcon,
            // البيانات والدعم
            "sync": CloudIcon, "backup-restore": BackupRestoreIcon,
            "support-bundle": AttachmentIcon
        };

        const esharqSections: SettingsLayoutNode[] = [...SETTINGS_TREE]
            // الترتيب من رموز التصميم — نفس مصدر بقيّة الهوية.
            .sort((a, b) => (SECTION_ORDER[a.id] ?? 0) - (SECTION_ORDER[b.id] ?? 0))
            .map(section => {
                const entries = section.pages.map(page => {
                    // `equicord_updater` يُخفى حين يُعطَّل المُحدِّث؛ نبقي القاعدة.
                    if (page.key === "updater" && (IS_UPDATER_DISABLED || !UpdaterTab)) return false;

                    const mapped = page.existing !== undefined ? componentFor[page.existing] : undefined;
                    const Component: ComponentType = mapped
                        ?? (() => <ComingSoon title={t(page.title.ar, page.title.en)} />);

                    return buildEntry({
                        key: `esharq_${page.key}`,
                        title: t(page.title.ar, page.title.en),
                        Component,
                        Icon: iconFor[page.key] ?? MainSettingsIcon
                    });
                }).filter(isTruthy);

                return {
                    key: `esharq_section_${section.id}`,
                    type: LayoutTypes.SECTION,
                    useTitle: () => t(section.title.ar, section.title.en),
                    buildLayout: () => entries
                } as SettingsLayoutNode;
            });

        // الإضافات المخصّصة تبقى في قسمها القديم حتى تُدمَج في التصميم لاحقاً.
        const customEntries = this.customEntries.map(buildEntry).filter(isTruthy);
        if (customEntries.length > 0 || !IS_STANDALONE && PatchHelperTab) {
            const extras: SettingsLayoutNode[] = [...customEntries];
            if (!IS_STANDALONE && PatchHelperTab) {
                extras.push(buildEntry({
                    key: "esharq_patch_helper",
                    title: t("مساعد الترقيع", "Patch Helper"),
                    Component: PatchHelperTab,
                    Icon: PatchHelperIcon
                }));
            }
            esharqSections.push({
                key: "esharq_section_developer",
                type: LayoutTypes.SECTION,
                useTitle: () => t("المطوّر", "Developer"),
                buildLayout: () => extras
            } as SettingsLayoutNode);
        }

        // 🔴 قرار المالك: أقسام إشراق **تحت تسجيل الخروج** — أي في ذيل
        // القائمة بعد كل أقسام ديسكورد. نبحث عن القسم الذي يحوي «تسجيل
        // الخروج» ونضع بعده؛ وإن لم نجده (تغيّر بنية ديسكورد) نُلحق بالذيل.
        const isLogout = (node: any): boolean => {
            const key = typeof node?.key === "string" ? node.key.toLowerCase() : "";
            if (key.includes("logout") || key.includes("log_out")) return true;
            try {
                const sub = node?.buildLayout?.();
                return Array.isArray(sub) && sub.some((child: any) =>
                    typeof child?.key === "string" && /log[_-]?out/i.test(child.key));
            } catch {
                return false;
            }
        };

        const logoutIdx = layout.findIndex(isLogout);
        const idx = logoutIdx === -1 ? layout.length : logoutIdx + 1;

        layout.splice(idx, 0, ...esharqSections);

        return layout;
    },

    customSections: [] as ((SectionTypes: Record<string, string>) => { section: string; element: ComponentType; label: string; id?: string; })[],
    customEntries: [] as EntryOptions[],

    get electronVersion() {
        return VencordNative.native.getVersions().electron ?? window.legcord?.electron ?? null;
    },

    get chromiumVersion() {
        try {
            return (
                VencordNative.native.getVersions().chrome ??
                // @ts-expect-error userAgentData types
                navigator.userAgentData?.brands?.find(
                    (b: { brand: string; }) => b.brand === "Chromium" || b.brand === "Google Chrome",
                )?.version ??
                null
            );
        } catch {
            return null;
        }
    },

    getVersionInfo(support = true) {
        let version = "";

        if (IS_DEV) version = "Dev Build";
        if (IS_WEB) version = "Web";
        if (IS_VESKTOP) version = `Vesktop v${VesktopNative.app.getVersion()}`;
        if (IS_EQUIBOP) version = `Equibop v${VesktopNative.app.getVersion()}`;
        if (IS_STANDALONE) version = "Standalone";

        return support && version ? ` (${version})` : version;
    },

    getInfoRows() {
        const { electronVersion, chromiumVersion, getVersionInfo } = this;

        const rows = [`Esharq ${gitHashShort}${getVersionInfo()}`];

        if (electronVersion) rows.push(`Electron ${electronVersion}`);
        if (chromiumVersion) rows.push(`Chromium ${chromiumVersion}`);

        return rows;
    },

    getInfoString() {
        if (!settings.store.includeVencordInfoWhenCopying) return "";
        return "\n" + this.getInfoRows().join("\n");
    },

    makeInfoElements(
        Component: ComponentType<React.PropsWithChildren>,
        props: PropsWithChildren,
    ) {
        return this.getInfoRows().map((text, i) => (
            <Component key={i} {...props}>
                {text}
            </Component>
        ));
    },
});
