/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { Button, Forms, React, showToast, Toasts } from "@webpack/common";

// ── Constants ──────────────────────────────────────────────────────────────────

const STYLE_ID = "live-wallpaper-style";
const CONTAINER_ID = "live-wallpaper-container";

// ── File picker ────────────────────────────────────────────────────────────────

function pickFile(): Promise<string | null> {
    return new Promise(resolve => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*,video/mp4,video/webm,.gif";
        input.style.display = "none";
        input.onchange = () => {
            const file = input.files?.[0];
            if (!file) { resolve(null); return; }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
            input.remove();
        };
        input.oncancel = () => { resolve(null); input.remove(); };
        document.body.appendChild(input);
        input.click();
    });
}

const LOCAL_DATA_KEY = "live-wallpaper-local-data";
const REMOTE_URL_KEY = "live-wallpaper-remote-url";

async function getWallpaperUrl(): Promise<string> {
    const remote = await DataStore.get(REMOTE_URL_KEY) as string | null;
    if (remote) return remote;
    const local = await DataStore.get(LOCAL_DATA_KEY) as string | null;
    return local || "";
}

function SettingsComponent() {
    const [currentUrl, setCurrentUrl] = React.useState("");
    const [inputValue, setInputValue] = React.useState("");

    React.useEffect(() => {
        getWallpaperUrl().then(url => {
            setCurrentUrl(url);
            if (!url.startsWith("data:")) setInputValue(url);
        });
    }, []);

    const isDataUrl = currentUrl.startsWith("data:");
    const hasFile = currentUrl.length > 0;

    return (
        <div className="live-wallpaper-settings">
            <Forms.FormTitle tag="h3">{t("ملف (صورة / GIF / فيديو)", "File (Image / Gif / Video)")}</Forms.FormTitle>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* File Picker */}
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <Button
                        size={Button.Sizes.SMALL}
                        onClick={async () => {
                            const dataUrl = await pickFile();
                            if (dataUrl) {
                                await DataStore.set(REMOTE_URL_KEY, "");
                                await DataStore.set(LOCAL_DATA_KEY, dataUrl);
                                setCurrentUrl(dataUrl);
                                setInputValue("");
                                applyWallpaper();
                                showToast(t("تم تطبيق الخلفية المحلية!", "Local wallpaper applied!"), Toasts.Type.SUCCESS);
                            }
                        }}
                    >
                        {t("📁 اختر ملفاً محلياً", "📁 Choose a local file")}
                    </Button>

                    {hasFile && (
                        <Button
                            size={Button.Sizes.SMALL}
                            color={Button.Colors.RED}
                            onClick={async () => {
                                await DataStore.set(REMOTE_URL_KEY, "");
                                await DataStore.set(LOCAL_DATA_KEY, "");
                                setCurrentUrl("");
                                setInputValue("");
                                applyWallpaper();
                                showToast(t("أُزيلت الخلفية", "Wallpaper removed"), Toasts.Type.SUCCESS);
                            }}
                        >
                            {t("🗑️ حذف", "🗑️ Delete")}
                        </Button>
                    )}
                </div>

                {/* URL Input (Alternative) */}
                <div style={{ marginTop: "8px" }}>
                    <Forms.FormTitle tag="h5" style={{ marginBottom: "8px" }}>{t("أو الصق رابطاً", "OR Paste a URL")}</Forms.FormTitle>
                    <input
                        type="text"
                        placeholder="https://example.com/video.mp4"
                        value={isDataUrl ? t("✅ [تم تحميل ملف محلي]", "✅ [Local file loaded]") : inputValue}
                        disabled={isDataUrl}
                        style={{
                            width: "100%",
                            padding: "8px",
                            borderRadius: "4px",
                            background: "var(--input-background)",
                            color: "var(--text-normal)",
                            border: "1px solid var(--input-border)",
                            cursor: isDataUrl ? "not-allowed" : "text",
                            opacity: isDataUrl ? 0.6 : 1
                        }}
                        onChange={async e => {
                            const val = e.target.value.trim();
                            setInputValue(val);
                            await DataStore.set(LOCAL_DATA_KEY, "");
                            await DataStore.set(REMOTE_URL_KEY, val);
                            setCurrentUrl(val);
                            applyWallpaper();
                        }}
                    />
                </div>
            </div>

            {hasFile && (
                <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
                    {isDataUrl
                        ? t(`✅ ملف محلي: ${Math.round(currentUrl.length / 1024)} كيلوبايت`, `✅ Local file: ${Math.round(currentUrl.length / 1024)} KB`)
                        : t(`✅ رابط: ${currentUrl.slice(0, 50)}${currentUrl.length > 50 ? "..." : ""}`, `✅ URL: ${currentUrl.slice(0, 50)}${currentUrl.length > 50 ? "..." : ""}`)
                    }
                </div>
            )}

            <div style={{ margin: "20px 0", borderBottom: "1px solid var(--background-modifier-accent)" }} />
        </div>
    );
}

// ── Settings ───────────────────────────────────────────────────────────────────

