/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, Menu, React, SelectedChannelStore, showToast, Toasts } from "@webpack/common";

// ── Settings ───────────────────────────────────────────────────────────────────

const settings = definePluginSettings({
    wallpapers: {
        type: OptionType.STRING,
        description: "Wallpapers JSON — do not modify manually (managed by plugin)",
        default: "{}",
        hidden: true,
        restartNeeded: false,
        onChange() { _invalidateWpCache(); }
    },
    opacity: {
        type: OptionType.SLIDER,
        description: "Wallpaper opacity (0 = invisible, 1 = full)",
        markers: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
        default: 0.3,
        stickToMarkers: false,
        restartNeeded: false,
        onChange(v: number) { _cachedOpacity = v; }
    },
    blur: {
        type: OptionType.SLIDER,
        description: "Wallpaper blur (px)",
        markers: [0, 2, 5, 10, 15, 20],
        default: 0,
        stickToMarkers: false,
        restartNeeded: false,
        onChange(v: number) { _cachedBlur = v; }
    },
    defaultWallpaper: {
        type: OptionType.STRING,
        description: "Default wallpaper URL (for channels without a custom one). Empty = none.",
        default: "",
        restartNeeded: false,
    },
});

let _cachedOpacity = 0.3;
let _cachedBlur = 0;
const cacheWpSettings = () => {
    _cachedOpacity = settings.store.opacity ?? 0.3;
    _cachedBlur = settings.store.blur ?? 0;
};

let _wpCache: Record<string, string> | null = null;
let _wpRaw = "";

function getWallpapers(): Record<string, string> {
    const raw = settings.store.wallpapers || "{}";
    if (raw === _wpRaw && _wpCache !== null) return _wpCache;
    try { _wpCache = JSON.parse(raw); } catch { _wpCache = {}; }
    _wpRaw = raw;
    return _wpCache!;
}

function _invalidateWpCache() { _wpCache = null; _wpRaw = ""; }

// Fully local — the wallpaper is only ever stored in your own settings and rendered in your
// own client. Nothing is uploaded or sent to anyone (the upstream fork's Imgur/VPS/hidden-message
// sync was removed for privacy and safety).
function saveWallpaper(channelId: string, url: string) {
    const wp = getWallpapers();
    if (url) wp[channelId] = url;
    else delete wp[channelId];
    settings.store.wallpapers = JSON.stringify(wp);
    _invalidateWpCache();
    applyWallpaper(channelId);
}

function getWallpaper(channelId: string): string {
    const wp = getWallpapers();
    return wp[channelId] || settings.store.defaultWallpaper || "";
}

function hasWallpaper(channelId: string): boolean {
    const wp = getWallpapers();
    return !!wp[channelId];
}

// ── File / URL pickers ─────────────────────────────────────────────────────────

function pickFileRaw(): Promise<File | null> {
    return new Promise(resolve => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*,video/mp4,video/webm,.gif";
        input.style.display = "none";
        input.onchange = () => {
            const file = input.files?.[0];
            resolve(file || null);
            input.remove();
        };
        input.oncancel = () => { resolve(null); input.remove(); };
        document.body.appendChild(input);
        input.click();
    });
}

function promptUrl(): Promise<string | null> {
    return new Promise(resolve => {
        const url = prompt(t("أدخل رابط الصورة أو GIF أو الفيديو:", "Enter the URL for the image, gif, or video:"));
        resolve(url?.trim() || null);
    });
}

// ── CSS Injection ──────────────────────────────────────────────────────────────

const STYLE_ID = "channel-wallpaper-style";
const CONTAINER_ID = "channel-wallpaper-container";

function removeWallpaperElements() {
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(CONTAINER_ID)?.remove();
}

let activeVideo: HTMLVideoElement | null = null;

function pauseVideo() {
    if (activeVideo && !activeVideo.paused) {
        activeVideo.pause();
    }
}

function playVideo() {
    if (activeVideo && activeVideo.paused && !document.hidden && document.hasFocus()) {
        activeVideo.play().catch(() => { });
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

// مؤقّتات الحقن الجارية — تُلغى عند الإيقاف كي لا يبقى نبضٌ يعمل بعد تعطيل الإضافة.
const injectTimers = new Set<ReturnType<typeof setInterval>>();

function applyWallpaper(channelId?: string) {
    removeWallpaperElements();

    const cid = channelId || SelectedChannelStore?.getChannelId?.();
    if (!cid) return;

    const url = getWallpaper(cid);
    if (!url) return;

    const opacity = _cachedOpacity;
    const blur = _cachedBlur;
    const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.startsWith("data:video/");

    if (!document.getElementById(STYLE_ID)) {
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
[class*="messagesWrapper"],
[class*="chatContent"],
[class*="chat-messages"],
[class*="scroller"][class*="message"] {
    background: transparent !important;
}

#${CONTAINER_ID} {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
    opacity: ${opacity};
    ${blur > 0 ? `filter: blur(${blur}px);` : ""}
}

#${CONTAINER_ID} img,
#${CONTAINER_ID} video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

[class*="messagesWrapper"],
[class*="chatContent"] {
    position: relative !important;
}
`.trim();
        document.head.appendChild(style);
    }

    const container = document.createElement("div");
    container.id = CONTAINER_ID;

    if (isVideo) {
        const video = document.createElement("video");
        video.src = url;
        video.autoplay = true;
        video.loop = true;
        video.muted = true;
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

    const tryInject = () => {
        const target =
            document.querySelector('[class*="messagesWrapper"]') ||
            document.querySelector('[class*="chat-messages"]') ||
            document.querySelector('[class*="chatContent"]') ||
            document.querySelector('[class*="content_"][class*="chat"]');

        if (target && target instanceof HTMLElement) {
            if (!target.closest('[class*="popout"]') && !target.closest('[class*="modal"]')) {
                if (!target.querySelector(`#${CONTAINER_ID}`)) {
                    (target as HTMLElement).style.position = "relative";
                    target.prepend(container);
                }
                return true;
            }
        }
        return false;
    };

    if (!tryInject()) {
        // استقصاء دوري بدل MutationObserver على شجرة الدردشة: المراقب كان يُستدعى مع كل
        // رسالة وكل تمرير (آلاف المرّات في الدقيقة) لمجرّد انتظار ظهور حاوية واحدة. نبض
        // كل نصف ثانية يكفي لعمل يحدث مرّة، وبكلفة تكاد لا تُذكر.
        let polls = 0;
        const timer = setInterval(() => {
            if (tryInject() || ++polls > 30) {   // ‎30 × 500ms = ١٥ ثانية سقفاً
                clearInterval(timer);
                injectTimers.delete(timer);
            }
        }, 500);
        injectTimers.add(timer);
    }
}

