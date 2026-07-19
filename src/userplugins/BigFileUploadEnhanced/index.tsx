/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings, useSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import { Divider } from "@components/Divider";
import { FormSwitch } from "@components/FormSwitch";
import { OpenExternalIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import { copyWithToast, insertTextIntoChatInputBox, openImageModal, sendMessage } from "@utils/discord";
import { Margins } from "@utils/margins";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { chooseFile } from "@utils/web";
import { Alerts, Button, DraftType, Forms, Menu, PermissionsBits, PermissionStore, React, Select, showToast, TextArea, TextInput, Toasts, UploadManager, useMemo } from "@webpack/common";
import { Logger } from "@utils/Logger";

const logger = new Logger("BigFileUploadEnhanced");

// Added FileFast to Uploader type
// TODO: fix the fucking gofile upload and the fucking filefast. i hate them both and they are harder to fix than catbox.
type Uploader = "GoFile" | "Catbox" | "Litterbox" | "Custom" | "FileFast";
type CustomResponseType = "Text" | "JSON";

type PickedFile = {
    name: string;
    bytes: Uint8Array;
    mimeType: string;
};

type UploadPayload = {
    fileBuffer: ArrayBuffer;
    fileName: string;
    fileType: string;
    fileSizeBytes: number;
};

const Native: PluginNative<typeof import("./native")> | null = IS_DISCORD_DESKTOP
    ? (VencordNative.pluginHelpers.BigFileUpload as PluginNative<typeof import("./native")>)
    : null;

const VIDEO_EXTENSIONS = [
    ".mp4", ".mkv", ".webm", ".avi", ".mov", ".flv", ".wmv", ".m4v", ".mpg", ".mpeg", ".3gp", ".ogv"
] as const;

const MIME_TO_EXT: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/x-matroska": "mkv",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "application/pdf": "pdf",
    "application/zip": "zip",
    "application/json": "json",
    "text/plain": "txt",
};

const EXT_TO_MIME: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    webm: "video/webm",
    mkv: "video/x-matroska",
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    wav: "audio/wav",
    pdf: "application/pdf",
    zip: "application/zip",
    json: "application/json",
    txt: "text/plain",
};

const settings = definePluginSettings({
    uploader: {
        type: OptionType.SELECT,
        description: "Upload service",
        hidden: true,
        options: [
            { label: "Catbox (حد أقصى 200 ميغابايت)", value: "Catbox", default: true },
            { label: "Litterbox (Catbox مؤقت، 1 جيجابايت)", value: "Litterbox" },
            { label: "GoFile", value: "GoFile" },
            { label: "FileFast (سريع)", value: "FileFast" },
            { label: "مخصص (متوافق مع ShareX)", value: "Custom" },
        ]
    },
    autoSend: {
        type: OptionType.BOOLEAN,
        description: "Auto-send the link (or copy and insert it into the chat box)",
        hidden: true,
        default: false
    },
    confirmBeforeUpload: {
        type: OptionType.BOOLEAN,
        description: "Request confirmation before uploading",
        hidden: true,
        default: true
    },
    showDestinationPreview: {
        type: OptionType.BOOLEAN,
        description: "Show destination host and URL in the confirmation dialog",
        hidden: true,
        default: true
    },
    wrapVideoEmbeds: {
        type: OptionType.BOOLEAN,
        description: "Optional: wrap large video links with embeds.video for better playback (adds a third-party redirect)",
        hidden: true,
        default: false
    },
    renderImagePreviews: {
        type: OptionType.BOOLEAN,
        description: "Show inline image previews for Catbox/Litter/GoFile links even if Discord does not embed them",
        hidden: true,
        default: true
    },
    litterboxTime: {
        type: OptionType.SELECT,
        description: "Retention duration in Litterbox",
        hidden: true,
        options: [
            { label: "ساعة واحدة", value: "1h", default: true },
            { label: "12 ساعة", value: "12h" },
            { label: "24 ساعة", value: "24h" },
            { label: "72 ساعة", value: "72h" },
        ]
    },

    customName: {
        type: OptionType.STRING,
        description: "Custom uploader name (display only)",
        hidden: true,
        default: ""
    },
    customRequestUrl: {
        type: OptionType.STRING,
        description: "Custom uploader request URL (ShareX: RequestURL)",
        hidden: true,
        default: ""
    },
    customFileFormName: {
        type: OptionType.STRING,
        description: "Custom uploader file form name (ShareX: FileFormName)",
        hidden: true,
        default: "file"
    },
    customResponseType: {
        type: OptionType.SELECT,
        description: "Custom uploader response type (ShareX: ResponseType)",
        hidden: true,
        options: [
            { label: "نص", value: "Text", default: true },
            { label: "JSON", value: "JSON" },
        ]
    },
    customUrlPath: {
        type: OptionType.STRING,
        description: "Custom uploader URL path (ShareX: URL). For JSON use dot notation like data.url; ignored for Text.",
        hidden: true,
        default: ""
    },

    config: {
        type: OptionType.COMPONENT,
        description: "Uploader settings",
        component: SettingsComponent
    }
}).withPrivateSettings<{
    gofileToken?: string;
    catboxUserHash?: string;
    filefastToken?: string;
    customHeadersJson?: string;
    customArgsJson?: string;
}>();

