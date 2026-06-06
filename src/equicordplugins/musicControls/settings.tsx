/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import { ButtonCompat } from "@components/Button";
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { SettingsSection } from "@components/settings/tabs/plugins/components/Common";
import { t } from "@utils/esharqI18n";
import { makeRange, OptionType } from "@utils/types";
import { MaskedLink, Select, showToast, TextInput, Toasts } from "@webpack/common";

import hoverOnlyStyle from "./hoverOnly.css?managed";
import { clearLyricsCache, removeTranslations } from "./spotify/lyrics/api";
import languages from "./spotify/lyrics/providers/translator/languages";
import { Provider } from "./spotify/lyrics/providers/types";

const sliderOptions = {
    markers: makeRange(-2500, 2500, 250),
    stickToMarkers: true,
};

export function toggleHoverControls(value: boolean) {
    (value ? enableStyle : disableStyle)(hoverOnlyStyle);
}

function InstallInstructions() {
    return (
        <section>
            <HeadingSecondary>{t("كيفية التثبيت", "How to install")}</HeadingSecondary>
            <Paragraph>
                Install <MaskedLink href="https://github.com/Inrixia/TidaLuna#installation">TidaLuna</MaskedLink> from here, then go to TidalLuna settings &rarr; Plugin stores &rarr; Install <code>@vmohammad/api</code>
            </Paragraph>
        </section>
    );
}

function LyricsProviderSettings() {
    const { store } = settings;

    return (
        <>
            <SettingsSection name="Lyrics Provider" description="Where lyrics are fetched from.">
                <Select
                    options={[
                        { value: Provider.Lrclib, label: "LRCLIB", default: true },
                        { value: Provider.Spotify, label: "Spotify (Musixmatch)" },
                    ]}
                    isSelected={v => v === store.lyricsProvider}
                    select={v => { store.lyricsProvider = v as Provider; }}
                    serialize={v => v}
                    placeholder={t("اختر مزوّد كلمات", "Select a lyrics provider")}
                />
            </SettingsSection>

            {store.lyricsProvider === Provider.Spotify && (
                <SettingsSection
                    name="Spotify Lyrics API Base URL"
                    description="Custom instance base URL (for example: http://localhost:8080)."
                >
                    <TextInput
                        type="text"
                        value={store.spotifyLyricsApiUrl}
                        onChange={v => {
                            store.spotifyLyricsApiUrl = v;
                            void clearLyricsCache();
                            showToast("Lyrics cache purged", Toasts.Type.SUCCESS);
                        }}
                        placeholder="https://spotify-lyrics-api-pi.vercel.app"
                        maxLength={null}
                    />
                </SettingsSection>
            )}
        </>
    );
}

