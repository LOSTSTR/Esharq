/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import { QuestTaskType } from "@vencord/discord-types/enums";
import type { JSX } from "react";

import { getQuestifySettings, useQuestifySettings } from "../settings/access";
import { resetDangerousSettings } from "../settings/dangerous";
import { autoCompleteQuestTaskTypes, defaultAutoCompleteQuestTypes, isDesktopCompatible } from "../settings/def";
import { Alerts, q } from "../utils/ui";
import { ManaButton, type ManaSelectOption, SettingsCard, SettingsDescription, SettingsHeader, SettingsNotice, SettingsParagraph, SettingsSelect, SettingsSubheader, SettingsSubtleSwitch } from "./shared";

type QuestDisableSettingKey =
    | "disableAccountPanelPromo"
    | "disableAccountPanelQuestProgress"
    | "disableFriendsListPromo"
    | "disableMembersListPromo"
    | "disableOrbsAndQuestsBadges"
    | "disableRelocationNotices"
    | "disableSponsoredBanner";

type QuestModifySettingKey =
    | "autoCompleteQuestsSimultaneously"
    | "resumeInterruptedQuests"
    | "completeVideoQuestsQuicker"
    | "preventVideoQuestsPausing"
    | "makeMobileVideoQuestsDesktopCompatible";

interface QuestDisableOption {
    key: QuestDisableSettingKey;
    label: string;
}

function getDisableFeatureOptions(): readonly QuestDisableOption[] {
    return [
        { key: "disableSponsoredBanner", label: t("البانر الممول", "Sponsored Banner") },
        { key: "disableRelocationNotices", label: t("إشعارات نقل المهام", "Quest Relocation Notices") },
        { key: "disableFriendsListPromo", label: t("عروض قائمة الأصدقاء", "Friends List Promotions") },
        { key: "disableMembersListPromo", label: t("عروض قائمة الأعضاء", "Members List Promotions") },
        { key: "disableAccountPanelPromo", label: t("عرض لوحة الحساب", "Account Panel Promo") },
        { key: "disableAccountPanelQuestProgress", label: t("تقدّم لوحة الحساب", "Account Panel Quest Progress") },
        { key: "disableOrbsAndQuestsBadges", label: t("شارات المهام والكرات", "Quest and Coin Badges") },
    ];
}

function getAutoCompleteQuestTypeOptions(): { label: string; value: QuestTaskType; }[] {
    const labels: Record<typeof autoCompleteQuestTaskTypes[number], string> = {
        [QuestTaskType.WATCH_VIDEO]: t("مشاهدة فيديو", "Watch Video"),
        [QuestTaskType.WATCH_VIDEO_ON_MOBILE]: t("مشاهدة فيديو على الجوال", "Watch Video on Mobile"),
        [QuestTaskType.ACHIEVEMENT_IN_ACTIVITY]: t("إنجاز في نشاط", "Achievement in Activity"),
        [QuestTaskType.PLAY_ACTIVITY]: t("تشغيل نشاط", "Play Activity"),
        [QuestTaskType.PLAY_ON_DESKTOP]: t("اللعب على سطح المكتب", "Play on Desktop"),
        [QuestTaskType.PLAY_ON_PLAYSTATION]: t("اللعب على PlayStation", "Play on PlayStation"),
        [QuestTaskType.PLAY_ON_XBOX]: t("اللعب على Xbox", "Play on Xbox"),
    };
    return autoCompleteQuestTaskTypes.map(questType => ({
        label: labels[questType],
        value: questType,
    }));
}

interface SettingsAllowDangerousButtonProps {
    allowed: boolean;
    disabled?: boolean;
    onClick?: (e: React.MouseEvent) => void;
}

