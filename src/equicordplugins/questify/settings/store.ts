/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, PlainSettings, SettingsStore } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { t } from "@utils/esharqI18n";
import { OptionType } from "@utils/types";

import { QuestButtonSetting } from "../components/questButtonSettings";
import { QuestFeaturesSetting } from "../components/questFeaturesSetting";
import { QuestNotificationsSetting } from "../components/questNotificationsSetting";
import { QuestTilesSetting } from "../components/questTilesSetting";
import { ReorderQuestsSetting } from "../components/reorderQuestsSetting";
import { defaultAcknowledgedNotices, defaultAllowChangingDangerousSettings, defaultAutoCompleteQuestsSimultaneously, defaultAutoCompleteQuestTypes, defaultClaimedSubsort, defaultCompleteVideoQuestsQuicker, defaultDisableAccountPanelPromo, defaultDisableAccountPanelQuestProgress, defaultDisableFriendsListPromo, defaultDisableMembersListPromo, defaultDisableOrbsAndQuestsBadges, defaultDisableQuestsEverything, defaultDisableRelocationNotices, defaultDisableSponsoredBanner, defaultExpiredSubsort, defaultIgnoredQuestIDs, defaultIgnoredSubsort, defaultIsOnQuestsPage, defaultLastQuestPageFilters, defaultLastQuestPageSort, defaultLeftClickAction, defaultMakeMobileVideoQuestsDesktopCompatible, defaultMiddleClickAction, defaultNewExcludedQuestAlertSound, defaultNewExcludedQuestAlertVolume, defaultNewQuestAlertSound, defaultNewQuestAlertVolume, defaultNotifyOnNewExcludedQuests, defaultNotifyOnNewQuests, defaultNotifyOnQuestComplete, defaultPreventVideoQuestsPausing, defaultQuestButtonBadgeColor, defaultQuestButtonBadgeCount, defaultQuestButtonDisplay, defaultQuestButtonIncludedTypes, defaultQuestButtonIndicator, defaultQuestCompletedAlertSound, defaultQuestCompletedAlertVolume, defaultQuestFetchInterval, defaultQuestOrder, defaultQuestTileClaimedColorSetting, defaultQuestTileExpiredColorSetting, defaultQuestTileGradient, defaultQuestTileIgnoredColorSetting, defaultQuestTilePreload, defaultQuestTileUnclaimedColorSetting, defaultRememberQuestPageFilters, defaultRememberQuestPageSort, defaultResumeInterruptedQuests, defaultResumeQuestIDs, defaultRightClickAction, defaultUnclaimedSubsort, type QuestButtonAction, type QuestButtonDisplayMode, type QuestButtonIncludedTypes, type QuestButtonIndicatorMode, type QuestOrderStatus } from "./def";

const MIGRATION_TARGET = 1;
const CURRENT_SETTINGS = PlainSettings.plugins.Questify;

if (CURRENT_SETTINGS) {
    let migrationVersion = CURRENT_SETTINGS.migrationVersion ?? 0;

    // 0 -> 1: Reset Settings
    if (migrationVersion === 0) {
        PlainSettings.plugins.Questify = { enabled: CURRENT_SETTINGS.enabled, migrationVersion: 1 };
        migrationVersion = 1;
    }

    if (migrationVersion !== CURRENT_SETTINGS.migrationVersion) {
        SettingsStore.markAsChanged();
    }
}