// ── Context menu actions ───────────────────────────────────────────────────────

async function setWallpaperFromFile(channelId: string) {
    const file = await pickFileRaw();
    if (!file) return;

    // Stored locally as a data URL — never uploaded anywhere.
    const reader = new FileReader();
    reader.onload = () => {
        saveWallpaper(channelId, reader.result as string);
        showToast(t("تم تطبيق الخلفية (محلياً)", "Wallpaper applied (locally)"), Toasts.Type.SUCCESS);
    };
    reader.readAsDataURL(file);
}

async function setWallpaperFromUrl(channelId: string) {
    const url = await promptUrl();
    if (url) {
        saveWallpaper(channelId, url);
        showToast(t("تم تطبيق الخلفية", "Wallpaper applied"), Toasts.Type.SUCCESS);
    }
}

function removeWallpaper(channelId: string) {
    saveWallpaper(channelId, "");
    showToast(t("تم حذف الخلفية", "Wallpaper deleted"), Toasts.Type.SUCCESS);
}

// ── Context Menu Patches ───────────────────────────────────────────────────────

function WallpaperIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v8.5l4-3 3 2.5 4-4 5 4V6H4zm0 12h16v-1.2l-5-4-3.8 3.8L8 14.5l-4 3V18zm5-8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
        </svg>
    );
}

function buildWallpaperMenu(channelId: string): React.ReactElement {
    const has = hasWallpaper(channelId);

    return (
        <Menu.MenuItem
            id="channel-wallpaper"
            label={t("خلفية", "Wallpaper")}
            icon={WallpaperIcon}
        >
            <Menu.MenuItem
                id="wallpaper-from-file"
                label={t("📁 من ملف...", "📁 From a file...")}
                action={() => setWallpaperFromFile(channelId)}
            />
            <Menu.MenuItem
                id="wallpaper-from-url"
                label={t("🔗 من رابط...", "🔗 From a URL...")}
                action={() => setWallpaperFromUrl(channelId)}
            />
            {has && (
                <>
                    <Menu.MenuSeparator />
                    <Menu.MenuItem
                        id="wallpaper-remove"
                        label={t("🗑️ حذف الخلفية", "🗑️ Delete wallpaper")}
                        color="danger"
                        action={() => removeWallpaper(channelId)}
                    />
                </>
            )}
        </Menu.MenuItem>
    );
}

const userContextMenuPatch: NavContextMenuPatchCallback = (children, { user }: any) => {
    if (!user?.id) return;
    // Resolve the DM channel with this specific user (not the current channel).
    const channelId = (ChannelStore as any).getDMFromUserId?.(user.id);
    if (!channelId) return;

    children.push(buildWallpaperMenu(channelId));
};

const channelContextMenuPatch: NavContextMenuPatchCallback = (children, { channel }: any) => {
    if (!channel?.id) return;
    children.push(buildWallpaperMenu(channel.id));
};

// ── Plugin ─────────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "ChannelWallpaper",
    authors: [Devs.rushii, Devs.Nickyux],
    description: "Allows for custom backgrounds for every individual channel. Fully local — nothing is uploaded or shared.",
    settings,

    contextMenus: {
        "user-context": userContextMenuPatch,
        "channel-context": channelContextMenuPatch,
        "gdm-context": channelContextMenuPatch,
    },

    flux: {
        CHANNEL_SELECT({ channelId }: { channelId: string; }) {
            if (channelId) {
                setTimeout(() => applyWallpaper(channelId), 100);
            } else {
                removeWallpaperElements();
            }
        }
    },

    start() {
        cacheWpSettings();
        const cid = SelectedChannelStore.getChannelId();
        if (cid) {
            setTimeout(() => applyWallpaper(cid), 500);
        }
        document.addEventListener("visibilitychange", handleVisChange);
        window.addEventListener("focus", handleFocusChange);
        window.addEventListener("blur", handleFocusChange);
    },

    stop() {
        for (const timer of injectTimers) clearInterval(timer);
        injectTimers.clear();
        removeWallpaperElements();
        document.removeEventListener("visibilitychange", handleVisChange);
        window.removeEventListener("focus", handleFocusChange);
        window.removeEventListener("blur", handleFocusChange);
        activeVideo = null;
    }
});
