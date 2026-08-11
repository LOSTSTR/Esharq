/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import type { Quest } from "@vencord/discord-types";
import { findComponentByCodeLazy } from "@webpack";
import { QuestStore, useEffect, useMemo, useRef, useState, useStateFromStores } from "@webpack/common";
import type { JSX, SyntheticEvent } from "react";

import { enabledOnStartup } from "..";
import { getQuestifySettings, useQuestifySettings } from "../settings/access";
import { defaultQuestTileClaimedColorSetting, defaultQuestTileExpiredColorSetting, defaultQuestTileIgnoredColorSetting, defaultQuestTileUnclaimedColorSetting, type QuestTileColorSetting, type QuestTileGradient } from "../settings/def";
import { rerenderQuests } from "../settings/rerender";
import { getQuestTileClasses, getQuestTileStyle } from "../utils/questTiles";
import { q } from "../utils/ui";
import { ManaButton, type ManaSelectOption, SettingsCard, SettingsColorPicker, SettingsDescription, SettingsHeader, SettingsRow, SettingsRowItem, SettingsSelect, SettingsSubheader } from "./shared";

const QuestTile = findComponentByCodeLazy(".rowIndex,trackGuildAndChannelMetadata") as React.ComponentType<{
    className?: string;
    quest: Quest;
}>;

function getGradientOptions(): readonly { label: string, value: QuestTileGradient; }[] {
    return [
        { label: t("تدرج مكثف", "Intense gradient"), value: "intense" },
        { label: t("تدرج افتراضي", "Default gradient"), value: "default" },
        { label: t("تدرج أسود خفيف", "Subtle black gradient"), value: "black" },
        { label: t("بدون تدرج", "No gradient"), value: "hide" },
    ];
}

function getPreloadManaOptions(): ManaSelectOption[] {
    return [
        { id: "true", label: t("تحميل جميع الأصول عند فتح الصفحة", "Preload all assets when page opens"), value: "true" },
        { id: "false", label: t("تحميل الأصول أثناء التمرير", "Load assets while scrolling"), value: "false" },
    ];
}

type QuestTileColorKey =
    | "questTileUnclaimedColor"
    | "questTileClaimedColor"
    | "questTileIgnoredColor"
    | "questTileExpiredColor";

interface QuestTileColorOption {
    key: QuestTileColorKey;
    label: string;
    defaultValue: QuestTileColorSetting;
}

function getColorOptions(): readonly QuestTileColorOption[] {
    return [
        { key: "questTileUnclaimedColor", label: t("غير مطالَب", "Unclaimed"), defaultValue: defaultQuestTileUnclaimedColorSetting },
        { key: "questTileClaimedColor", label: t("مطالَب", "Claimed"), defaultValue: defaultQuestTileClaimedColorSetting },
        { key: "questTileIgnoredColor", label: t("مُتجاهَل", "Ignored"), defaultValue: defaultQuestTileIgnoredColorSetting },
        { key: "questTileExpiredColor", label: t("منتهي", "Expired"), defaultValue: defaultQuestTileExpiredColorSetting },
    ];
}

const defaultPreviewColorKey: QuestTileColorKey = "questTileUnclaimedColor";

function getRandomQuest(): Quest | null {
    const quests = Array.from(QuestStore.quests.values());
    return quests.length > 0 ? quests[Math.floor(Math.random() * quests.length)] : null;
}

function cloneDummyQuest(quest: Quest, dummyColor: QuestTileColorSetting): Quest & { dummyColor: QuestTileColorSetting; } {
    return {
        ...structuredClone(quest),
        dummyColor,
    };
}

function stopDummyQuestInteraction(event: SyntheticEvent): void {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
}