export const settings = definePluginSettings({
    migrationVersion: {
        type: OptionType.NUMBER,
        description: t("إصدار الترحيل الحالي للإعدادات.", "The current migration version of the settings."),
        default: MIGRATION_TARGET,
        hidden: true,
    },
    acknowledgedNotices: {
        type: OptionType.CUSTOM,
        description: "One-time notices that the user has acknowledged.",
        default: { ...defaultAcknowledgedNotices },
        hidden: true,
    },
    questFeatures: {
        type: OptionType.COMPONENT,
        component: ErrorBoundary.wrap(QuestFeaturesSetting) as any,
        description: t("اختر ميزات المهام التي تريد تعطيلها.", "Choose which quest features to disable."),
    },
    disableQuestsEverything: {
        type: OptionType.BOOLEAN,
        description: t("تعطيل جميع ميزات المهام.", "Disable all quest features."),
        default: defaultDisableQuestsEverything,
        restartNeeded: true,
        hidden: true,
    },
    disableRelocationNotices: {
        type: OptionType.BOOLEAN,
        description: t("تعطيل إشعارات نقل المهام في صفحة الاكتشاف.", "Disable quest relocation notices on the Discovery page."),
        default: defaultDisableRelocationNotices,
        restartNeeded: true,
        hidden: true,
    },
    disableSponsoredBanner: {
        type: OptionType.BOOLEAN,
        description: t("تعطيل البانر الممول في صفحة المهام.", "Disable the sponsored banner on the Quests page."),
        default: defaultDisableSponsoredBanner,
        restartNeeded: true,
        hidden: true,
    },
    disableAccountPanelPromo: {
        type: OptionType.BOOLEAN,
        description: t("تعطيل نافذة المهمة المروّجة فوق لوحة الحساب.", "Disable the promoted quest popup above the account panel."),
        default: defaultDisableAccountPanelPromo,
        restartNeeded: true,
        hidden: true,
    },
    disableAccountPanelQuestProgress: {
        type: OptionType.BOOLEAN,
        description: t("تعطيل تقدم المهام النشطة والمكتملة فوق لوحة الحساب.", "Disable active and completed quest progress above the account panel."),
        default: defaultDisableAccountPanelQuestProgress,
        restartNeeded: true,
        hidden: true,
    },
    disableOrbsAndQuestsBadges: {
        type: OptionType.BOOLEAN,
        description: t("تعطيل شارة المهام في ملفات المستخدمين الشخصية.", "Disable the quests badge on user profiles."),
        default: defaultDisableOrbsAndQuestsBadges,
        restartNeeded: true,
        hidden: true,
    },
    disableFriendsListPromo: {
        type: OptionType.BOOLEAN,
        description: t("تعطيل الترويج للمهام في الألعاب التي يلعبها الأصدقاء.", "Disable quest promotion in games being played by friends."),
        default: defaultDisableFriendsListPromo,
        restartNeeded: true,
        hidden: true,
    },
    disableMembersListPromo: {
        type: OptionType.BOOLEAN,
        description: t("تعطيل أيقونة اللعب النشط في عناصر قائمة الأعضاء.", "Disable the active play icon on member list items."),
        default: defaultDisableMembersListPromo,
        restartNeeded: true,
        hidden: true,
    },
    allowChangingDangerousSettings: {
        type: OptionType.BOOLEAN,
        description: t("السماح بتغيير الإعدادات الخطرة.", "Allow changing dangerous settings."),
        default: defaultAllowChangingDangerousSettings,
        hidden: true,
    },
    resumeInterruptedQuests: {
        type: OptionType.BOOLEAN,
        description: t("استئناف الإكمال التلقائي للمهام بعد إعادة التحميل أو إعادة التشغيل.", "Resume automatic quest completion after a reload or restart."),
        default: defaultResumeInterruptedQuests,
        restartNeeded: true,
        hidden: true,
    },
    makeMobileVideoQuestsDesktopCompatible: {
        type: OptionType.BOOLEAN,
        description: t("جعل مهام الفيديو الخاصة بالجوال متوافقة مع سطح المكتب.", "Make mobile video quests compatible with desktop."),
        default: defaultMakeMobileVideoQuestsDesktopCompatible,
        restartNeeded: true,
        hidden: true,
    },
    autoCompleteQuestsSimultaneously: {
        type: OptionType.BOOLEAN,
        description: t("إكمال المهام في آن واحد بدلاً من إكمالها بالتسلسل.", "Complete quests simultaneously instead of sequentially."),
        default: defaultAutoCompleteQuestsSimultaneously,
        restartNeeded: true,
        hidden: true,
    },
    completeVideoQuestsQuicker: {
        type: OptionType.BOOLEAN,
        description: t("استخدام هامش التقدم في Discord والوقت المنقضي منذ التسجيل لإكمال مهام الفيديو تلقائياً.", "Use Discord's progress margin and time elapsed since enrollment to complete video quests faster."),
        default: defaultCompleteVideoQuestsQuicker,
        restartNeeded: true,
        hidden: true,
    },
    preventVideoQuestsPausing: {
        type: OptionType.BOOLEAN,
        description: "Prevent pausing the video when the Quest modal loses focus.",
        default: defaultPreventVideoQuestsPausing,
        restartNeeded: true,
        hidden: true,
    },
    autoCompleteQuestTypes: {
        type: OptionType.CUSTOM,
        description: t("أنواع المهام التي يتم إكمالها تلقائياً في الخلفية.", "Quest types that are automatically completed in the background."),
        default: defaultAutoCompleteQuestTypes,
        restartNeeded: true,
        hidden: true,
    },
    questButton: {
        type: OptionType.COMPONENT,
        component: ErrorBoundary.wrap(QuestButtonSetting) as any,
        description: t("تخصيص زر المهام في قائمة الخوادم.", "Customize the quests button in the server list."),
    },
    questButtonDisplay: {
        type: OptionType.CUSTOM,
        description: t("نوع العرض المستخدم لزر المهام في قائمة الخوادم.", "The display type used for the quests button in the server list."),
        default: defaultQuestButtonDisplay as QuestButtonDisplayMode,
        restartNeeded: true,
        hidden: true,
    },
    questButtonIncludedTypes: {
        type: OptionType.CUSTOM,
        description: t("أنواع المكافآت وأنواع المهام التي تُحتسب عند عرض عدد المهام على زر المهام.", "Reward types and quest types that are counted when displaying the quest count on the quests button."),
        default: defaultQuestButtonIncludedTypes as QuestButtonIncludedTypes,
        hidden: true,
    },
    questButtonIndicator: {
        type: OptionType.CUSTOM,
        description: t("نوع العرض المستخدم لمؤشر المهام غير المطالب بها على زر المهام في قائمة الخوادم.", "The display type used for the unclaimed quests indicator on the quests button in the server list."),
        default: defaultQuestButtonIndicator as QuestButtonIndicatorMode,
        hidden: true,
    },
    questButtonBadgeCount: {
        type: OptionType.NUMBER,
        description: t("العدد الحالي للمهام غير المطالب بها ذات الصلة.", "The current count of relevant unclaimed quests."),
        default: defaultQuestButtonBadgeCount,
        hidden: true,
    },
    questButtonBadgeColor: {
        type: OptionType.NUMBER | OptionType.CUSTOM,
        description: t("لون شارة زر المهام في قائمة الخوادم.", "The color of the quests button badge in the server list."),
        default: defaultQuestButtonBadgeColor as number | null,
        hidden: true,
    },
    questButtonLeftClickAction: {
        type: OptionType.CUSTOM,
        description: t("الإجراء الذي يُنفَّذ عند النقر بالزر الأيسر على زر المهام في قائمة الخوادم.", "The action performed when left-clicking the quests button in the server list."),
        default: defaultLeftClickAction as QuestButtonAction,
        hidden: true,
    },
    questButtonMiddleClickAction: {
        type: OptionType.CUSTOM,
        description: t("الإجراء الذي يُنفَّذ عند النقر بالزر الأوسط على زر المهام في قائمة الخوادم.", "The action performed when middle-clicking the quests button in the server list."),
        default: defaultMiddleClickAction as QuestButtonAction,
        hidden: true,
    },
    questButtonRightClickAction: {
        type: OptionType.CUSTOM,
        description: t("الإجراء الذي يُنفَّذ عند النقر بالزر الأيمن على زر المهام في قائمة الخوادم.", "The action performed when right-clicking the quests button in the server list."),
        default: defaultRightClickAction as QuestButtonAction,
        hidden: true,
    },
    questNotifications: {
        type: OptionType.COMPONENT,
        component: ErrorBoundary.wrap(QuestNotificationsSetting) as any,
        description: t("ضبط إشعارات اكتمال المهام واكتشاف مهام جديدة.", "Configure notifications for quest completion and new quest discovery."),
    },
    notifyOnQuestComplete: {
        type: OptionType.BOOLEAN,
        description: t("عرض إشعار عند اكتمال مهمة.", "Show a notification when a quest is completed."),
        default: defaultNotifyOnQuestComplete,
        hidden: true,
    },
    notifyOnNewQuests: {
        type: OptionType.BOOLEAN,
        description: t("عرض إشعار عند اكتشاف مهام جديدة.", "Show a notification when new quests are discovered."),
        default: defaultNotifyOnNewQuests,
        hidden: true,
    },
    notifyOnNewExcludedQuests: {
        type: OptionType.BOOLEAN,
        description: t("عرض إشعار عند اكتشاف مهام مستثناة جديدة.", "Show a notification when new excluded quests are discovered."),
        default: defaultNotifyOnNewExcludedQuests,
        hidden: true,
    },
    questCompletedAlertSound: {
        type: OptionType.STRING | OptionType.CUSTOM,
        description: t("الصوت الذي يُشغَّل عند اكتمال مهمة.", "The sound played when a quest is completed."),
        default: defaultQuestCompletedAlertSound as string | null,
        hidden: true,
    },
    questCompletedAlertVolume: {
        type: OptionType.NUMBER,
        description: t("مستوى صوت تنبيه اكتمال المهمة.", "The volume of the quest completion alert sound."),
        default: defaultQuestCompletedAlertVolume,
        hidden: true,
    },
    questFetchInterval: {
        type: OptionType.NUMBER,
        description: t("الفترة الزمنية بالثواني لجلب المهام من Discord.", "The time interval in seconds for fetching quests from Discord."),
        default: defaultQuestFetchInterval,
        hidden: true,
    },
    newQuestAlertSound: {
        type: OptionType.STRING | OptionType.CUSTOM,
        description: t("الصوت الذي يُشغَّل عند اكتشاف مهام جديدة.", "The sound played when new quests are discovered."),
        default: defaultNewQuestAlertSound as string | null,
        hidden: true,
    },
    newQuestAlertVolume: {
        type: OptionType.NUMBER,
        description: t("مستوى صوت تنبيه المهام الجديدة.", "The volume of the new quest alert sound."),
        default: defaultNewQuestAlertVolume,
        hidden: true,
    },
    newExcludedQuestAlertSound: {
        type: OptionType.STRING | OptionType.CUSTOM,
        description: t("الصوت الذي يُشغَّل عند اكتشاف مهام مستثناة جديدة.", "The sound played when new excluded quests are discovered."),
        default: defaultNewExcludedQuestAlertSound as string | null,
        hidden: true,
    },
    newExcludedQuestAlertVolume: {
        type: OptionType.NUMBER,
        description: t("مستوى صوت تنبيه المهام المستثناة الجديدة.", "The volume of the new excluded quest alert sound."),
        default: defaultNewExcludedQuestAlertVolume,
        hidden: true,
    },
    questTiles: {
        type: OptionType.COMPONENT,
        component: ErrorBoundary.wrap(QuestTilesSetting) as any,
        description: t("تخصيص مظهر بلاطات المهام في صفحة المهام.", "Customize the appearance of quest tiles on the Quests page."),
    },
    questTileUnclaimedColor: {
        type: OptionType.CUSTOM,
        description: t("لون بلاطات المهام غير المطالب بها في صفحة المهام.", "The color of unclaimed quest tiles on the Quests page."),
        default: { ...defaultQuestTileUnclaimedColorSetting },
        hidden: true,
    },
    questTileClaimedColor: {
        type: OptionType.CUSTOM,
        description: t("لون بلاطات المهام المطالب بها في صفحة المهام.", "The color of claimed quest tiles on the Quests page."),
        default: { ...defaultQuestTileClaimedColorSetting },
        hidden: true,
    },
    questTileIgnoredColor: {
        type: OptionType.CUSTOM,
        description: t("لون بلاطات المهام المتجاهلة في صفحة المهام.", "The color of ignored quest tiles on the Quests page."),
        default: { ...defaultQuestTileIgnoredColorSetting },
        hidden: true,
    },
    questTileExpiredColor: {
        type: OptionType.CUSTOM,
        description: t("لون بلاطات المهام المنتهية الصلاحية في صفحة المهام.", "The color of expired quest tiles on the Quests page."),
        default: { ...defaultQuestTileExpiredColorSetting },
        hidden: true,
    },
    questTileGradient: {
        type: OptionType.STRING,
        description: t("نمط التدرج المستخدم في بلاطات المهام.", "The gradient pattern used in quest tiles."),
        default: defaultQuestTileGradient,
        hidden: true,
    },
    questTilePreload: {
        type: OptionType.BOOLEAN,
        description: t("محاولة تحميل أصول بلاطات المهام مسبقاً.", "Attempt to preload quest tile assets."),
        default: defaultQuestTilePreload,
        hidden: true,
    },
    reorderQuests: {
        type: OptionType.COMPONENT,
        description: t("ترتيب المهام حسب حالتها.", "Order quests by their status."),
        component: ErrorBoundary.wrap(ReorderQuestsSetting) as any,
    },
    questOrder: {
        type: OptionType.CUSTOM,
        description: t("ترتيب الفرز لمجموعات حالة المهام.", "The sort order for quest status groups."),
        default: Array.from(defaultQuestOrder) as QuestOrderStatus[],
        hidden: true,
    },
    unclaimedSubsort: {
        type: OptionType.STRING,
        description: t("طريقة الترتيب الفرعي للمهام غير المطالب بها.", "The sub-sort method for unclaimed quests."),
        default: defaultUnclaimedSubsort,
        hidden: true,
    },
    claimedSubsort: {
        type: OptionType.STRING,
        description: t("طريقة الترتيب الفرعي للمهام المطالب بها.", "The sub-sort method for claimed quests."),
        default: defaultClaimedSubsort,
        hidden: true,
    },
    ignoredSubsort: {
        type: OptionType.STRING,
        description: t("طريقة الترتيب الفرعي للمهام المتجاهلة.", "The sub-sort method for ignored quests."),
        default: defaultIgnoredSubsort,
        hidden: true,
    },
    expiredSubsort: {
        type: OptionType.STRING,
        description: t("طريقة الترتيب الفرعي للمهام المنتهية الصلاحية.", "The sub-sort method for expired quests."),
        default: defaultExpiredSubsort,
        hidden: true,
    },
    isOnQuestsPage: {
        type: OptionType.BOOLEAN,
        description: t("ما إذا كان المستخدم على صفحة المهام حالياً.", "Whether the user is currently on the Quests page."),
        default: defaultIsOnQuestsPage,
        hidden: true,
    },
    rememberQuestPageSort: {
        type: OptionType.BOOLEAN,
        description: t("تذكّر آخر ترتيب فرز مستخدم في صفحة المهام.", "Remember the last sort order used on the Quests page."),
        default: defaultRememberQuestPageSort,
        hidden: true,
    },
    rememberQuestPageFilters: {
        type: OptionType.BOOLEAN,
        description: t("تذكّر آخر فلاتر مستخدمة في صفحة المهام.", "Remember the last filters used on the Quests page."),
        default: defaultRememberQuestPageFilters,
        hidden: true,
    },
    lastQuestPageSort: {
        type: OptionType.STRING,
        description: t("آخر ترتيب فرز مستخدم في صفحة المهام.", "The last sort order used on the Quests page."),
        default: defaultLastQuestPageSort,
        hidden: true,
    },
    lastQuestPageFilters: {
        type: OptionType.CUSTOM,
        description: t("آخر فلاتر مستخدمة في صفحة المهام.", "The last filters used on the Quests page."),
        default: defaultLastQuestPageFilters,
        hidden: true,
    },
    ignoredQuestIDs: {
        type: OptionType.CUSTOM,
        description: t("مصفوفة من معرّفات المهام المتجاهلة.", "An array of ignored quest IDs."),
        default: defaultIgnoredQuestIDs,
        hidden: true,
    },
    resumeQuestIDs: {
        type: OptionType.CUSTOM,
        description: t("مصفوفة من معرّفات المهام التي يجري إكمالها تلقائياً أو المُجدولة للإكمال في الخلفية.", "An array of quest IDs being auto-completed or scheduled for background completion."),
        default: defaultResumeQuestIDs,
        hidden: true,
    },
});