const CATBOX_IMAGE_HOSTS = [
    "files.catbox.moe",
    "litter.catbox.moe",
    "gofile.io", // Added for preview
    "File.fast" // Added for preview
] as const;

const PREVIEW_IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp"] as const;

function isHttpUrl(input: string) {
    try {
        const url = new URL(input);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

function safeJsonParseObject(label: string, input: string | undefined): { ok: true; value: Record<string, string>; } | { ok: false; error: string; } {
    if (!input?.trim()) return { ok: true, value: {} };

    try {
        const parsed = JSON.parse(input);
        if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed))
            return { ok: false, error: `${label} must be a JSON object` };

        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) {
            if (["__proto__", "constructor", "prototype"].includes(k))
                return { ok: false, error: `${label} contains an unsafe key (${k})` };
            if (v == null) continue;
            out[String(k)] = String(v);
        }
        return { ok: true, value: out };
    } catch (err) {
        return { ok: false, error: `Failed to parse ${label}: ${String(err)}` };
    }
}

function getUploaderDisplayName(uploader: Uploader) {
    if (uploader === "Custom") return settings.store.customName?.trim() ? `Custom (${settings.store.customName.trim()})` : "Custom";
    return uploader;
}

function getDestination(uploader: Uploader): { host: string; url: string; note?: string; } {
    switch (uploader) {
        case "Catbox":
            return { host: "catbox.moe", url: "https://catbox.moe/user/api.php" };
        case "Litterbox":
            return { host: "litterbox.catbox.moe", url: "https://litterbox.catbox.moe/resources/internals/api.php" };
        case "GoFile":
            return { host: "gofile.io", url: "https://upload.gofile.io/uploadFile", note: "Server is selected automatically by GoFile." };
        case "FileFast":
            return { host: "file.fast", url: "https://file.fast/api/v1/upload", note: "Fast uploads." };
        case "Custom": {
            const url = settings.store.customRequestUrl?.trim() ?? "";
            let host = "";
            try { host = url ? new URL(url).host : ""; } catch (err) { logger.debug("Ignored error", err); }
            return { host: host || "(invalid URL)", url: url || "(not set)" };
        }
    }
}

function fileBaseName(input: unknown): string | null {
    if (typeof input !== "string") return null;
    const trimmed = input.trim();
    if (!trimmed) return null;

    const parts = trimmed.split(/[\\/]/);
    return parts[parts.length - 1] || null;
}

function inferExtFromBytes(bytes: Uint8Array): string | null {
    if (bytes.length < 12) return null;

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
        && bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A
    ) return "png";

    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "jpg";

    // GIF: GIF8
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "gif";

    // PDF: %PDF
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf";

    // ZIP: PK\x03\x04
    if (bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) return "zip";

    // RIFF....WEBP
    if (
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
        && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) return "webp";

    // OGG: OggS
    if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return "ogg";

    // MP4: ....ftyp
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return "mp4";

    // WebM/Matroska: 1A 45 DF A3
    if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) return "webm";

    // MP3: ID3
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return "mp3";

    return null;
}

function normalizePickedFileName(baseName: string | null, mimeType: string, bytes: Uint8Array) {
    const name = (baseName?.trim() || "upload").replaceAll("\u0000", "");
    const lastDot = name.lastIndexOf(".");
    const ext = lastDot > 0 ? name.slice(lastDot + 1).toLowerCase() : "";

    const inferredExt =
        MIME_TO_EXT[mimeType.toLowerCase()]
        ?? inferExtFromBytes(bytes);

    if (ext && ext !== "bin") return name;
    if (!inferredExt) return name;

    if (ext === "bin") return name.slice(0, Math.max(0, lastDot)) + "." + inferredExt;
    return name + "." + inferredExt;
}

function normalizePickedMimeType(mimeType: string, fileName: string) {
    const lower = (mimeType || "").toLowerCase();
    if (lower && lower !== "application/octet-stream") return lower;

    const dot = fileName.lastIndexOf(".");
    const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : "";
    return EXT_TO_MIME[ext] ?? "application/octet-stream";
}