const settings = definePluginSettings({
    main: {
        type: OptionType.COMPONENT,
        component: SettingsComponent,
    },
    opacity: {
        type: OptionType.SLIDER,
        description: t("شفافية الخلفية (0 = مخفية، 0.5 = الأقصى)", "Wallpaper opacity (0 = invisible, 0.5 = max)"),
        markers: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5],
        default: 0.15,
        stickToMarkers: false,
        restartNeeded: false,
        onChange(v: number) { _lwOpacity = v; applyWallpaper(); },
    },
    blur: {
        type: OptionType.SLIDER,
        description: t("ضبابية الخلفية (بكسل)", "Wallpaper blur (px)"),
        markers: [0, 2, 5, 10, 15, 20, 30],
        default: 0,
        stickToMarkers: false,
        restartNeeded: false,
        onChange(v: number) { _lwBlur = v; applyWallpaper(); },
    },
    brightness: {
        type: OptionType.SLIDER,
        description: t("سطوع الخلفية (0.1 = معتم جداً، 1 = عادي، 2 = ساطع جداً)", "Wallpaper brightness (0.1 = very dark, 1 = normal, 2 = very bright)"),
        markers: [0.1, 0.2, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0],
        default: 1.0,
        stickToMarkers: false,
        restartNeeded: false,
        onChange(v: number) { _lwBrightness = v; applyWallpaper(); },
    },
    muted: {
        type: OptionType.BOOLEAN,
        description: t("مكتوم (بلا صوت افتراضياً)", "Muted (no sound by default)"),
        default: true,
        restartNeeded: false,
        onChange(v: boolean) { _lwMuted = v; applyWallpaper(); },
    },
    volume: {
        type: OptionType.SLIDER,
        description: t("مستوى صوت الخلفية", "Wallpaper volume"),
        markers: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
        default: 1.0,
        stickToMarkers: false,
        restartNeeded: false,
        onChange(v: number) { _lwVolume = v; applyWallpaper(); },
    },
});

let _lwOpacity = 0.15;
let _lwBlur = 0;
let _lwBrightness = 1.0;
let _lwMuted = true;
let _lwVolume = 1.0;
const cacheLwSettings = () => {
    _lwOpacity = settings.store.opacity ?? 0.15;
    _lwBlur = settings.store.blur ?? 0;
    _lwBrightness = settings.store.brightness ?? 1.0;
    _lwMuted = settings.store.muted ?? true;
    _lwVolume = settings.store.volume ?? 1.0;
};

let activeVideo: HTMLVideoElement | null = null;

function pauseVideo() {
    if (activeVideo && !activeVideo.paused) {
        activeVideo.pause();
    }
}

function playVideo() {
    if (activeVideo && activeVideo.paused && !document.hidden && document.hasFocus()) {
        activeVideo.play().catch(() => {});
    }
}

function handleVisChange() {
    if (document.hidden) pauseVideo();
    else playVideo();
}

function handleFocusChange() {
    if (document.hasFocus()) playVideo();
    else pauseVideo();
}

// ── Wallpaper injection ────────────────────────────────────────────────────────

function removeWallpaperElements() {
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(CONTAINER_ID)?.remove();
}

async function applyWallpaper() {
    removeWallpaperElements();

    const url = await getWallpaperUrl();
    if (!url) return;

    const opacity = _lwOpacity;
    const blur = _lwBlur;
    const brightness = _lwBrightness;
    const muted = _lwMuted;
    const volume = _lwVolume;
    const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.startsWith("data:video/");

    const filters: string[] = [];
    if (blur > 0) filters.push(`blur(${blur}px)`);
    if (brightness !== 1.0) filters.push(`brightness(${brightness})`);
    const filterCSS = filters.length > 0 ? `filter: ${filters.join(" ")};` : "";

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
/* ── LiveWallpaper: full screen overlay OVER Discord ── */
#${CONTAINER_ID} {
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    z-index: 2147483647;
    pointer-events: none;
    overflow: hidden;
    opacity: ${opacity};
    ${filterCSS}
}
#${CONTAINER_ID} img,
#${CONTAINER_ID} video {
    width: 100%; height: 100%;
    object-fit: cover;
}
`.trim();
    document.head.appendChild(style);

    const container = document.createElement("div");
    container.id = CONTAINER_ID;

    if (isVideo) {
        const video = document.createElement("video");
        video.src = url;
        video.autoplay = true;
        video.loop = true;
        video.muted = muted;
        video.volume = volume;
        video.playsInline = true;
        activeVideo = video;
        container.appendChild(video);
    } else {
        activeVideo = null;
        const img = document.createElement("img");
        img.src = url;
        img.alt = "";
        img.draggable = false;
        container.appendChild(img);
    }

    document.body.appendChild(container);
}

export default definePlugin({
    name: "LiveWallpaper",
    description: "Global wallpaper for the entire Discord interface (image, gif, video). Compatible with ChannelWallpaper.",
    authors: [{ name: t("مؤلف غير معروف", "Unknown"), id: 0n }],
    settings,

    start() {
        cacheLwSettings();
        setTimeout(applyWallpaper, 300);
        document.addEventListener("visibilitychange", handleVisChange);
        window.addEventListener("focus", handleFocusChange);
        window.addEventListener("blur", handleFocusChange);
    },

    stop() {
        removeWallpaperElements();
        document.removeEventListener("visibilitychange", handleVisChange);
        window.removeEventListener("focus", handleFocusChange);
        window.removeEventListener("blur", handleFocusChange);
        activeVideo = null;
    },
});