function DummyQuestTile({
    disabled,
    dummyQuest,
    dummyGradient,
}: {
    disabled?: boolean;
    dummyQuest: Quest & { dummyColor: QuestTileColorSetting; };
    dummyGradient: QuestTileGradient;
}): JSX.Element {
    const blockerRef = useRef<HTMLDivElement>(null);
    const classes = getQuestTileClasses(q("dummy-quest"), dummyQuest, dummyGradient);
    const style = getQuestTileStyle(dummyQuest);

    useEffect(() => {
        const blocker = blockerRef.current;

        if (!blocker) return;

        const eventNames = [
            "auxclick",
            "click",
            "contextmenu",
            "dblclick",
            "dragstart",
            "mousedown",
            "mouseup",
            "pointercancel",
            "pointerdown",
            "pointerup",
        ];

        function stopEvent(event: Event) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        }

        for (const eventName of eventNames) {
            blocker.addEventListener(eventName, stopEvent, true);
        }

        return () => {
            for (const eventName of eventNames) {
                blocker.removeEventListener(eventName, stopEvent, true);
            }
        };
    }, []);

    return (
        <div
            ref={blockerRef}
            className={q("dummy-quest-preview", disabled ? "dimmed-settings-item" : undefined)}
            style={style}
            onAuxClickCapture={stopDummyQuestInteraction}
            onClickCapture={stopDummyQuestInteraction}
            onContextMenuCapture={stopDummyQuestInteraction}
            onDoubleClickCapture={stopDummyQuestInteraction}
            onDragStartCapture={stopDummyQuestInteraction}
            onMouseDownCapture={stopDummyQuestInteraction}
            onMouseUpCapture={stopDummyQuestInteraction}
            onPointerCancelCapture={stopDummyQuestInteraction}
            onPointerDownCapture={stopDummyQuestInteraction}
            onPointerUpCapture={stopDummyQuestInteraction}
        >
            <QuestTile
                className={classes}
                quest={dummyQuest}
            />
        </div>
    );
}

function DummyQuestPreview({
    disabled,
    dummyColor,
    dummyGradient,
}: {
    disabled?: boolean;
    dummyColor: QuestTileColorSetting;
    dummyGradient: QuestTileGradient;
}): JSX.Element | null {
    const sourceQuest = useStateFromStores([QuestStore], getRandomQuest);

    const dummyQuest = useMemo(
        () => sourceQuest ? cloneDummyQuest(sourceQuest, dummyColor) : null,
        [dummyColor, sourceQuest]
    );

    if (!dummyQuest) return null;

    return (
        <DummyQuestTile
            disabled={disabled}
            dummyQuest={dummyQuest}
            dummyGradient={dummyGradient}
        />
    );
}