async function pickFile(): Promise<PickedFile | null> {
    if (IS_DISCORD_DESKTOP) {
        const [file] = await DiscordNative.fileManager.openFiles({
            filters: [{ name: "all", extensions: ["*"] }]
        });
        if (!file) return null;

        const anyFile = file as any;
        const baseName =
            fileBaseName(anyFile.path)
            ?? fileBaseName(anyFile.filePath)
            ?? fileBaseName(anyFile.fullPath)
            ?? fileBaseName(anyFile.name)
            ?? fileBaseName(anyFile.fileName)
            ?? fileBaseName(anyFile.filename);

        const rawMime = String(anyFile.mimeType ?? anyFile.type ?? "application/octet-stream");
        const name = normalizePickedFileName(baseName, rawMime, file.data);
        const mimeType = normalizePickedMimeType(rawMime, name);

        return {
            name,
            bytes: file.data,
            mimeType,
        };
    }

    const file = await chooseFile("*/*");
    if (!file) return null;

    const name = normalizePickedFileName(file.name, file.type || "application/octet-stream", new Uint8Array(await file.slice(0, 64).arrayBuffer()));
    const mimeType = normalizePickedMimeType(file.type || "application/octet-stream", name);
    return {
        name,
        bytes: new Uint8Array(await file.arrayBuffer()),
        mimeType
    };
}

function buildUploadPayload(file: PickedFile): UploadPayload {
    const { bytes } = file;
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const ab = copy.buffer;
    return {
        fileBuffer: ab,
        fileName: file.name,
        fileType: file.mimeType || "application/octet-stream",
        fileSizeBytes: bytes.byteLength,
    };
}

function maybeWrapVideo(url: string, fileName: string, fileSizeBytes: number): string {
    if (!settings.store.wrapVideoEmbeds) return url;

    const lower = fileName.toLowerCase();
    const isVideo = VIDEO_EXTENSIONS.some(ext => lower.endsWith(ext));
    const isLarge = fileSizeBytes >= 150 * 1024 * 1024;

    return isVideo && isLarge ? `https://embeds.video/${url}` : url;
}

function humanError(err: unknown): string {
    if (err instanceof Error) return err.message || String(err);
    return String(err);
}

function isRetryableNetworkError(err: unknown): boolean {
    const msg = humanError(err);
    return (
        msg.includes("ECONNRESET")
        || msg.includes("ETIMEDOUT")
        || msg.includes("ERR_CONNECTION_TIMED_OUT")
        || msg.includes("ERR_NETWORK_CHANGED")
        || msg.includes("socket hang up")
        || msg.includes("network timeout")
    );
}

function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function createProgressToast() {
    const id = Toasts.genId();
    return {
        show(message: string, type = Toasts.Type.MESSAGE, duration = 3500) {
            Toasts.show({
                id,
                message,
                type,
                options: {
                    duration,
                    position: Toasts.Position.BOTTOM
                }
            });
        }
    };
}

async function confirmUploadIfNeeded(uploader: Uploader, payload: UploadPayload): Promise<boolean> {
    if (!settings.store.confirmBeforeUpload) {
        if (settings.store.showDestinationPreview) {
            const dest = getDestination(uploader);
            showToast(`${t("جارٍ الرفع إلى", "Uploading to")} ${dest.host} (${dest.url})…`, Toasts.Type.MESSAGE);
        }
        return true;
    }

    const dest = getDestination(uploader);
    const body = (
        <div>
            <Forms.FormText className={Margins.bottom8}>
                {t("أنت على وشك رفع", "You are about to upload")} <b>{payload.fileName}</b> ({(payload.fileSizeBytes / (1024 * 1024)).toFixed(2)} MiB) {t("إلى", "to")} <b>{getUploaderDisplayName(uploader)}</b>.
            </Forms.FormText>
            {settings.store.showDestinationPreview && (
                <div className={Margins.top8}>
                    <Forms.FormText><b>{t("مضيف الوجهة:", "Destination Host:")}</b> {dest.host}</Forms.FormText>
                    <Forms.FormText><b>{t("رابط الوجهة:", "Destination URL:")}</b> {dest.url}</Forms.FormText>
                    {dest.note && <Forms.FormText>{dest.note}</Forms.FormText>}
                    {uploader === "Custom" && (
                        <Forms.FormText className={Margins.top8}>
                            {t("للرافعات المخصصة، تأكد من الوثوق بالـ endpoint والترويسات المُعدَّة.", "For custom uploaders, make sure you trust the endpoint and configured headers.")}
                        </Forms.FormText>
                    )}
                </div>
            )}
        </div>
    );

    return await new Promise<boolean>(resolve => {
        Alerts.show({
            title: t("تأكيد الرفع", "Confirm Upload"),
            body,
            confirmText: t("رفع", "Upload"),
            cancelText: t("إلغاء", "Cancel"),
            onConfirm: () => resolve(true),
            onCancel: () => resolve(false)
        });
    });
}

