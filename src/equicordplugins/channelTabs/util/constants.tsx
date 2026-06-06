/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, useSettings } from "@api/Settings";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { ChannelTabsPreview } from "@equicordplugins/channelTabs/components/ChannelTabsContainer";
import { KeybindSettings } from "@equicordplugins/channelTabs/components/KeybindSettings";
import { t } from "@utils/esharqI18n";
import { Logger } from "@utils/Logger";
import { makeRange, OptionType } from "@utils/types";
import { SearchableSelect, useState } from "@webpack/common";
import { JSX } from "react";

interface DynamicDropdownSettingOption {
    label: string;
    value: string;
    selected: boolean;
}

function AnimationSettings(): JSX.Element {
    useSettings(["plugins.Settings.arabicMode"]);
    const animationOptions: DynamicDropdownSettingOption[] = [
        { label: t("تأثيرات التمرير فوق التبويب (رفع + تكبير)", "Tab hover effects (lift + scale)"), value: "hover", selected: settings.store.animationHover },
        { label: t("حركة رفع التبويب المحدد", "Selected tab lift animation"), value: "selection", selected: settings.store.animationSelection },
        { label: t("سحب وإفلات التبويب (شبح + إعادة ترتيب)", "Tab drag & drop (ghost + reorder)"), value: "drag-drop", selected: settings.store.animationDragDrop },
        { label: t("انزلاق دخول/خروج التبويب (إنشاء + إغلاق)", "Tab enter/exit slide (create + close)"), value: "enter-exit", selected: settings.store.animationEnterExit },
        { label: t("تكبير الأيقونة عند التحديد", "Icon pop on selection"), value: "icon-pop", selected: settings.store.animationIconPop },
        { label: t("دوران زر الإغلاق", "Close button rotation"), value: "close-rotation", selected: settings.store.animationCloseRotation },
        { label: t("نبضة زر الإضافة (+)", "Add button (+) pulse"), value: "plus-pulse", selected: settings.store.animationPlusPulse },
        { label: t("توهج شارة الإشارة", "Mention badge glow"), value: "mention-glow", selected: settings.store.animationMentionGlow },
        { label: t("توسّع الوضع المضغوط", "Compact mode expand"), value: "compact-expand", selected: settings.store.animationCompactExpand },
        { label: t("حد أزرق للتبويب المحدد", "Blue border for selected tab"), value: "selected-border", selected: settings.store.animationSelectedBorder },
        { label: t("لون خلفية التبويب المحدد", "Selected tab background color"), value: "selected-background", selected: settings.store.animationSelectedBackground },
        { label: t("تأثيرات ظل التبويب", "Tab shadow effects"), value: "tab-shadows", selected: settings.store.animationTabShadows },
        { label: t("إعادة تموضع التبويب (انتقالات سلسة)", "Tab repositioning (smooth transitions)"), value: "tab-positioning", selected: settings.store.animationTabPositioning },
        { label: t("تلاشي مقبض تغيير الحجم", "Resize handle fade"), value: "resize-handle", selected: settings.store.animationResizeHandle },
        { label: t("تدرج تبويب المهام النشطة", "Active quests tab gradient"), value: "quests-active", selected: settings.store.animationQuestsActive }
    ];

    const [currentValue, setCurrentValue] = useState(animationOptions.filter(option => option.selected).map(option => option.value));

    function updateSettingsTruthy(enabledValues: string[]) {
        animationOptions.forEach(option => {
            option.selected = enabledValues.includes(option.value);
        });

        settings.store.animationHover = enabledValues.includes("hover");
        settings.store.animationSelection = enabledValues.includes("selection");
        settings.store.animationDragDrop = enabledValues.includes("drag-drop");
        settings.store.animationEnterExit = enabledValues.includes("enter-exit");
        settings.store.animationIconPop = enabledValues.includes("icon-pop");
        settings.store.animationCloseRotation = enabledValues.includes("close-rotation");
        settings.store.animationPlusPulse = enabledValues.includes("plus-pulse");
        settings.store.animationMentionGlow = enabledValues.includes("mention-glow");
        settings.store.animationCompactExpand = enabledValues.includes("compact-expand");
        settings.store.animationSelectedBorder = enabledValues.includes("selected-border");
        settings.store.animationSelectedBackground = enabledValues.includes("selected-background");
        settings.store.animationTabShadows = enabledValues.includes("tab-shadows");
        settings.store.animationTabPositioning = enabledValues.includes("tab-positioning");
        settings.store.animationResizeHandle = enabledValues.includes("resize-handle");
        settings.store.animationQuestsActive = enabledValues.includes("quests-active");

        setCurrentValue(enabledValues);
    }

    function handleChange(values: Array<DynamicDropdownSettingOption | string>) {
        const valueStrings = values.map(v => typeof v === "string" ? v : v.value);
        const toggled = valueStrings.length > currentValue.length
            ? valueStrings.find(v => !currentValue.includes(v))
            : currentValue.find(v => !valueStrings.includes(v));

        if (toggled == null) {
            updateSettingsTruthy(valueStrings);
            return;
        }

        if (currentValue.includes(toggled)) {
            updateSettingsTruthy(currentValue.filter(v => v !== toggled));
        } else {
            updateSettingsTruthy([...currentValue, toggled]);
        }
    }

    return (
        <section>
            <Heading>{t("عناصر التحكّم بالحركة", "Animation Controls")}</Heading>
            <Paragraph>{t("فعّل أو عطّل رسوماً متحركة معيّنة لتبويبات القنوات. كل خيار يمكن تبديله على حدة.", "Enable or disable specific animations for channel tabs. Each option can be toggled independently.")}</Paragraph>
            <div style={{ marginTop: "8px" }}>
                <SearchableSelect
                    placeholder={t("اختر الرسوم المتحركة لتفعيلها...", "Select which animations to enable...")}
                    maxVisibleItems={12}
                    clearable={true}
                    multi={true}
                    value={currentValue}
                    options={animationOptions}
                    onChange={handleChange}
                    closeOnSelect={false}
                />
            </div>
        </section>
    );
}

