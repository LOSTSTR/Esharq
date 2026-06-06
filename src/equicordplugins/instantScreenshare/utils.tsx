/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Heading } from "@components/Heading";
import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import { t } from "@utils/esharqI18n";
import { Logger } from "@utils/Logger";
import { OptionType } from "@utils/types";
import { findByCodeLazy, findByPropsLazy } from "@webpack";
import { MediaEngineStore, SearchableSelect, useEffect, useState } from "@webpack/common";

interface PickerProps {
    streamMediaSelection: any[];
    streamMedia: any[];
}

const getDesktopSources = findByCodeLazy("desktop sources");
const configModule = findByPropsLazy("getOutputVolume");
const log = new Logger("InstantScreenShare");

export const settings = definePluginSettings({
    streamMedia: {
        type: OptionType.COMPONENT,
        component: SettingSection,
    },
    includeVideoDevices: {
        type: OptionType.BOOLEAN,
        description: t("تضمين أجهزة إدخال الفيديو (الكاميرات وكروت الالتقاط) في قائمة المصادر", "Include video input devices (cameras and capture cards) in the sources list"),
        default: false,
    },
    autoMute: {
        type: OptionType.BOOLEAN,
        description: t("كتم الميكروفون تلقائياً عند الانضمام إلى قناة صوتية", "Automatically mute microphone when joining a voice channel"),
        default: false,
    },
    autoDeafen: {
        type: OptionType.BOOLEAN,
        description: t("تعطيل السماعات تلقائياً عند الانضمام إلى قناة صوتية (يكتم الميكروفون أيضاً)", "Automatically deafen when joining a voice channel (also mutes microphone)"),
        default: false,
    },
    instantScreenshare: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل ميزة مشاركة الشاشة التلقائية", "Enable automatic screensharing"),
        default: true,
    },
    keybindScreenshare: {
        type: OptionType.BOOLEAN,
        description: t("مشاركة الشاشة عبر اختصار لوحة المفاتيح في إعدادات Discord", "Screenshare via keyboard shortcut in Discord settings"),
        restartNeeded: true,
        default: false,
    },
    focusDiscord: {
        type: OptionType.BOOLEAN,
        description: t("بدء مشاركة الشاشة بالاختصار فقط عندما تكون نافذة Discord في المقدمة", "Only start screensharing via shortcut when Discord window is in focus"),
        default: true,
    },
    toolboxManagement: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل/تعطيل مشاركة الشاشة الفورية", "Enable/disable instant screensharing"),
        default: true,
        hidden: true,
    },
});

export async function getCurrentMedia() {
    const media = MediaEngineStore.getMediaEngine();
    const sources = await getDesktopSources(media, ["screen", "window"], null) ?? [];

    if (settings.store.includeVideoDevices) {
        try {
            const videoDevices = Object.values(configModule.getVideoDevices() || {});
            const videoSources = videoDevices.map((device: any) => ({
                id: device.id,
                name: device.name,
                type: "video_device"
            }));
            sources.push(...videoSources);
        } catch (e) {
            new log.warn("Failed to get video devices:", e);
        }
    }

    const streamMedia = sources.find(screen => screen.id === settings.store.streamMedia);
    if (streamMedia) return streamMedia;

    log.error(`Stream Media "${settings.store.streamMedia}" not found. Resetting to default.`);

    settings.store.streamMedia = sources[0];
    return sources[0];
}

function StreamSimplePicker({ streamMediaSelection, streamMedia }: PickerProps) {
    const options = streamMediaSelection.map(screen => ({
        label: screen.name,
        value: screen.id,
        default: streamMediaSelection[0],
    }));

    return (
        <SearchableSelect
            placeholder={t("اختر مصدر وسائط للبثّ ", "Select a media source to stream ")}
            maxVisibleItems={5}
            options={options}
            value={options.find(o => o.value === streamMedia)?.value}
            onChange={v => settings.store.streamMedia = v}
            closeOnSelect
        />
    );
}

function ScreenSetting() {
    const { streamMedia, includeVideoDevices } = settings.use(["streamMedia", "includeVideoDevices"]);
    const media = MediaEngineStore.getMediaEngine();
    const [streamMediaSelection, setStreamMediaSelection] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        async function fetchMedia() {
            setLoading(true);
            const sources = await getDesktopSources(media, ["screen", "window"], null) ?? [];

            if (includeVideoDevices) {
                try {
                    const videoDevices = Object.values(configModule.getVideoDevices() || {});
                    const videoSources = videoDevices.map((device: any) => ({
                        id: device.id,
                        name: device.name,
                        type: "video_device"
                    }));
                    sources.push(...videoSources);
                } catch (e) {
                    log.warn("Failed to get video devices:", e);
                }
            }

            if (active) {
                setStreamMediaSelection(sources);
                setLoading(false);
            }
        }
        fetchMedia();
        return () => { active = false; };
    }, [includeVideoDevices]);

    if (loading) return <Paragraph>{t("جارٍ تحميل مصادر الوسائط...", "Loading media sources...")}</Paragraph>;
    if (!streamMediaSelection.length) return <Paragraph>{t("لم يُعثر على وسائط.", "No Media found.")}</Paragraph>;

    return <StreamSimplePicker streamMediaSelection={streamMediaSelection} streamMedia={streamMedia} />;
}

function SettingSection() {
    return (
        <section>
            <Heading>{t("مصدر الوسائط للبثّ", "Media source to stream")}</Heading>
            <Paragraph className={Margins.bottom20}>{t("يعود للشاشة الرئيسية إن لم يُعثر عليه", "Resets to main screen if not found")}</Paragraph>
            <ScreenSetting />
        </section>
    );
}