function validateCustomSettings(): { ok: true; args: Record<string, string>; headers: Record<string, string>; urlPath: string[]; } | { ok: false; error: string; } {
    const requestUrl = settings.store.customRequestUrl?.trim() ?? "";
    if (!requestUrl) return { ok: false, error: t("الرافع المخصص: رابط الطلب مطلوب.", "Custom uploader: Request URL is required.") };
    if (!isHttpUrl(requestUrl)) return { ok: false, error: t("الرافع المخصص: رابط الطلب يجب أن يكون رابط http(s) صحيحاً.", "Custom uploader: Request URL must be a valid http(s) URL.") };

    const fileFormName = settings.store.customFileFormName?.trim() ?? "";
    if (!fileFormName) return { ok: false, error: t("الرافع المخصص: اسم نموذج الملف مطلوب.", "Custom uploader: File form name is required.") };

    const responseType = settings.store.customResponseType as CustomResponseType;
    if (responseType !== "Text" && responseType !== "JSON")
        return { ok: false, error: t("الرافع المخصص: نوع الاستجابة يجب أن يكون نصاً أو JSON.", "Custom uploader: Response type must be Text or JSON.") };

    const urlPathRaw = settings.store.customUrlPath?.trim() ?? "";
    const urlPath = responseType === "JSON"
        ? urlPathRaw.split(".").map(s => s.trim()).filter(Boolean)
        : [];
    if (responseType === "JSON" && urlPath.length === 0)
        return { ok: false, error: t("الرافع المخصص: مسار الرابط مطلوب لاستجابات JSON (مثال: data.url).", "Custom uploader: URL path is required for JSON responses (e.g. data.url).") };

    const argsParsed = safeJsonParseObject("custom arguments", settings.store.customArgsJson);
    if (!argsParsed.ok) return { ok: false, error: argsParsed.error };

    const headersParsed = safeJsonParseObject("custom headers", settings.store.customHeadersJson);
    if (!headersParsed.ok) return { ok: false, error: headersParsed.error };

    return { ok: true, args: argsParsed.value, headers: headersParsed.value, urlPath };
}

// Web fallback: plain fetch() for non-Desktop environments (CORS-compatible services)
async function uploadToServiceWeb(uploader: Uploader, payload: UploadPayload): Promise<string> {
    const blob = new Blob([payload.fileBuffer], { type: payload.fileType || "application/octet-stream" });
    const file = new File([blob], payload.fileName);

    switch (uploader) {
        case "Catbox": {
            const form = new FormData();
            form.append("reqtype", "fileupload");
            form.append("fileToUpload", file);
            if (settings.store.catboxUserHash?.trim()) form.append("userhash", settings.store.catboxUserHash.trim());
            const res = await fetch("https://catbox.moe/user/api.php", { method: "POST", body: form });
            const text = (await res.text()).trim();
            if (!res.ok) throw new Error(`Catbox: HTTP ${res.status}`);
            if (!isHttpUrl(text)) throw new Error("Catbox: unexpected response (not a URL)");
            return text;
        }
        case "Litterbox": {
            const form = new FormData();
            form.append("reqtype", "fileupload");
            form.append("fileToUpload", file);
            form.append("time", settings.store.litterboxTime);
            const res = await fetch("https://litterbox.catbox.moe/resources/internals/api.php", { method: "POST", body: form });
            const text = (await res.text()).trim();
            if (!res.ok) throw new Error(`Litterbox: HTTP ${res.status}`);
            if (!isHttpUrl(text)) throw new Error("Litterbox: unexpected response (not a URL)");
            return text;
        }
        case "GoFile": {
            let server = "store1";
            try {
                const sRes = await fetch("https://api.gofile.io/servers");
                const sJson = (await sRes.json()) as any;
                const names = sJson?.data?.servers?.map((s: any) => s?.name).filter(Boolean) as string[] | undefined;
                if (names?.length) server = names[Math.floor(Math.random() * names.length)];
            } catch { /* keep fallback */ }
            const form = new FormData();
            form.append("file", file);
            if (settings.store.gofileToken?.trim()) form.append("token", settings.store.gofileToken.trim());
            const res = await fetch(`https://${server}.gofile.io/uploadFile`, { method: "POST", body: form });
            const json = (await res.json().catch(() => null)) as any;
            if (!res.ok) throw new Error(`GoFile: HTTP ${res.status}`);
            if (json?.status === "ok" && typeof json?.data?.downloadPage === "string") return json.data.downloadPage;
            throw new Error("GoFile: unexpected response shape");
        }
        case "FileFast": {
            const form = new FormData();
            form.append("files[]", file);
            if (settings.store.filefastToken?.trim()) form.append("token", settings.store.filefastToken.trim());
            const res = await fetch("https://file.fast/api/v1/upload", { method: "POST", body: form });
            const json = (await res.json().catch(() => null)) as any;
            if (!res.ok || json?.success !== true) throw new Error(`FileFast: HTTP ${res.status} or upload failed`);
            const url = json?.files?.[0]?.url;
            if (typeof url !== "string" || !isHttpUrl(url)) throw new Error("FileFast: unexpected response (no valid URL)");
            return url;
        }
        case "Custom": {
            const validated = validateCustomSettings();
            if (!validated.ok) throw new Error(validated.error);
            const form = new FormData();
            form.append(settings.store.customFileFormName.trim(), file);
            for (const [k, v] of Object.entries(validated.args)) form.append(k, v);
            const headers: Record<string, string> = {};
            for (const [k, v] of Object.entries(validated.headers)) {
                if (k.toLowerCase() !== "content-type") headers[k] = v;
            }
            const res = await fetch(settings.store.customRequestUrl.trim(), { method: "POST", body: form, headers });
            if (!res.ok) throw new Error(`Custom: HTTP ${res.status} (${res.statusText})`);
            if (settings.store.customResponseType === "JSON") {
                const json = (await res.json().catch(() => null)) as any;
                let cur: any = json;
                for (const key of validated.urlPath) cur = cur?.[key];
                if (typeof cur !== "string" || !isHttpUrl(cur)) throw new Error("Custom: JSON response did not contain a valid URL at the configured path");
                return cur;
            }
            const text = (await res.text()).trim();
            if (!isHttpUrl(text)) throw new Error("Custom: text response was not a valid URL");
            return text;
        }
    }
}