export const settings = definePluginSettings({
    hoverControls: {
        description: t("إظهار أدوات التحكم عند التمرير بالمؤشر", "Show controls when hovering with the cursor"),
        type: OptionType.BOOLEAN,
        default: false,
        onChange: v => toggleHoverControls(v)
    },
    showMusicNoteOnNoLyrics: {
        description: t("إظهار أيقونة نوتة موسيقية عند عدم وجود كلمات أغنية", "Show a music note icon when there are no lyrics"),
        type: OptionType.BOOLEAN,
        default: true,
    },
    lyricsPosition: {
        description: t("موضع كلمات الأغنية", "Lyrics position"),
        type: OptionType.SELECT,
        options: [
            { value: "above", label: t("فوق المشغّل(ات)", "Above Player(s)") },
            { value: "below", label: t("أسفل  المشغّل(ات)", "Below  Player(s)"), default: true },
        ],
    },
    lyricsProvider: {
        description: t("مصدر جلب كلمات الأغاني", "Source for fetching song lyrics"),
        type: OptionType.SELECT,
        options: [
            { value: Provider.Lrclib, label: "LRCLIB", default: true },
            { value: Provider.Spotify, label: "Spotify (Musixmatch)" },
        ],
        hidden: true,
    },
    spotifyLyricsApiUrl: {
        type: OptionType.STRING,
        description: t("رابط API كلمات Spotify الأساسي.", "Base URL for the Spotify lyrics API."),
        hidden: true,
        default: "https://spotify-lyrics-api-pi.vercel.app",
        onChange: async () => {
            await clearLyricsCache();
            showToast("Lyrics cache purged", Toasts.Type.SUCCESS);
        }
    },
    lyricsProviderSettings: {
        type: OptionType.COMPONENT,
        component: LyricsProviderSettings,
    },
    translateTo: {
        description: t("ترجمة كلمات الأغنية إلى - سيؤدي تغيير هذا إلى حذف الترجمات الموجودة", "Translate lyrics to - changing this will delete existing translations"),
        type: OptionType.SELECT,
        options: languages,
        onChange: async () => {
            await removeTranslations();
            showToast("Translations cleared", Toasts.Type.SUCCESS);
        }
    },
    lyricsConversion: {
        description: t("ترجمة كلمات الأغنية أو تحويلها إلى الحروف اللاتينية تلقائياً", "Automatically translate lyrics or convert them to Latin characters"),
        type: OptionType.SELECT,
        options: [
            { value: Provider.None, label: t("لا شيء", "None"), default: true },
            { value: Provider.Translated, label: "Translate" },
            { value: Provider.Romanized, label: t("كتابة لاتينية", "Romanize") },
        ]
    },
    fallbackProvider: {
        description: t("عند فشل مزود كلمات الأغاني، جرّب مزودين آخرين", "When the lyrics provider fails, try other providers"),
        type: OptionType.BOOLEAN,
        default: true,
    },
    showFailedToasts: {
        description: t("إخفاء الإشعارات عند فشل جلب كلمات الأغنية", "Hide notifications when fetching lyrics fails"),
        type: OptionType.BOOLEAN,
        default: true,
    },
    lyricDelay: {
        description: "",
        type: OptionType.SLIDER,
        default: 0,
        ...sliderOptions
    },
    purgeLyricsCache: {
        description: t("مسح ذاكرة التخزين المؤقت لكلمات الأغاني", "Clear the lyrics cache"),
        type: OptionType.COMPONENT,
        component: () => (
            <ButtonCompat
                color={ButtonCompat.Colors.RED}
                onClick={() => {
                    clearLyricsCache();
                    showToast("Lyrics cache purged", Toasts.Type.SUCCESS);
                }}
            >{t("تفريغ الذاكرة المؤقّتة", "Purge Cache")}</ButtonCompat>
        ),
    },
    spotifySectionTitle: {
        type: OptionType.COMPONENT,
        component: () => (
            <section>
                <HeadingSecondary>Spotify</HeadingSecondary>
            </section>
        )
    },
    showSpotifyControls: {
        description: t("إظهار أدوات التحكم في Spotify", "Show Spotify controls"),
        type: OptionType.BOOLEAN,
        default: false,
    },
    showSpotifyLyrics: {
        description: t("إظهار كلمات Spotify", "Show Spotify lyrics"),
        type: OptionType.BOOLEAN,
        default: false,
    },
    useSpotifyUris: {
        type: OptionType.BOOLEAN,
        description: t("فتح روابط Spotify URI بدلاً من روابط URL. يعمل فقط إذا كان Spotify مثبتاً وقد لا يعمل على جميع الأنظمة", "Open Spotify URI links instead of URL links. Only works if Spotify is installed and may not work on all systems"),
        default: false
    },
    previousButtonRestartsTrack: {
        type: OptionType.BOOLEAN,
        description: t("إعادة تشغيل الأغنية الحالية عند الضغط على زر السابق إذا تجاوز وقت التشغيل 3 ثوانٍ", "Restart the current song when pressing the previous button if playback time exceeds 3 seconds"),
        default: true
    },

    tdalSectionTitle: {
        type: OptionType.COMPONENT,
        component: () => (
            <section>
                <HeadingSecondary>Tidal</HeadingSecondary>
            </section>
        )
    },
    installTidalWithWS: {
        type: OptionType.COMPONENT,
        component: () => <InstallInstructions />
    },
    showTidalControls: {
        description: t("إظهار مشغل Tidal", "Show Tidal player"),
        type: OptionType.BOOLEAN,
        default: false,
    },
    showTidalLyrics: {
        description: t("إظهار أدوات التحكم في Tidal", "Show Tidal controls"),
        type: OptionType.BOOLEAN,
        default: false,
    },
    websocketURL: {
        type: OptionType.STRING,
        description: t("الافتراضي هو ws://localhost:24123", "Default is ws://localhost:24123"),
        default: "ws://localhost:24123",
        restartNeeded: true,
    }
});
