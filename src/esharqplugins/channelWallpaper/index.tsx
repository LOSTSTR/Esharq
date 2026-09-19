/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalProps, ModalRoot, openModal } from "@utils/esharqModals";
import { ModalSize } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { Button, ChannelStore, Menu, React, SelectedChannelStore, showToast, Text, TextInput, Toasts } from "@webpack/common";

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
        onChange(v: number) { _cachedOpacity = v; syncLiveLook(); }
    },
    blur: {
        type: OptionType.SLIDER,
        description: "Wallpaper blur (px)",
        markers: [0, 2, 5, 10, 15, 20],
        default: 0,
        stickToMarkers: false,
        restartNeeded: false,
        onChange(v: number) { _cachedBlur = v; syncLiveLook(); }
    },
    defaultWallpaper: {
        type: OptionType.STRING,
        description: "Default wallpaper URL (for channels without a custom one). Empty = none.",
        default: "",
        restartNeeded: false,
        // كان تغييرها لا يظهر حتى تُبدَّل القناة. ومهلةٌ قصيرة لأنّ الحقل نصّيّ:
        // بلا تأجيل يُرسم رابطٌ نصف مكتوبٍ مع كلّ حرف.
        onChange() { if (started) scheduleApply(undefined, 300); },
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
    // 🔴 قائمة السياق تُمرّر معرّف قناةٍ أخرى، وكان يُرسم خلفيّتها فوق القناة المفتوحة
    // أمام المستخدم. بلا وسيط: تُحسب القناة المعروضة الآن، فتصيب دائماً.
    applyWallpaper();
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

/**
 * 🔴 كانت تستعمل `window.prompt`، وهي **غير مدعومة في عميل ديسكورد**: تُلقي
 * "prompt() is not supported." (قِيس حيّاً ٢٠٢٦-٠٩-١٩) — فخيار «من رابط» كان معطّلاً
 * تماماً، ولا يُطبَّق أيّ رابطٍ أبداً. نافذةٌ حقيقيّة كالتي تستعملها بقيّة إضافاتنا.
 */
function UrlModal({ modalProps, onSubmit }: { modalProps: ModalProps; onSubmit: (url: string) => void; }) {
    const [url, setUrl] = React.useState("");
    const submit = () => {
        const trimmed = url.trim();
        modalProps.onClose();
        if (trimmed) onSubmit(trimmed);
    };

    return (
        <ModalRoot {...modalProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" tag="h1">{t("خلفية القناة", "Channel wallpaper")}</Text>
                <ModalCloseButton onClick={modalProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <Text variant="text-sm/normal">{t("أدخل رابط الصورة أو GIF أو الفيديو:", "Enter the URL for the image, gif, or video:")}</Text>
                <TextInput
                    value={url}
                    onChange={setUrl}
                    placeholder="https://…"
                    autoFocus
                    onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") submit(); }}
                />
            </ModalContent>
            <ModalFooter>
                <Button onClick={submit}>{t("تطبيق", "Apply")}</Button>
            </ModalFooter>
        </ModalRoot>
    );
}

function promptUrl(): Promise<string | null> {
    return new Promise(resolve => {
        let answered = false;
        openModal(modalProps => (
            <UrlModal
                modalProps={{
                    ...modalProps,
                    onClose: () => {
                        // إغلاقٌ بلا إدخال يجب أن يحلّ الوعد أيضاً، وإلّا بقي معلّقاً للأبد.
                        if (!answered) { answered = true; resolve(null); }
                        return modalProps.onClose();
                    }
                } as ModalProps}
                onSubmit={url => { answered = true; resolve(url); }}
            />
        ));
    });
}

// ── CSS Injection ──────────────────────────────────────────────────────────────

const STYLE_ID = "channel-wallpaper-style";
const CONTAINER_ID = "channel-wallpaper-container";

/**
 * 🔴 كانت الشفافية والضبابية **مخبوزتين** في نصّ الورقة، والورقة لا تُبنى إلّا إن لم
 * تكن موجودة — فسحبُ أيّ من الشريطين لا يُغيّر شيئاً حتى تُبدَّل القناة. والورقة الآن
 * ثابتة، والرقمان يسكنان متغيّرين مخصّصين على الحاوية نفسها: مصدرٌ واحد للقيمة،
 * يكتبه البناء والشريطان معاً، بلا نمطٍ مضمَّن يتغلّب على القاعدة فيتناقضان.
 */
const STYLE_TEXT = `
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
    opacity: var(--cw-opacity, 0.3);
    /* none لا blur(0px): ضبابيةٌ صفريّة تبقى مُرشِّحاً، فتُرقّي الطبقة إلى المُركِّب
       وتمرّ بمرشِّحٍ في كلّ رسم بلا أثرٍ مرئيّ. */
    filter: var(--cw-filter, none);
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

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    document.head.appendChild(style);
}

/** المصدر الوحيد للرقمين. */
function syncLook(el: HTMLElement | null) {
    if (!el) return;
    el.style.setProperty("--cw-opacity", String(_cachedOpacity));
    el.style.setProperty("--cw-filter", _cachedBlur > 0 ? `blur(${_cachedBlur}px)` : "none");
}

function syncLiveLook() {
    syncLook(document.getElementById(CONTAINER_ID));
}

/** مستمعو الإعدادات يُسجَّلون لكلّ إضافة ولو كانت مطفأة، فلا يُرسم شيءٌ قبل التشغيل. */
let started = false;
let activeVideo: HTMLVideoElement | null = null;
/** الرابط المعروض فعلاً — كي لا تُهدم الحاوية وتُبنى من جديد على الرابط نفسه. */
let appliedUrl: string | null = null;

/**
 * 🔴 نزعُ `<video>` من الشجرة لا يوقفه: يظلّ يفكّ ترميز مصدره الدائر حتى يجمعه الجامع،
 * فيبقى استهلاك المعالج بعد مغادرة القناة — وعودةُ التركيز كانت تُحييه. الفخّ نفسه
 * موثّقٌ ومُصلَحٌ في LiveWallpaper عندنا.
 */
function releaseVideo(video: HTMLVideoElement) {
    try {
        video.pause();
        video.removeAttribute("src");
        video.load();
    } catch { /* العنصر مهدومٌ أصلاً */ }
}

function removeContainer() {
    const container = document.getElementById(CONTAINER_ID);
    if (container) {
        for (const video of Array.from(container.getElementsByTagName("video"))) releaseVideo(video);
        container.remove();
    }
    // يغطّي أيضاً حاويةً بُنيت ولم تُلحَق بالشجرة قطّ.
    if (activeVideo) {
        releaseVideo(activeVideo);
        activeVideo = null;
    }
    appliedUrl = null;
}

function removeWallpaperElements() {
    document.getElementById(STYLE_ID)?.remove();
    removeContainer();
}

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
function clearInjectTimers() {
    for (const timer of injectTimers) clearInterval(timer);
    injectTimers.clear();
}

/**
 * 🔴 نداءٌ مؤجَّلٌ واحدٌ لا أكثر. كان كلّ تبديل قناةٍ يضع مؤقّتاً خامّاً لا يُحفظ معرّفه:
 * تبديلٌ سريع يترك عدّة نداءاتٍ متسابقة فتُرسم خلفيّة القناة السابقة، و`stop()` لا
 * يستطيع إلغاء واحدٍ منها — فتبقى الخلفيّة على الشاشة بعد تعطيل الإضافة إلى الأبد.
 */
let pendingApply: ReturnType<typeof setTimeout> | null = null;
function cancelPendingApply() {
    if (pendingApply !== null) { clearTimeout(pendingApply); pendingApply = null; }
}
function scheduleApply(channelId: string | undefined, delay: number) {
    cancelPendingApply();
    pendingApply = setTimeout(() => { pendingApply = null; applyWallpaper(channelId); }, delay);
}

function findChatTarget(): HTMLElement | null {
    const target =
        document.querySelector('[class*="messagesWrapper"]') ||
        document.querySelector('[class*="chat-messages"]') ||
        document.querySelector('[class*="chatContent"]') ||
        document.querySelector('[class*="content_"][class*="chat"]');

    if (!(target instanceof HTMLElement)) return null;
    if (target.closest('[class*="popout"]') || target.closest('[class*="modal"]')) return null;
    return target;
}

function applyWallpaper(channelId?: string) {
    clearInjectTimers();

    const cid = channelId || SelectedChannelStore?.getChannelId?.();
    const url = cid ? getWallpaper(cid) : "";

    if (!url) {
        removeWallpaperElements();
        return;
    }

    const target = findChatTarget();
    const existing = document.getElementById(CONTAINER_ID);

    // 🔴 نفس الرابط وحاويةٌ حيّةٌ في مكانها: لا تُهدم وتُبنى من جديد. كان كلّ تبديل قناة
    // يُعيد بناء كلّ شيء ولو لم يتغيّر الرابط (والخلفيّة الافتراضيّة تعني أنّ ذلك يقع بين
    // كلّ قناتين)، ومع صورةٍ محفوظةٍ بترميز base64 يُعاد فكّ ترميزها كاملةً في كلّ مرّة.
    if (existing && target && appliedUrl === url && target.contains(existing)) {
        ensureStyle();
        syncLook(existing);
        playVideo();
        return;
    }

    removeContainer();
    ensureStyle();

    const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.startsWith("data:video/");

    const container = document.createElement("div");
    container.id = CONTAINER_ID;
    syncLook(container);

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

    appliedUrl = url;

    const tryInject = () => {
        const t = findChatTarget();
        if (!t) return false;
        if (!t.querySelector(`#${CONTAINER_ID}`)) {
            t.style.position = "relative";
            t.prepend(container);
        }
        return true;
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

/**
 * 🔴 الملفّ يُخزَّن رابطَ بيانات **داخل settings.json**، وكلّ كتابة إعدادٍ في إشراق كلّه
 * تُسلسل الملفّ كاملاً وتمرّره وتكتبه على القرص. فملفٌّ كبيرٌ هنا يُبطّئ كلّ إعدادٍ آخر،
 * لا هذه الإضافة وحدها. ولمن أراد خلفيّةً كبيرة: «من رابط».
 */
const MAX_LOCAL_FILE_BYTES = 2 * 1024 * 1024;

async function setWallpaperFromFile(channelId: string) {
    const file = await pickFileRaw();
    if (!file) return;

    if (file.size > MAX_LOCAL_FILE_BYTES) {
        showToast(t("الملفّ أكبر من ٢ ميغابايت — استعمل «من رابط» للملفّات الكبيرة.", "The file is larger than 2 MB — use “From a URL” for large files."), Toasts.Type.FAILURE);
        return;
    }

    // Stored locally as a data URL — never uploaded anywhere.
    const reader = new FileReader();
    reader.onload = () => {
        saveWallpaper(channelId, reader.result as string);
        showToast(t("تم تطبيق الخلفية (محلياً)", "Wallpaper applied (locally)"), Toasts.Type.SUCCESS);
    };
    // 🔴 بلا هذا يفشل القراءة بصمتٍ تامّ: لا خلفيّة ولا رسالة.
    reader.onerror = () => {
        showToast(t("تعذّرت قراءة الملفّ.", "Could not read the file."), Toasts.Type.FAILURE);
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
    tags: ["Appearance", "Customisation"],
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
                scheduleApply(channelId, 100);
            } else {
                cancelPendingApply();
                removeWallpaperElements();
            }
        }
    },

    start() {
        started = true;
        cacheWpSettings();
        const cid = SelectedChannelStore.getChannelId();
        if (cid) {
            scheduleApply(cid, 500);
        }
        document.addEventListener("visibilitychange", handleVisChange);
        window.addEventListener("focus", handleFocusChange);
        window.addEventListener("blur", handleFocusChange);
    },

    stop() {
        started = false;
        cancelPendingApply();
        clearInjectTimers();
        removeWallpaperElements();
        document.removeEventListener("visibilitychange", handleVisChange);
        window.removeEventListener("focus", handleFocusChange);
        window.removeEventListener("blur", handleFocusChange);
        activeVideo = null;
    }
});