async function uploadToService(uploader: Uploader, payload: UploadPayload): Promise<string> {
    if (!Native) return await uploadToServiceWeb(uploader, payload);

    switch (uploader) {
        case "GoFile": {
            return await Native.uploadFileToGofileNative(payload.fileBuffer, payload.fileName, payload.fileType, settings.store.gofileToken?.trim() || undefined);
        }
        case "Catbox": {
            return await Native.uploadFileToCatboxNative(payload.fileBuffer, payload.fileName, payload.fileType, settings.store.catboxUserHash?.trim() || undefined);
        }
        case "Litterbox": {
            return await Native.uploadFileToLitterboxNative(payload.fileBuffer, payload.fileName, payload.fileType, settings.store.litterboxTime);
        }
        case "FileFast": {
            return await Native.uploadFileToFilefastNative(payload.fileBuffer, payload.fileName, payload.fileType, settings.store.filefastToken?.trim() || undefined);
        }
        case "Custom": {
            const validated = validateCustomSettings();
            if (!validated.ok) throw new Error(validated.error);
            return await Native.uploadFileCustomNative(
                settings.store.customRequestUrl.trim(),
                payload.fileBuffer,
                payload.fileName,
                payload.fileType,
                settings.store.customFileFormName.trim(),
                validated.args,
                validated.headers,
                settings.store.customResponseType,
                validated.urlPath
            );
        }
    }
}

async function sendOrInsert(channelId: string, url: string) {
    if (settings.store.autoSend) {
        // Sending the URL without extra surrounding text makes Discord more likely to generate embeds.
        await sendMessage(channelId, { content: url });
        showToast(t("تم إرسال رابط الرفع!", "Upload link sent!"), Toasts.Type.SUCCESS);
    } else {
        insertTextIntoChatInputBox(`${url} `);
        await copyWithToast(url, t("تم نسخ رابط الرفع!", "Upload link copied!"));
    }
}

function tryGetPreviewableCatboxUrl(messageContent: string): string | null {
    const match = messageContent.match(/https?:\/\/[^\s<>]+/g);
    if (!match?.length) return null;

    for (const raw of match) {
        let url: URL;
        try {
            url = new URL(raw);
        } catch {
            continue;
        }

        if (!CATBOX_IMAGE_HOSTS.includes(url.hostname as any)) continue;

        const path = url.pathname;
        const dot = path.lastIndexOf(".");
        if (dot <= 0) continue;
        const ext = path.slice(dot + 1).toLowerCase();
        if (!PREVIEW_IMAGE_EXTS.includes(ext as any)) continue;

        return url.toString();
    }

    return null;
}

let uploadInFlight = false;

