/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import { OptionType } from "@utils/types";

import { SettingsPanel } from "./SettingsPanel";
import { NameFormat } from "./types";

export let onServiceChange: (() => void) | null = null;
export function setOnServiceChange(fn: (() => void) | null) { onServiceChange = fn; }

export const settings = definePluginSettings({
    enabled: {
        description: t("تفعيل خدمات Rich Presence.", "Enable Rich Presence services."),
        type: OptionType.BOOLEAN,
        default: true,
        restartNeeded: false,
        onChange: () => onServiceChange?.(),
    },
    serviceSettings: {
        type: OptionType.COMPONENT,
        description: t("إعداد الخدمة.", "Service configuration."),
        component: SettingsPanel,
    },

    // Per-service enable toggles
    abs_enabled: {
        description: t("تفعيل حضور AudioBookShelf.", "Enable AudioBookShelf presence."),
        type: OptionType.BOOLEAN,
        default: false,
        hidden: true,
        onChange: () => onServiceChange?.(),
    },
    tosu_enabled: {
        description: t("تفعيل حضور osu! (tosu).", "Enable osu! (tosu) presence."),
        type: OptionType.BOOLEAN,
        default: false,
        hidden: true,
        onChange: () => onServiceChange?.(),
    },
    sfm_enabled: {
        description: t("تفعيل حضور stats.fm.", "Enable stats.fm presence."),
        type: OptionType.BOOLEAN,
        default: false,
        hidden: true,
        onChange: () => onServiceChange?.(),
    },
    jf_enabled: {
        description: t("تفعيل حضور Jellyfin.", "Enable Jellyfin presence."),
        type: OptionType.BOOLEAN,
        default: false,
        hidden: true,
        onChange: () => onServiceChange?.(),
    },
    lb_enabled: {
        description: t("تفعيل حضور ListenBrainz.", "Enable ListenBrainz presence."),
        type: OptionType.BOOLEAN,
        default: false,
        hidden: true,
        onChange: () => onServiceChange?.(),
    },
    gr_enabled: {
        description: t("تفعيل حضور Gensokyo Radio.", "Enable Gensokyo Radio presence."),
        type: OptionType.BOOLEAN,
        default: false,
        hidden: true,
        onChange: () => onServiceChange?.(),
    },

    // AudioBookShelf
    abs_serverUrl: {
        description: t("رابط خادم AudioBookShelf.", "AudioBookShelf server URL."),
        type: OptionType.STRING,
        default: "",
        hidden: true,
    },
    abs_username: {
        description: t("اسم مستخدم AudioBookShelf.", "AudioBookShelf username."),
        type: OptionType.STRING,
        default: "",
        hidden: true,
    },
    abs_password: {
        description: t("كلمة مرور AudioBookShelf.", "AudioBookShelf password."),
        type: OptionType.STRING,
        default: "",
        hidden: true,
    },

    // stats.fm
    sfm_username: {
        description: t("اسم مستخدم Stats.fm.", "Stats.fm username."),
        type: OptionType.STRING,
        default: "",
        hidden: true,
    },
    sfm_shareUsername: {
        description: t("إظهار رابط الملف الشخصي في stats.fm.", "Show profile link on stats.fm."),
        type: OptionType.BOOLEAN,
        default: false,
        hidden: true,
    },
    sfm_shareSong: {
        description: t("إظهار رابط الأغنية في stats.fm.", "Show song link on stats.fm."),
        type: OptionType.BOOLEAN,
        default: true,
        hidden: true,
    },
    sfm_hideWithSpotify: {
        description: t("إخفاء حضور stats.fm إذا كان Spotify يعمل.", "Hide stats.fm presence if Spotify is running."),
        type: OptionType.BOOLEAN,
        default: false,
        hidden: true,
    },
    sfm_hideWithExternalRPC: {
        description: t("إخفاء حضور stats.fm إذا كان RPC خارجي يعمل.", "Hide stats.fm presence if an external RPC is running."),
        type: OptionType.BOOLEAN,
        default: false,
        hidden: true,
    },
    sfm_statusName: {
        description: t("نص الحالة المخصص.", "Custom status text."),
        type: OptionType.STRING,
        default: "Stats.fm",
        hidden: true,
    },
    sfm_nameFormat: {
        description: t("تنسيق الاسم.", "Name format."),
        type: OptionType.SELECT,
        options: [
            { label: t("استخدام اسم حالة مخصّص", "Use custom status name"), value: NameFormat.StatusName, default: true },
            { label: t("استخدام صيغة 'الفنان - الأغنية'", "Use format 'artist - song'"), value: NameFormat.ArtistFirst },
            { label: t("استخدام صيغة 'الأغنية - الفنان'", "Use format 'song - artist'"), value: NameFormat.SongFirst },
            { label: t("استخدام اسم الفنان فقط", "Use artist name only"), value: NameFormat.ArtistOnly },
            { label: t("استخدام اسم الأغنية فقط", "Use song name only"), value: NameFormat.SongOnly },
            { label: t("استخدام اسم الألبوم", "Use album name"), value: NameFormat.AlbumName },
        ],
        hidden: true,
    },
    sfm_useListeningStatus: {
        description: t("إظهار حالة الاستماع.", "Show listening status."),
        type: OptionType.BOOLEAN,
        default: true,
        hidden: true,
    },
    sfm_missingArt: {
        description: t("بديل عند غياب الصورة الفنية.", "Fallback when artwork is missing."),
        type: OptionType.SELECT,
        options: [
            { label: "Use large Stats.fm logo", value: "StatsFmLogo", default: true },
            { label: t("استخدام عنصر نائب عامّ", "Use generic placeholder"), value: "placeholder" },
        ],
        hidden: true,
    },
    sfm_showLogo: {
        description: t("إظهار شعار Stats.fm بجانب صورة الألبوم.", "Show Stats.fm logo next to album art."),
        type: OptionType.BOOLEAN,
        default: true,
        hidden: true,
    },
    sfm_alwaysHideArt: {
        description: t("تعطيل تنزيل صور الألبومات.", "Disable downloading album artwork."),
        type: OptionType.BOOLEAN,
        default: false,
        hidden: true,
    },

    // Jellyfin
    jf_serverUrl: {
        description: t("رابط خادم Jellyfin.", "Jellyfin server URL."),
        type: OptionType.STRING,
        default: "",
        hidden: true,
    },
    jf_apiKey: {
        description: t("مفتاح API لـ Jellyfin.", "Jellyfin API key."),
        type: OptionType.STRING,
        default: "",
        hidden: true,
    },
    jf_userId: {
        description: t("معرف مستخدم Jellyfin.", "Jellyfin user ID."),
        type: OptionType.STRING,
        default: "",
        hidden: true,
    },
    jf_nameDisplay: {
        description: t("تنسيق عرض الاسم.", "Name display format."),
        type: OptionType.SELECT,
        options: [
            { label: t("اسم المسلسل/الفيلم", "Series/Movie Name"), value: "default", default: true },
            { label: t("المسلسل - اسم الحلقة/المقطع/الفيلم", "Series - Episode/Track/Movie Name"), value: "full" },
            { label: t("مخصّص", "Custom"), value: "custom" },
        ],
        hidden: true,
    },
    jf_customName: {
        description: t("قالب الاسم المخصص.", "Custom name template."),
        type: OptionType.STRING,
        default: "",
        hidden: true,
    },
    jf_coverType: {
        description: t("نوع الغلاف لمسلسلات التلفزيون.", "Cover type for TV series."),
        type: OptionType.SELECT,
        options: [
            { label: t("غلاف المسلسل", "Series Cover"), value: "series", default: true },
            { label: t("غلاف الحلقة", "Episode Cover"), value: "episode" },
        ],
        hidden: true,
    },
    jf_episodeFormat: {
        description: t("تنسيق رقم الحلقة.", "Episode number format."),
        type: OptionType.SELECT,
        options: [
            { label: "S01E01", value: "long", default: true },
            { label: "1x01", value: "short" },
            { label: t("الموسم 1 الحلقة 1", "Season 1 Episode 1"), value: "fulltext" },
        ],
        hidden: true,
    },
    jf_showEpisodeName: {
        description: t("إظهار اسم الحلقة بعد معلومات الموسم/الحلقة.", "Show episode name after season/episode info."),
        type: OptionType.BOOLEAN,
        default: false,
        hidden: true,
    },
    jf_overrideType: {
        description: t("تجاوز نوع الحضور الغني.", "Override the rich presence type."),
        type: OptionType.SELECT,
        options: [
            { label: t("إيقاف", "Off"), value: "off", default: true },
            { label: t("يستمع", "Listening"), value: "2" },
            { label: t("يلعب", "Playing"), value: "0" },
            { label: t("يبثّ", "Streaming"), value: "1" },
            { label: t("يشاهد", "Watching"), value: "3" },
        ],
        hidden: true,
    },
    jf_showPausedState: {
        description: t("إظهار الحضور عند إيقاف الوسائط مؤقتاً.", "Show presence when media is paused."),
        type: OptionType.BOOLEAN,
        default: true,
        hidden: true,
    },
    jf_privacyMode: {
        description: t("إخفاء تفاصيل الوسائط.", "Hide media details."),
        type: OptionType.BOOLEAN,
        default: false,
        hidden: true,
    },

    // ListenBrainz
    lb_username: {
        description: t("اسم مستخدم ListenBrainz.", "ListenBrainz username."),
        type: OptionType.STRING,
        default: "",
        hidden: true,
    },
    lb_mbContact: {
        description: t("معلومات الاتصال بـ MusicBrainz لوكيل المستخدم.", "MusicBrainz contact info for the user agent."),
        type: OptionType.STRING,
        default: "",
        hidden: true,
    },
    lb_shareUsername: {
        description: t("إظهار رابط الملف الشخصي في ListenBrainz.", "Show profile link on ListenBrainz."),
        type: OptionType.BOOLEAN,
        default: false,
        hidden: true,
    },
    lb_shareSong: {
        description: t("إظهار رابط الأغنية في ListenBrainz.", "Show song link on ListenBrainz."),
        type: OptionType.BOOLEAN,
        default: true,
        hidden: true,
    },
    lb_hideWithSpotify: {
        description: t("إخفاء الحضور إذا كان Spotify يعمل.", "Hide presence if Spotify is running."),
        type: OptionType.BOOLEAN,
        default: true,
        hidden: true,
    },
    lb_hideWithActivity: {
        description: t("إخفاء الحضور إذا كان أي حضور آخر موجوداً.", "Hide presence if any other presence is active."),
        type: OptionType.BOOLEAN,
        default: false,
        hidden: true,
    },
    lb_useTimeBar: {
        description: t("استخدام مدة المقطع لعرض شريط الوقت.", "Use track duration to display a time bar."),
        type: OptionType.BOOLEAN,
        default: true,
        hidden: true,
    },
    lb_statusName: {
        description: t("نص الحالة المخصص.", "Custom status text."),
        type: OptionType.STRING,
        default: "some music",
        hidden: true,
    },
    lb_nameFormat: {
        description: t("تنسيق الاسم.", "Name format."),
        type: OptionType.SELECT,
        options: [
            { label: t("استخدام اسم حالة مخصّص", "Use custom status name"), value: NameFormat.StatusName, default: true },
            { label: t("استخدام صيغة 'الفنان - الأغنية'", "Use format 'artist - song'"), value: NameFormat.ArtistFirst },
            { label: t("استخدام صيغة 'الأغنية - الفنان'", "Use format 'song - artist'"), value: NameFormat.SongFirst },
            { label: t("استخدام اسم الفنان فقط", "Use artist name only"), value: NameFormat.ArtistOnly },
            { label: t("استخدام اسم الأغنية فقط", "Use song name only"), value: NameFormat.SongOnly },
            { label: t("استخدام اسم الألبوم", "Use album name"), value: NameFormat.AlbumName },
        ],
        hidden: true,
    },
    lb_useListeningStatus: {
        description: t("إظهار حالة الاستماع.", "Show listening status."),
        type: OptionType.BOOLEAN,
        default: true,
        hidden: true,
    },
    lb_missingArt: {
        description: t("بديل عند غياب الصورة الفنية.", "Fallback when artwork is missing."),
        type: OptionType.SELECT,
        options: [
            { label: "Use large ListenBrainz logo", value: "listenbrainzLogo", default: true },
            { label: t("استخدام عنصر نائب عامّ", "Use generic placeholder"), value: "placeholder" },
        ],
        hidden: true,
    },
    lb_useLogo: {
        description: t("إظهار شعار ListenBrainz على صورة الألبوم.", "Show ListenBrainz logo on album art."),
        type: OptionType.BOOLEAN,
        default: true,
        hidden: true,
    },

    // Gensokyo Radio
    gr_refreshInterval: {
        description: t("فترة التحديث بالثواني.", "Refresh interval in seconds."),
        type: OptionType.SLIDER,
        markers: [1, 2, 2.5, 3, 5, 10, 15],
        default: 15,
        hidden: true,
    },
});

export type SettingsStore = typeof settings["store"];