export const logger = new Logger("ChannelTabs");

export const bookmarkFolderColors = {
    Red: "#f23f42",
    Blue: "#0052b6",
    Yellow: "#f0b132",
    Green: "#24934f",
    Black: "#000",
    White: "#fff",
    Orange: "#e67e22",
    Pink: "#ff73fa"
} as const;

export const settings = definePluginSettings({
    onStartup: {
        type: OptionType.SELECT,
        description: t("عند بدء التشغيل", "On startup"),
        options: [{
            label: t("لا تفعل شيئاً (الفتح على تبويب الأصدقاء)", "Do nothing (open on the friends tab)"),
            value: "nothing",
            default: true
        }, {
            label: t("تذكّر التبويبات من الجلسة السابقة", "Remember tabs from last session"),
            value: "remember"
        }, {
            label: t("الفتح على مجموعة تبويبات محدّدة", "Open on a specific set of tabs"),
            value: "preset"
        }],
    },
    tabSet: {
        component: ChannelTabsPreview,
        type: OptionType.COMPONENT,
        default: {}
    },
    noPomeloNames: {
        description: t("استخدام الأسماء المعروضة بدلاً من أسماء المستخدمين في الرسائل المباشرة", "Use display names instead of usernames in direct messages"),
        type: OptionType.BOOLEAN,
        default: false
    },
    showStatusIndicators: {
        description: t("إظهار مؤشرات الحالة في الرسائل المباشرة", "Show status indicators in direct messages"),
        type: OptionType.BOOLEAN,
        default: true
    },
    showBookmarkBar: {
        description: "",
        type: OptionType.BOOLEAN,
        default: true
    },
    bookmarkNotificationDot: {
        description: t("إظهار نقطة الإشعار للإشارات المرجعية", "Show notification dot for bookmarks"),
        type: OptionType.BOOLEAN,
        default: true
    },
    persistUnreadCountFallback: {
        description: t("الحفاظ على شارات الرسائل غير المقروءة الاحتياطية عبر إعادة التحميل للتبويبات والإشارات المرجعية", "Persist fallback unread count badges across reloads for tabs and bookmarks"),
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: false
    },
    widerTabsAndBookmarks: {
        description: t("تمديد طول التبويبات والإشارات المرجعية للشاشات الكبيرة", "Extend the width of tabs and bookmarks for larger screens"),
        type: OptionType.BOOLEAN,
        default: false,
        restartNeeded: false
    },
    tabWidthScale: {
        type: OptionType.NUMBER,
        description: t("مقياس عرض التبويب (نسبة مئوية) - قابل للتعديل بسحب حواف التبويب", "Tab width scale (percentage) - adjustable by dragging tab edges"),
        default: 100,
        hidden: true,
        restartNeeded: false
    },
    tabHeightScale: {
        type: OptionType.NUMBER,
        description: t("مقياس ارتفاع التبويب (نسبة مئوية).", "Tab height scale (percentage)."),
        default: 100,
        restartNeeded: false
    },
    renderAllTabs: {
        type: OptionType.BOOLEAN,
        description: t("الاحتفاظ بجميع التبويبات في الذاكرة المؤقتة للتبديل الأسرع (يحفظ موضع التمرير والحالة)", "Keep all tabs in memory cache for faster switching (preserves scroll position and state)"),
        default: false,
        restartNeeded: false
    },
    switchToExistingTab: {
        type: OptionType.BOOLEAN,
        description: t("التبديل إلى التبويب إذا كان موجوداً للقناة التي تنتقل إليها", "Switch to an existing tab if one exists for the channel you are navigating to"),
        default: false,
        restartNeeded: false
    },
    createNewTabIfNotExists: {
        type: OptionType.BOOLEAN,
        description: t("إنشاء تبويب جديد إذا لم يكن موجوداً للقناة التي تنتقل إليها", "Create a new tab if one does not exist for the channel you are navigating to"),
        default: false,
        restartNeeded: false
    },
    enableRapidNavigation: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل سلوك التنقل السريع - التنقل السريع بين القنوات سيستبدل التبويب الحالي بدلاً من إنشاء تبويبات جديدة", "Enable rapid navigation behavior - quickly navigating between channels will replace the current tab instead of creating new ones"),
        default: false,
        restartNeeded: false
    },
    rapidNavigationThreshold: {
        type: OptionType.SLIDER,
        description: t("النافذة الزمنية (بالثواني) للتنقل السريع. خلال هذا الوقت، تستبدل القنوات الجديدة التبويب الحالي بدلاً من إنشاء تبويبات جديدة.", "The time window (in seconds) for rapid navigation. Within this time, new channels replace the current tab instead of creating new ones."),
        markers: [1, 2, 3, 5, 10, 20, 30, 40, 50, 60],
        default: 3,
        stickToMarkers: false,
    },
    tabBarPosition: {
        type: OptionType.SELECT,
        description: t("مكان إظهار شريط التبويبات.", "Where to display the tab bar."),
        options: [
            { label: t("أعلى", "Top"), value: "top", default: true },
            { label: t("أسفل", "Bottom"), value: "bottom" }
        ],
        restartNeeded: true
    },
    enableNumberKeySwitching: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل مفاتيح الأرقام (1-9) للتبديل بين التبويبات", "Enable number keys (1-9) for switching between tabs"),
        default: true,
        restartNeeded: false
    },
    numberKeySwitchCount: {
        type: OptionType.SLIDER,
        description: t("عدد التبويبات المتاحة عبر مفاتيح الأرقام (1-9)", "Number of tabs accessible via number keys (1-9)"),
        markers: makeRange(1, 9, 1),
        default: 3,
        stickToMarkers: true,
    },
    enableCloseTabShortcut: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل اختصار لوحة المفاتيح لإغلاق التبويب", "Enable keyboard shortcut for closing a tab"),
        default: true,
        restartNeeded: false
    },
    enableNewTabShortcut: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل اختصار لوحة المفاتيح لفتح تبويب جديد", "Enable keyboard shortcut for opening a new tab"),
        default: true,
        restartNeeded: false
    },
    enableTabCycleShortcut: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل اختصار لوحة المفاتيح للتنقل الدوري بين التبويبات", "Enable keyboard shortcut for cycling through tabs"),
        default: true,
        restartNeeded: false
    },
    keybindsSection: {
        type: OptionType.COMPONENT,
        component: KeybindSettings
    },
    // me when storage yes for keybinds
    closeTabKeybind: {
        type: OptionType.STRING,
        description: t("اختصار لوحة المفاتيح لإغلاق التبويب الحالي", "Keyboard shortcut to close the current tab"),
        default: "CTRL+W",
        hidden: true
    },
    newTabKeybind: {
        type: OptionType.STRING,
        description: t("اختصار لوحة المفاتيح لفتح تبويب جديد", "Keyboard shortcut to open a new tab"),
        default: "CTRL+T",
        hidden: true
    },
    cycleTabForwardKeybind: {
        type: OptionType.STRING,
        description: t("اختصار لوحة المفاتيح للانتقال إلى التبويب التالي", "Keyboard shortcut to move to the next tab"),
        default: "CTRL+TAB",
        hidden: true
    },
    cycleTabBackwardKeybind: {
        type: OptionType.STRING,
        description: t("اختصار لوحة المفاتيح للانتقال إلى التبويب السابق", "Keyboard shortcut to move to the previous tab"),
        default: "CTRL+SHIFT+TAB",
        hidden: true
    },
    showTabNumbers: {
        type: OptionType.BOOLEAN,
        description: t("إظهار شارات مرقّمة على التبويبات للإشارة إلى اختصارات لوحة المفاتيح", "Show numbered badges on tabs to indicate keyboard shortcuts"),
        default: false,
        restartNeeded: false
    },
    tabNumberPosition: {
        type: OptionType.SELECT,
        description: t("مكان عرض الشارة المرقّمة على التبويبات", "Where to display the numbered badge on tabs"),
        options: [
            { label: t("الجانب الأيسر (قبل الأيقونة)", "Left side (before icon)"), value: "left", default: true },
            { label: t("الجانب الأيمن (بعد المحتوى)", "Right side (after content)"), value: "right" }
        ],
        restartNeeded: false
    },
    animations: {
        type: OptionType.COMPONENT,
        component: AnimationSettings
    },
    // me when storage yes
    animationHover: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل تأثيرات الرفع والتكبير عند التمرير", "Enable lift and scale effects on hover"),
        default: true,
        hidden: true
    },
    animationSelection: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل حركات التحديد (توهج الحد، الرفع)", "Enable selection animations (border glow, lift)"),
        default: true,
        hidden: true
    },
    animationDragDrop: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل تأثيرات الشبح عند السحب والإفلات", "Enable ghost effects during drag and drop"),
        default: true,
        hidden: true
    },
    animationEnterExit: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل حركات الانزلاق عند إنشاء/إغلاق التبويبات", "Enable slide animations when creating/closing tabs"),
        default: true,
        hidden: true
    },
    animationIconPop: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل حركة تكبير الأيقونة عند التحديد", "Enable icon pop animation on selection"),
        default: true,
        hidden: true
    },
    animationCloseRotation: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل حركة الدوران لأزرار الإغلاق", "Enable rotation animation for close buttons"),
        default: true,
        hidden: true
    },
    animationPlusPulse: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل حركة النبض لزر الإضافة", "Enable pulse animation for the add button"),
        default: true,
        hidden: true
    },
    animationMentionGlow: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل التوهج الأحمر النابض للإشارات", "Enable pulsing red glow for mentions"),
        default: true,
        hidden: true
    },
    animationCompactExpand: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل التوسّع السلس للتبويبات المضغوطة", "Enable smooth expansion of compact tabs"),
        default: true,
        hidden: true
    },
    animationSelectedBorder: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل تنسيق الحد والتوهج للتبويبات المحددة", "Enable border and glow styling for selected tabs"),
        default: true,
        hidden: true
    },
    animationSelectedBackground: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل تغيير لون الخلفية للتبويبات المحددة", "Enable background color change for selected tabs"),
        default: true,
        hidden: true
    },
    animationTabShadows: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل تأثيرات الظل على التبويبات", "Enable shadow effects on tabs"),
        default: true,
        hidden: true
    },
    animationTabPositioning: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل الانتقالات السلسة عند تحريك التبويبات", "Enable smooth transitions when moving tabs"),
        default: true,
        hidden: true
    },
    animationResizeHandle: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل حركة التلاشي لمقبض تغيير الحجم", "Enable fade animation for the resize handle"),
        default: true,
        hidden: true
    },
    animationQuestsActive: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل حركات التدرج في تبويب المهام عند تشغيل المهام بنشاط", "Enable gradient animations in the quests tab when quests are actively running"),
        default: true,
        hidden: true
    },
    compactAutoExpandSelected: {
        type: OptionType.BOOLEAN,
        description: t("توسيع التبويبات المضغوطة تلقائياً عند تحديدها لإظهار اسم القناة كاملاً", "Auto-expand compact tabs when selected to show the full channel name"),
        default: true,
        restartNeeded: false
    },
    compactAutoExpandOnHover: {
        type: OptionType.BOOLEAN,
        description: t("توسيع التبويبات المضغوطة تلقائياً عند التمرير فوقها لإظهار اسم القناة كاملاً", "Auto-expand compact tabs when hovering over them to show the full channel name"),
        default: true,
        restartNeeded: false
    },
    openInNewTabAutoSwitch: {
        type: OptionType.BOOLEAN,
        description: t("التبديل تلقائياً إلى التبويبات الجديدة المفتوحة من قائمة السياق 'فتح في تبويب جديد'", "Automatically switch to new tabs opened from the 'Open in New Tab' context menu"),
        default: true,
        restartNeeded: false
    },
    bookmarksIndependentFromTabs: {
        type: OptionType.BOOLEAN,
        description: t("الإشارات المرجعية تتنقل باستقلالية دون التأثير على شريط التبويبات النشط", "Bookmarks navigate independently without affecting the active tab bar"),
        default: true,
        restartNeeded: false
    },
    showResizeHandle: {
        type: OptionType.BOOLEAN,
        description: t("إظهار مقبض تغيير الحجم عند التمرير فوق التبويبات لضبط عرضها", "Show resize handle when hovering over tabs to adjust their width"),
        default: true,
        restartNeeded: false
    },
    openNewTabsInCompactMode: {
        type: OptionType.BOOLEAN,
        description: t("فتح جميع التبويبات الجديدة في الوضع المضغوط افتراضياً", "Open all new tabs in compact mode by default"),
        default: false,
        restartNeeded: false
    },
    newTabButtonBehavior: {
        type: OptionType.BOOLEAN,
        description: t("زر التبويب الجديد (+) يتبع التبويبات بدلاً من البقاء مثبتاً على اليمين", "New tab button (+) follows tabs instead of staying pinned to the right"),
        default: true,
        restartNeeded: false
    },
    oneTabPerServer: {
        type: OptionType.BOOLEAN,
        description: t("الحد بتبويب واحد لكل سيرفر، بحيث يستخدم فتح قناة جديدة في ذلك السيرفر التبويب الموجود.", "Limit to one tab per server, so opening a new channel in that server reuses the existing tab."),
        default: false,
        restartNeeded: false
    },
    maxOpenTabs: {
        type: OptionType.SLIDER,
        description: t("الحد الأقصى لعدد التبويبات المفتوحة (0 = بلا حد)", "Maximum number of open tabs (0 = no limit)"),
        markers: makeRange(0, 20, 1),
        default: 0,
        stickToMarkers: true,
        restartNeeded: false
    }
});