async function runUploadFlow(channelId: string) {
    if (uploadInFlight) return;
    uploadInFlight = true;

    try {
        const uploader = settings.store.uploader as Uploader;
        const picked = await pickFile();
        if (!picked) return;

        const payload = buildUploadPayload(picked);
        const ok = await confirmUploadIfNeeded(uploader, payload);
        if (!ok) return;

        const toast = createProgressToast();
        toast.show(`${t("جارٍ الرفع عبر", "Uploading via")} ${getUploaderDisplayName(uploader)}…`);

        const maxAttempts = 3;
        let url: string | null = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                if (attempt > 1) toast.show(`${t("إعادة محاولة الرفع", "Retrying upload")} (${attempt}/${maxAttempts})…`);
                url = await uploadToService(uploader, payload);
                break;
            } catch (err) {
                if (attempt >= maxAttempts || !isRetryableNetworkError(err)) throw err;
                toast.show(`${t("خطأ في الشبكة؛ إعادة المحاولة", "Network error; retrying")} (${attempt + 1}/${maxAttempts})…`, Toasts.Type.MESSAGE, 4000);
                await sleep(900 * attempt);
            }
        }

        if (typeof url !== "string" || !(url.startsWith("http://") || url.startsWith("https://")))
            throw new Error(t("اكتمل الرفع لكن الرابط المُعاد غير صالح.", "Upload completed but returned URL is invalid."));

        const finalUrl = maybeWrapVideo(url, payload.fileName, payload.fileSizeBytes);
        await sendOrInsert(channelId, finalUrl);
        toast.show(t("اكتمل الرفع.", "Upload complete."), Toasts.Type.SUCCESS);
    } catch (err) {
        showToast(`${t("فشل الرفع:", "Upload failed:")} ${humanError(err)}`, Toasts.Type.FAILURE);
    } finally {
        UploadManager.clearAll(channelId, DraftType.ChannelMessage);
        uploadInFlight = false;
    }
}

const ctxMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    if (children.find(c => c?.props?.id === "vc-big-file-upload")) return;
    if (props.channel.guild_id && !PermissionStore.can(PermissionsBits.SEND_MESSAGES, props.channel)) return;

    children.splice(1, 0,
        <Menu.MenuItem
            id="vc-big-file-upload"
            label={
                <div>
                    <OpenExternalIcon height={24} width={24} />
                    <div>{t("رفع ملف كبير (Enhanced)", "Upload Large File (Enhanced)")}</div>
                </div>
            }
            action={() => runUploadFlow(props.channel.id)}
        />
    );
};