export function QuestTilesSetting(): JSX.Element {
    useSettings(["plugins.Settings.arabicMode"]);

    const questTiles = useQuestifySettings([
        "disableQuestsEverything",
        "questTileUnclaimedColor",
        "questTileClaimedColor",
        "questTileIgnoredColor",
        "questTileExpiredColor",
        "questTileGradient",
        "questTilePreload",
    ]);

    const gradientOptions = getGradientOptions();
    const gradientManaOptions: ManaSelectOption[] = gradientOptions.map(({ label, value }) => ({
        id: value,
        label,
        value,
    }));
    const preloadManaOptions = getPreloadManaOptions();
    const colorOptions = getColorOptions();

    const [previewColorKey, setPreviewColorKey] = useState<QuestTileColorKey>(defaultPreviewColorKey);

    const disabled = questTiles.disableQuestsEverything;
    const previewColor = questTiles[previewColorKey] as QuestTileColorSetting;

    function updateColor(key: QuestTileColorKey, nextColor: QuestTileColorSetting): void {
        setPreviewColorKey(key);
        getQuestifySettings()[key] = nextColor;
    }

    function updateColorValue(key: QuestTileColorKey, setting: QuestTileColorSetting, value: number | null): void {
        if (typeof value !== "number") return;

        updateColor(key, {
            enabled: setting.enabled,
            color: value,
        });
    }

    function updateColorEnabled(key: QuestTileColorKey, setting: QuestTileColorSetting, enabled: boolean): void {
        updateColor(key, {
            ...setting,
            enabled,
        });
    }

    function updateGradient(value: string | string[] | null): void {
        if (typeof value !== "string") return;

        getQuestifySettings().questTileGradient = value as QuestTileGradient;
    }

    function updatePreload(value: string | string[] | null): void {
        if (typeof value !== "string") return;

        const preload = value === "true";
        getQuestifySettings().questTilePreload = preload;
        rerenderQuests();
    }

    return (
        <SettingsCard>
            <SettingsHeader>{t("بلاطات المهام", "Quest Tiles")}</SettingsHeader>
            <SettingsDescription>{t("إبراز المهام بألوان اختيارية لتمييزها بصرياً.", "Highlight quests with optional colors for visual distinction.")}</SettingsDescription>
            <SettingsSubheader>{t("سلوك البلاطة", "Tile Behavior")}</SettingsSubheader>
            <SettingsRow className="quest-tile-behavior-row">
                <SettingsRowItem className="quest-tile-gradient-row-item">
                    <SettingsSelect
                        label={t("نمط التدرج:", "Gradient style:")}
                        options={gradientManaOptions}
                        value={questTiles.questTileGradient}
                        selectionMode="single"
                        disabled={disabled}
                        fullWidth={true}
                        maxOptionsVisible={gradientManaOptions.length}
                        onSelectionChange={updateGradient}
                        tooltip={{
                            position: "top",
                            text: t(
                                "المكثف والافتراضي يستخدمان لون البلاطة المختار في تدرج الصورة."
                                    + "\n\nالأسود الخفيف يحافظ على تدرج محايد أغمق للتباين."
                                    + "\n\nبدون تدرج يزيل التدرج، مما قد يجعل بعض صور المهام أصعب قراءةً.",
                                "Intense and Default use the selected tile color in the image gradient."
                                    + "\n\nSubtle black maintains a neutral darker gradient for contrast."
                                    + "\n\nNo gradient removes the gradient, which may make some quest images harder to read."
                            )
                        }}
                    />
                </SettingsRowItem>
                <SettingsRowItem className="quest-tile-preload-row-item">
                    <SettingsSelect
                        label={t("التحميل المسبق للأصول:", "Preload assets:")}
                        options={preloadManaOptions}
                        value={String(questTiles.questTilePreload)}
                        selectionMode="single"
                        disabled={disabled}
                        fullWidth={true}
                        maxOptionsVisible={preloadManaOptions.length}
                        onSelectionChange={updatePreload}
                        tooltip={{
                            position: "top",
                            text: t(
                                "تحميل جميع الأصول عند فتح الصفحة يقلل من الاهتزاز أثناء التمرير."
                                    + "\n\nالتحميل أثناء التمرير أقرب لسلوك Discord الافتراضي وقد يستهلك موارد أقل.",
                                "Preloading all assets when the page opens reduces jank while scrolling."
                                    + "\n\nLoading assets while scrolling is closer to Discord's default behavior and may use fewer resources."
                            )
                        }}
                    />
                </SettingsRowItem>
            </SettingsRow>
            <SettingsSubheader>{t("ألوان البلاطة", "Tile Colors")}</SettingsSubheader>
            <SettingsRow className="quest-tile-color-row">
                {colorOptions.map(({ key, label }) => {
                    const setting = questTiles[key] as QuestTileColorSetting;

                    return (
                        <SettingsRowItem key={key} className="quest-tile-color-row-item">
                            <div
                                onFocusCapture={() => setPreviewColorKey(key)}
                                onPointerDownCapture={() => setPreviewColorKey(key)}
                            >
                                <SettingsColorPicker
                                    label={`${label}:`}
                                    className={["quest-tile-color-picker", setting.enabled ? "" : "disabled-color-picker"].filter(Boolean)}
                                    color={setting.color}
                                    disabled={disabled || !setting.enabled}
                                    onChange={value => updateColorValue(key, setting, value)}
                                    showEyeDropper={true}
                                />
                            </div>
                            <div className={q("settings-button", "quest-tile-color-button")}>
                                <ManaButton
                                    text={setting.enabled ? t("تعطيل", "Disable") : t("تمكين", "Enable")}
                                    variant={setting.enabled ? "critical-secondary" : "primary"}
                                    disabled={disabled}
                                    fullWidth={true}
                                    size="sm"
                                    onClick={() => updateColorEnabled(key, setting, !setting.enabled)}
                                />
                            </div>
                        </SettingsRowItem>
                    );
                })}
            </SettingsRow>
            {enabledOnStartup && <DummyQuestPreview
                disabled={disabled}
                dummyColor={previewColor}
                dummyGradient={questTiles.questTileGradient as QuestTileGradient}
            />}
        </SettingsCard>
    );
}