function SettingsAllowDangerousButton({
    allowed,
    disabled,
    onClick,
}: SettingsAllowDangerousButtonProps): JSX.Element {
    return (
        <div className={q("settings-button", "allow-dangerous-button")}>
            <ManaButton
                text={allowed
                    ? t("إعادة الضبط وحظر تغيير الإعدادات الخطرة...", "Reset and Lock Dangerous Settings...")
                    : t("السماح بتغيير الإعدادات الخطرة...", "Allow Changing Dangerous Settings...")}
                variant={allowed ? "critical-secondary" : "critical-primary"}
                fullWidth={true}
                disabled={disabled}
                onClick={onClick}
                size="sm"
            />
        </div>
    );
}

export function QuestFeaturesSetting(): JSX.Element {
    useSettings(["plugins.Settings.arabicMode"]);

    const questFeatures = useQuestifySettings([
        "disableQuestsEverything",
        "disableSponsoredBanner",
        "disableRelocationNotices",
        "disableFriendsListPromo",
        "disableMembersListPromo",
        "disableAccountPanelPromo",
        "disableAccountPanelQuestProgress",
        "disableOrbsAndQuestsBadges",
        "resumeInterruptedQuests",
        "allowChangingDangerousSettings",
        "makeMobileVideoQuestsDesktopCompatible",
        "autoCompleteQuestsSimultaneously",
        "autoCompleteQuestTypes",
        "completeVideoQuestsQuicker",
        "preventVideoQuestsPausing",
    ]);

    const disableFeatureOptions = getDisableFeatureOptions();
    const autoCompleteQuestTypeOptions = getAutoCompleteQuestTypeOptions();
    const disableManaOptions: ManaSelectOption[] = disableFeatureOptions.map(({ key, label }) => ({
        id: key,
        label,
        value: key,
    }));
    const autoCompleteQuestTypeManaOptions: ManaSelectOption[] = autoCompleteQuestTypeOptions.map(({ label, value }) => ({
        id: String(value),
        label,
        value: String(value),
        disabled: !isDesktopCompatible(value),
    }));

    const selectedDisableValues = disableFeatureOptions
        .filter(({ key }) => questFeatures[key])
        .map(({ key }) => key);

    const selectedAutoCompleteQuestTypeValues = autoCompleteQuestTypeOptions
        .filter(({ value }) => isDesktopCompatible(value) && questFeatures.autoCompleteQuestTypes[value] === true)
        .map(({ value }) => String(value));

    function updateDisableValue(value: string | string[] | null) {
        const selectedKeys = new Set(Array.isArray(value) ? value : value ? [value] : []);

        for (const { key } of disableFeatureOptions) {
            getQuestifySettings()[key] = selectedKeys.has(key);
        }
    }

    function confirmDangerousSettingChange(body: string, onConfirm: () => void) {
        Alerts.show({
            title: t("هل أنت متأكد؟", "Are you sure?"),
            body,
            confirmText: t("متابعة", "Continue"),
            confirmVariant: "critical-primary",
            cancelText: t("إلغاء", "Cancel"),
            onConfirm,
        });
    }

    function updateAutoCompleteQuestTypes(value: string | string[] | null) {
        const selectedValues = new Set(Array.isArray(value) ? value : value ? [value] : []);
        const nextAutoCompleteQuestTypes = { ...defaultAutoCompleteQuestTypes };

        for (const { value: questType } of autoCompleteQuestTypeOptions) {
            const nextValue = selectedValues.has(String(questType))
                && isDesktopCompatible(questType);

            nextAutoCompleteQuestTypes[questType] = nextValue;
        }

        getQuestifySettings().autoCompleteQuestTypes = nextAutoCompleteQuestTypes;
    }

    function updateDisableEverything(checked: boolean) {
        function setDisableEverything() {
            getQuestifySettings().disableQuestsEverything = checked;
        }

        if (checked) {
            confirmDangerousSettingChange(
                t("سيؤدي هذا إلى تعطيل وظائف المهام بالكامل.", "This will disable all quest functionality."),
                () => {
                    resetDangerousSettings();
                    setDisableEverything();
                }
            );
        } else {
            setDisableEverything();
        }
    }

    function updateDangerousAccess(checked: boolean) {
        function setDangerousAccess() {
            getQuestifySettings().allowChangingDangerousSettings = checked;
        }

        if (checked) {
            confirmDangerousSettingChange(
                t("سيسمح هذا بتغيير الإعدادات الخطرة.", "This will allow changing dangerous settings."),
                setDangerousAccess
            );
        } else {
            resetDangerousSettings();
            setDangerousAccess();
        }
    }

    function updateModifyValue(key: QuestModifySettingKey, checked: boolean) {
        getQuestifySettings()[key] = checked;
    }

    return (
        <SettingsCard>
            <SettingsHeader>{t("ميزات المهام", "Quest Features")}</SettingsHeader>
            <SettingsDescription>{t("عدّل سلوك المهام لتحسين الوظائف أو إزالتها.", "Modify quest behavior to enhance or remove functionality.")}</SettingsDescription>
            <SettingsSubheader>{t("تعطيل الميزات", "Disable Features")}</SettingsSubheader>
            <SettingsSubtleSwitch
                checked={questFeatures.disableQuestsEverything}
                label={t("تعطيل وظائف المهام بالكامل:", "Disable all quest functionality:")}
                onChange={updateDisableEverything}
                bottomSpacing="10"
                tooltip={{
                    position: "top",
                    text: t(
                        "سيؤدي هذا إلى تعطيل جميع تحسينات الإضافة، وإخفاء صفحة المهام وعناصرها في Discord، ومنع Discord من جلب بيانات المهام. لن يؤثر هذا على المتجر لأن الكرات مرتبطة به بشكل أساسي كعملة ثانوية.",
                        "This will disable all plugin enhancements, hide the quests page and its elements in Discord, and prevent Discord from fetching quest data. This will not affect the shop since coins are primarily tied to it as a secondary currency."
                    )
                }}
            />
            <SettingsSelect
                label={t("تعطيل ميزات محددة:", "Disable specific features:")}
                wrapTags={true}
                options={disableManaOptions}
                value={selectedDisableValues}
                closeOnSelect={false}
                maxOptionsVisible={7}
                selectionMode="multiple"
                disabled={questFeatures.disableQuestsEverything}
                onSelectionChange={updateDisableValue}
                tooltip={{
                    position: "top",
                    text: t(
                        "البانر الممول هو بانر مهام مدفوع يظهر في أعلى صفحة المهام."
                            + "\n\nإشعارات نقل المهام هي مؤشرات في صفحة الاستكشاف تشير إلى نقل المهام إلى الرسائل المباشرة."
                            + "\n\nعروض قائمة الأصدقاء هي بطاقة تظهر في قسم \"نشط الآن\" بينما يلعب أحد أصدقائك لعبة بها مهمة نشطة."
                            + "\n\nعروض قائمة الأعضاء هي أيقونة تظهر على الأعضاء في قائمة الخادم بينما يلعبون لعبة بها مهمة نشطة."
                            + "\n\nعرض لوحة الحساب هو ترويج مدفوع للمهام يظهر فوق لوحة حسابك."
                            + "\n\nتقدّم لوحة الحساب هو عرض تقدّم المهمة النشطة أو المكتملة فوق لوحة حسابك."
                            + "\n\nشارات المهام والكرات هي شارات على ملفات المستخدمين لمن أتمّ مهمة واحدة على الأقل أو اشترى شارة الكرات.",
                        "Sponsored Banner is a paid quest banner shown at the top of the quests page."
                            + "\n\nQuest Relocation Notices are indicators in the explore page pointing to quests being moved to direct messages."
                            + "\n\nFriends List Promotions is a card shown in the \"Active Now\" section while a friend plays a game with an active quest."
                            + "\n\nMembers List Promotions is an icon shown on members in the server list while they play a game with an active quest."
                            + "\n\nAccount Panel Promo is a paid quest promotion shown above your account panel."
                            + "\n\nAccount Panel Quest Progress is the display of active or completed quest progress above your account panel."
                            + "\n\nQuest and Coin Badges are badges on user profiles for those who completed at least one quest or bought a coin badge."
                    )
                }}
            />
            <SettingsSubheader>{t("تعديل الميزات", "Modify Features")}</SettingsSubheader>
            <SettingsNotice className={["notice-card-red", questFeatures.disableQuestsEverything ? "dimmed-settings-item" : undefined, questFeatures.allowChangingDangerousSettings ? undefined : "notice-card-solo", "no-bottom-margin"].filter(c => c !== undefined)}>
                <SettingsParagraph>
                    {t(
                        "من المعروف أن Discord يعاقب مستخدمي السكربتات أو الإضافات التي تعدّل طريقة إكمال المهام. تعديل طريقة إكمال المهام مخالف لـ",
                        "Discord is known to punish users of scripts or plugins that modify the completion of Quests. Modifying the completion of Quests is against Discord's "
                    )}<a href="https://discord.com/safety/platform-manipulation-policy-explainer" target="_blank" rel="noreferrer">{t("شروط الخدمة", "Terms of Service")}</a>{t(".", ".")}
                </SettingsParagraph>
                <br />
                <SettingsParagraph>
                    {t(
                        "تتمثّل العقوبة في فقدان الوصول إلى المهام ومكافآتها مؤقتاً أو دائماً. ",
                        "The punishment consists of a temporary or permanent loss of access to Quests and their rewards. "
                    )}<strong>{t(
                        "كما تتضمّن العقوبة مخالفةً في سِجلّ الحساب تدوم سنتين لكل مخالفة.",
                        "The punishment also consists of an account standing violation which lasts 2 years per violation."
                    )}</strong>
                </SettingsParagraph>
                <br />
                <SettingsParagraph>
                    {t(
                        "نظراً للأساليب المتعددة التي يستخدمها Discord لتتبع المستخدمين، لا توجد طريقة واقعية لتجنّب الاكتشاف. إذا تابعت، فافهم أن Discord على الأرجح سيكتشف استخدامك في مرحلة ما.",
                        "Due to the various methods Discord uses to track users, there's no way to realistically evade detection. If you proceed, understand that Discord likely will detect your use at some point."
                    )}
                </SettingsParagraph>
                <br />
                <SettingsParagraph>
                    {t(
                        "استخدم التبديل التالي للوصول إلى الإعدادات الخطرة على مسؤوليتك الخاصة.",
                        "Use the toggle below to access dangerous settings at your own risk."
                    )}
                </SettingsParagraph>
                <SettingsAllowDangerousButton
                    allowed={questFeatures.allowChangingDangerousSettings}
                    disabled={questFeatures.disableQuestsEverything}
                    onClick={() => updateDangerousAccess(!questFeatures.allowChangingDangerousSettings)}
                />
                {questFeatures.allowChangingDangerousSettings && <>
                    <SettingsSubtleSwitch
                        disabled={questFeatures.disableQuestsEverything || !questFeatures.allowChangingDangerousSettings}
                        checked={questFeatures.completeVideoQuestsQuicker}
                        label={t("تسريع الإكمال التلقائي لمهام الفيديو:", "Speed up auto-completion of video quests:")}
                        onChange={checked => updateModifyValue("completeVideoQuestsQuicker", checked)}
                        topSpacing="10"
                        bottomSpacing="5"
                        tooltip={{
                            position: "top",
                            text: t(
                                "يسمح Discord بإكمال مهام الفيديو بعد مرور 24 ثانية أقل من مدة الفيديو منذ تسجيلك في المهمة."
                                    + "\n\nهذا يعني أنه إذا كانت مهمة الفيديو 24 ثانية أو أقل، أو إذا سجّلت في مهمة فيديو وعدت لاحقاً لإكمالها، يمكن إكمالها فوراً."
                                    + "\n\nينطبق هذا الإعداد فقط على الإكمال التلقائي لمهام الفيديو ويعتمد على إعداد الإكمال التلقائي أدناه. إكمال مهام الفيديو يدوياً سيظل يتطلب الانتظار المدة الكاملة.",
                                "Discord allows completing video quests 24 seconds before the video duration has elapsed since you enrolled in the quest."
                                    + "\n\nThis means that if a video quest is 24 seconds or shorter, or if you enrolled in a video quest and return later to complete it, it can be completed instantly."
                                    + "\n\nThis setting only applies to auto-completing video quests and depends on the auto-complete setting below. Manually completing video quests will still require waiting the full duration."
                            )
                        }}
                    />
                    <SettingsSubtleSwitch
                        disabled={questFeatures.disableQuestsEverything || !questFeatures.allowChangingDangerousSettings}
                        checked={questFeatures.preventVideoQuestsPausing}
                        label={t("منع إيقاف مهام الفيديو مؤقتاً عند فقدان التركيز:", "Prevent Video Quests from pausing when losing focus:")}
                        onChange={checked => updateModifyValue("preventVideoQuestsPausing", checked)}
                        bottomSpacing="5"
                        tooltip={{
                            position: "top",
                            text: t(
                                "يفرض Discord بقاءك داخل نافذة العميل حتى تشتغل مقاطع مهام الفيديو."
                                + "\n\nيمنع هذا الإعداد إيقاف المقطع مؤقتاً ويسمح للإكمال بالتقدّم كالمعتاد."
                                + "\n\nينطبق هذا الإعداد على إكمال مهام الفيديو يدوياً فقط.",
                                "Discord forces you to be tabbed into the client for Video Quests to play their video."
                                + "\n\nThis setting prevents the video from pausing and allows completion to progress as normal."
                                + "\n\nThis setting applies only to manually completing Video Quests."
                            )
                        }}
                    />
                    <SettingsSubtleSwitch
                        disabled={questFeatures.disableQuestsEverything || !questFeatures.allowChangingDangerousSettings}
                        checked={questFeatures.makeMobileVideoQuestsDesktopCompatible}
                        label={t("جعل بعض مهام الفيديو للجوال قابلة للإكمال على سطح المكتب:", "Make some mobile video quests completable on desktop:")}
                        onChange={checked => updateModifyValue("makeMobileVideoQuestsDesktopCompatible", checked)}
                        bottomSpacing="5"
                        tooltip={{
                            position: "top",
                            text: t(
                                "بعض مهام الفيديو للجوال يمكن التسجيل فيها على سطح المكتب، لكن يجب إكمالها على الجوال. سيتيح هذا الإعداد إكمالها على سطح المكتب."
                                    + "\n\nبعض مهام الفيديو للجوال تقتصر على التسجيل عبر الجوال. للتأثير عليها بهذا الإعداد، يجب التسجيل فيها أولاً على جهازك المحمول."
                                    + "\n\nعند تمكينه بشكل مستقل، ينطبق هذا الإعداد فقط على إكمال مهام الفيديو يدوياً.",
                                "Some mobile video quests can be enrolled in on desktop, but must be completed on mobile. This setting will allow completing them on desktop."
                                    + "\n\nSome mobile video quests are restricted to enrolling via mobile. To affect them with this setting, you must first enroll in them on your mobile device."
                                    + "\n\nWhen enabled independently, this setting only applies to manually completing video quests."
                            )
                        }}
                    />
                    <SettingsSubtleSwitch
                        disabled={questFeatures.disableQuestsEverything || !questFeatures.allowChangingDangerousSettings}
                        checked={questFeatures.autoCompleteQuestsSimultaneously}
                        label={t("إكمال المهام تلقائياً في آنٍ واحد بدلاً من الترتيب:", "Auto-complete quests simultaneously instead of sequentially:")}
                        onChange={checked => updateModifyValue("autoCompleteQuestsSimultaneously", checked)}
                        bottomSpacing="5"
                        tooltip={{
                            position: "top",
                            text: t(
                                "افتراضياً، محاولة الإكمال التلقائي لعدة مهام ستضعها في طابور للإكمال بالترتيب."
                                    + "\n\nسيتيح هذا الإعداد تشغيل جميع مهام الإكمال التلقائي في نفس الوقت."
                                    + "\n\nينطبق هذا الإعداد فقط على الإكمال التلقائي للمهام.",
                                "By default, attempting to auto-complete multiple quests will queue them for completion sequentially."
                                    + "\n\nThis setting will allow all auto-complete quests to run at the same time."
                                    + "\n\nThis setting only applies to auto-completing quests."
                            )
                        }}
                    />
                    <SettingsSubtleSwitch
                        disabled={questFeatures.disableQuestsEverything || !questFeatures.allowChangingDangerousSettings}
                        checked={questFeatures.resumeInterruptedQuests}
                        label={t("استئناف الإكمال التلقائي المنقطع بعد إعادة التحميل أو التشغيل:", "Resume interrupted auto-completion after reload or restart:")}
                        onChange={checked => updateModifyValue("resumeInterruptedQuests", checked)}
                        bottomSpacing="5"
                        tooltip={{
                            position: "top",
                            text: t(
                                "سيستأنف هذا الإعداد تلقائياً أي إكمال تلقائي منقطع بسبب إعادة التحميل أو إعادة التشغيل، بما في ذلك إعادة وضع المهام في الطابور.",
                                "This setting will automatically resume any auto-completion interrupted by a reload or restart, including re-queuing quests."
                            )
                        }}
                    />
                    <SettingsSelect
                        label={t("الإكمال التلقائي لأنواع مهام محددة:", "Auto-complete specific quest types:")}
                        labelClassName="margin-top-9"
                        wrapTags={true}
                        options={autoCompleteQuestTypeManaOptions}
                        value={selectedAutoCompleteQuestTypeValues}
                        closeOnSelect={false}
                        maxOptionsVisible={7}
                        selectionMode="multiple"
                        disabled={questFeatures.disableQuestsEverything || !questFeatures.allowChangingDangerousSettings}
                        onSelectionChange={updateAutoCompleteQuestTypes}
                        tooltip={{
                            position: "top",
                            wider: true,
                            text: t(
                                "مهام مشاهدة الفيديو على الجوال تعمل فقط مع المهام القابلة للتسجيل على سطح المكتب. إذا كانت المهمة مقيدة بالتسجيل عبر الجوال، يجب التسجيل فيها أولاً على جهازك المحمول."
                                    + "\n\nجميع مهام الفيديو ترسل عادةً stack trace مع تقارير التقدم. تمحو Questify هذا الـ stack trace، لكن غيابه سيكون دليلاً مثل وجوده."
                                    + "\n\nمهام اللعب على سطح المكتب وPlayStation وXbox والأنشطة متاحة فقط على العملاء الرسميين. العملاء الخارجيون كـ Vesktop وEquibop لا يدعمون الإكمال التلقائي لهذه الأنواع."
                                    + "\n\nمهام الإنجاز في النشاط يمكن إكمالها تلقائياً فوراً فقط. قد تُعطَّل هذه الطريقة في أي وقت."
                                    + "\n\nالإكمال التلقائي يتم بالنقر على أزرار المهام في صفحة المهام. ستُكمَل بالترتيب ما لم يُفعَّل إعداد الإكمال المتزامن."
                                    + "\n\nالإكمال التلقائي للمهام هو الإعداد الخطر الأكثر خطورة. فعّله على مسؤوليتك الخاصة.",
                                "Watch Video on Mobile quests only work with quests that can be enrolled in on desktop. If the quest is restricted to enrolling via mobile, you must first enroll in it on your mobile device."
                                    + "\n\nAll video quests normally send a stack trace with progress reports. Questify removes this stack trace, but its absence will be as much evidence as its presence."
                                    + "\n\nPlay on Desktop, PlayStation, Xbox, and activity quests are only available on official clients. Third-party clients like Vesktop and Equibop do not support auto-completing these types."
                                    + "\n\nAchievement in Activity quests can only be auto-completed instantly. This method may be disabled at any time."
                                    + "\n\nAuto-completion works by clicking quest buttons on the quests page. They will be completed sequentially unless the simultaneous completion setting is enabled."
                                    + "\n\nAuto-completing quests is the most dangerous dangerous setting. Enable it at your own risk."
                            )
                        }}
                    />
                </>}
            </SettingsNotice>
        </SettingsCard>
    );
}