function SettingsComponent() {
    useSettings(["plugins.Settings.arabicMode"]);
    const uploader = settings.store.uploader as Uploader;
    const dest = useMemo(() => getDestination(uploader), [uploader, settings.store.customRequestUrl]);

    const importShareXConfig = async () => {
        const sxcuText = IS_DISCORD_DESKTOP
            ? (await (async () => {
                const [f] = await DiscordNative.fileManager.openFiles({ filters: [{ name: "ShareX Uploader", extensions: ["sxcu"] }] });
                return f ? new TextDecoder().decode(f.data) : null;
            })())
            : (await (async () => {
                const f = await chooseFile(".sxcu");
                return f ? await f.text() : null;
            })());

        if (!sxcuText) return;

        let parsed: any;
        try {
            parsed = JSON.parse(sxcuText);
        } catch (err) {
            showToast(`${t("فشل تحليل JSON. في ملف sxcu:", "Failed to parse JSON in sxcu file:")} ${humanError(err)}`, Toasts.Type.FAILURE);
            return;
        }

        settings.store.uploader = "Custom";
        settings.store.customName = String(parsed?.Name ?? "");
        settings.store.customRequestUrl = String(parsed?.RequestURL ?? "");
        settings.store.customFileFormName = String(parsed?.FileFormName ?? "file");
        settings.store.customResponseType = (parsed?.ResponseType === "JSON" ? "JSON" : "Text") as any;
        settings.store.customUrlPath = String(parsed?.URL ?? "");
        settings.store.customHeadersJson = JSON.stringify(parsed?.Headers ?? {}, null, 2);
        settings.store.customArgsJson = JSON.stringify(parsed?.Arguments ?? {}, null, 2);

        showToast(t("تم استيراد إعدادات رافع ShareX.", "ShareX uploader settings imported."), Toasts.Type.SUCCESS);
    };

    return (
        <div>
            <Forms.FormTitle>{t("الأمان", "Security")}</Forms.FormTitle>
            <Forms.FormText className={Margins.bottom8}>
                {t("يرفع الملفات إلى خادم خارجي ثم يشارك الرابط الناتج في الدردشة.", "Uploads files to an external server then shares the resulting link in the chat.")}
            </Forms.FormText>

            <Forms.FormText className={Margins.bottom8}>
                {t("الوجهة الحالية:", "Current destination:")} <b>{dest.host}</b> ({dest.url})
            </Forms.FormText>

            <Divider className={Margins.bottom16} />

            <Forms.FormTitle>{t("عام", "General")}</Forms.FormTitle>
            <div className={Margins.bottom16}>
                <Select
                    options={[
                        { label: "Catbox", value: "Catbox" },
                        { label: "Litterbox (Catbox)", value: "Litterbox" },
                        { label: "GoFile", value: "GoFile" },
                        { label: "FileFast", value: "FileFast" },
                        { label: t("مخصص (متوافق مع ShareX)", "Custom (ShareX compatible)"), value: "Custom" },
                    ]}
                    serialize={v => v}
                    select={(v: Uploader) => settings.store.uploader = v}
                    isSelected={(v: Uploader) => v === uploader}
                />
            </div>

            <FormSwitch
                title={t("تأكيد قبل الرفع", "Confirm before upload")}
                description={t("طلب تأكيد قبل البدء بالرفع", "Request confirmation before starting the upload")}
                value={settings.store.confirmBeforeUpload}
                onChange={v => settings.store.confirmBeforeUpload = v}
            />

            <FormSwitch
                title={t("عرض معاينة الوجهة", "Show destination preview")}
                description={t("عرض مضيف الوجهة والرابط في حوار التأكيد", "Show destination host and URL in the confirmation dialog")}
                value={settings.store.showDestinationPreview}
                onChange={v => settings.store.showDestinationPreview = v}
            />

            <FormSwitch
                title={t("إرسال الرابط تلقائياً", "Auto-send link")}
                description={t("إذا أُوقف، يُنسخ الرابط ويُدرج في صندوق الدردشة", "If disabled, the link is copied and inserted into the chat box")}
                value={settings.store.autoSend}
                onChange={v => settings.store.autoSend = v}
            />

            <FormSwitch
                title={t("تغليف بـ embeds.video (اختياري)", "Wrap with embeds.video (optional)")}
                description={t("يغلّف روابط الفيديو الكبيرة بـ embeds.video (يضيف إعادة توجيه من طرف ثالث)", "Wraps large video links with embeds.video (adds a third-party redirect)")}
                value={settings.store.wrapVideoEmbeds}
                onChange={v => settings.store.wrapVideoEmbeds = v}
            />

            {uploader === "GoFile" && (
                <>
                    <Divider className={Margins.bottom16} />
                    <Forms.FormTitle>GoFile</Forms.FormTitle>
                    <TextInput
                        label={t("الرمز المميز (اختياري، يُحفظ بشكل خاص)", "Token (optional, stored privately)")}
                        type="password"
                        value={settings.store.gofileToken ?? ""}
                        placeholder={t("رمز GoFile", "GoFile token")}
                        onChange={v => settings.store.gofileToken = v}
                    />
                </>
            )}

            {uploader === "Catbox" && (
                <>
                    <Divider className={Margins.bottom16} />
                    <Forms.FormTitle>Catbox</Forms.FormTitle>
                    <TextInput
                        label={t("هاش المستخدم (اختياري، يُحفظ بشكل خاص)", "User hash (optional, stored privately)")}
                        type="password"
                        value={settings.store.catboxUserHash ?? ""}
                        placeholder={t("هاش مستخدم Catbox", "Catbox user hash")}
                        onChange={v => settings.store.catboxUserHash = v}
                    />
                </>
            )}

            {uploader === "FileFast" && (
                <>
                    <Divider className={Margins.bottom16} />
                    <Forms.FormTitle>FileFast</Forms.FormTitle>
                    <Forms.FormText className={Margins.bottom8}>
                        {t("رفع ملفات سريع. الملفات لا تنتهي صلاحيتها.", "Fast file uploads. Files do not expire.")}
                    </Forms.FormText>
                    <TextInput
                        label={t("الرمز المميز (اختياري، يُحفظ بشكل خاص)", "Token (optional, stored privately)")}
                        type="password"
                        value={settings.store.filefastToken ?? ""}
                        placeholder={t("رمز FileFast", "FileFast token")}
                        onChange={v => settings.store.filefastToken = v}
                    />
                </>
            )}

            {uploader === "Litterbox" && (
                <>
                    <Divider className={Margins.bottom16} />
                    <Forms.FormTitle>Litterbox</Forms.FormTitle>
                    <div className={Margins.bottom16}>
                        <Select
                            options={[
                                { label: t("ساعة واحدة", "1 hour"), value: "1h" },
                                { label: t("12 ساعة", "12 hours"), value: "12h" },
                                { label: t("24 ساعة", "24 hours"), value: "24h" },
                                { label: t("72 ساعة", "72 hours"), value: "72h" },
                            ]}
                            serialize={v => v}
                            select={(v: string) => settings.store.litterboxTime = v}
                            isSelected={(v: string) => v === settings.store.litterboxTime}
                        />
                    </div>
                </>
            )}

            {uploader === "Custom" && (
                <>
                    <Divider className={Margins.bottom16} />
                    <Forms.FormTitle>{t("مخصص (ShareX)", "Custom (ShareX)")}</Forms.FormTitle>
                    <div className={Margins.bottom16}>
                        <Button onClick={importShareXConfig}>{t("استيراد إعدادات ShareX", "Import ShareX config")}</Button>
                    </div>

                    <TextInput
                        label={t("الاسم (للعرض فقط)", "Name (display only)")}
                        value={settings.store.customName}
                        onChange={v => settings.store.customName = v}
                        placeholder={t("رافعي المخصص", "My custom uploader")}
                    />

                    <TextInput
                        label={t("رابط الطلب", "Request URL")}
                        value={settings.store.customRequestUrl}
                        onChange={v => settings.store.customRequestUrl = v}
                        placeholder="https://example.com/upload"
                    />

                    <TextInput
                        label={t("اسم نموذج الملف", "File form name")}
                        value={settings.store.customFileFormName}
                        onChange={v => settings.store.customFileFormName = v}
                        placeholder="file"
                    />

                    <div className={Margins.bottom16}>
                        <Select
                            options={[
                                { label: t("نص", "Text"), value: "Text" },
                                { label: "JSON", value: "JSON" },
                            ]}
                            serialize={v => v}
                            select={(v: CustomResponseType) => settings.store.customResponseType = v}
                            isSelected={(v: CustomResponseType) => v === (settings.store.customResponseType as any)}
                        />
                    </div>

                    <TextInput
                        label={t("مسار الرابط (نقطة JSON، أو يُتجاهل للنص)", "URL path (JSON dot-path, or ignored for Text)")}
                        value={settings.store.customUrlPath}
                        onChange={v => settings.store.customUrlPath = v}
                        placeholder="data.url"
                    />

                    <div className={Margins.bottom16}>
                        <Forms.FormText>{t("معطيات JSON (تُحفظ بشكل خاص)", "JSON Arguments (stored privately)")}</Forms.FormText>
                        <TextArea
                            value={settings.store.customArgsJson ?? ""}
                            onChange={v => settings.store.customArgsJson = v}
                            placeholder='{"key":"value"}'
                            rows={3}
                        />
                    </div>

                    <div className={Margins.bottom16}>
                        <Forms.FormText>{t("ترويسات JSON (تُحفظ بشكل خاص)", "JSON Headers (stored privately)")}</Forms.FormText>
                        <TextArea
                            value={settings.store.customHeadersJson ?? ""}
                            onChange={v => settings.store.customHeadersJson = v}
                            placeholder='{"Authorization":"Bearer ..."}'
                            rows={3}
                        />
                    </div>

                    <Button
                        onClick={() => {
                            const result = validateCustomSettings();
                            if (result.ok) showToast(t("إعدادات الرافع المخصص تبدو صحيحة.", "Custom uploader settings look correct."), Toasts.Type.SUCCESS);
                            else showToast(result.error, Toasts.Type.FAILURE);
                        }}
                    >
                        {t("التحقق من الإعدادات المخصصة", "Validate custom settings")}
                    </Button>
                </>
            )}
        </div>
    );
}

export default definePlugin({
    name: "BigFileUploadEnhanced",
    description: "Bypass Discord's upload limit by uploading files to an external server and sharing the link in chat — this version is faster and does not use DOM manipulation. ⚠️ Your files are uploaded to third-party hosts (Catbox / GoFile / Litterbox) — use at your own responsibility.",
    tags: ["Utility", "Chat"],
    authors: [EquicordDevs.benjii, { name: "x2b", id: 0n }],
    settings,

    contextMenus: {
        "channel-attach": ctxMenuPatch,
    },

    renderMessageAccessory(props: Record<string, any>) {
        if (!settings.store.renderImagePreviews) return;

        const message = props?.message;
        const content = message?.content;
        if (typeof content !== "string" || !content) return;

        // If Discord already embedded something, don't duplicate.
        if (Array.isArray(message?.embeds) && message.embeds.length) return;
        if (Array.isArray(message?.attachments) && message.attachments.length) return;

        const url = tryGetPreviewableCatboxUrl(content);
        if (!url) return;

        return (
            <div className={Margins.top8} style={{ maxWidth: 550 }}>
                <img
                    src={url}
                    style={{
                        maxWidth: "100%",
                        borderRadius: 8,
                        cursor: "pointer",
                        display: "block",
                    }}
                    onClick={() => openImageModal({ url, width: 1200 })}
                />
            </div>
        );
    }
});
