/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { t } from "@utils/esharqI18n";
import definePlugin, { IconProps } from "@utils/types";
import { CloudUploadPlatform } from "@vencord/discord-types/enums";
import {
    CloudUploader,
    Constants,
    FluxDispatcher,
    MessageActions,
    PendingReplyStore,
    React,
    RestAPI,
    SelectedChannelStore,
    showToast,
    SnowflakeUtils,
    Toasts,
} from "@webpack/common";

import { encodeGIF } from "./gifEncoder";

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = "idle" | "converting" | "preview" | "sending" | "error";

interface PopoverPosition {
    bottom: number; // px from bottom of viewport
    left: number;   // px from left of viewport (centre of button)
}

// ─── Utilities ────────────────────────────────────────────────────────────────

async function sendGIF(gifBlob: Blob, filename: string) {
    const channelId = SelectedChannelStore.getChannelId();
    if (!channelId) throw new Error("No channel selected");

    const reply = PendingReplyStore.getPendingReply(channelId);
    if (reply) FluxDispatcher.dispatch({ type: "DELETE_PENDING_REPLY", channelId });

    const file = new File([gifBlob], filename, { type: "image/gif" });

    const uploader = new CloudUploader(
        { file, isThumbnail: false, platform: CloudUploadPlatform.WEB },
        channelId
    );

    return new Promise<void>((resolve, reject) => {
        uploader.on("complete", () => {
            RestAPI.post({
                url: Constants.Endpoints.MESSAGES(channelId),
                body: {
                    flags: 0,
                    channel_id: channelId,
                    content: "",
                    nonce: SnowflakeUtils.fromTimestamp(Date.now()),
                    sticker_ids: [],
                    type: 0,
                    attachments: [{
                        id: "0",
                        filename: uploader.filename,
                        uploaded_filename: uploader.uploadedFilename,
                    }],
                    message_reference: reply
                        ? MessageActions.getSendMessageOptionsForReply(reply)?.messageReference
                        : null,
                },
            }).then(() => resolve()).catch(reject);
        });
        uploader.on("error", reject);
        uploader.upload();
    });
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function GifIcon({ active }: IconProps & { active?: boolean; }) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="4" width="18" height="16" rx="2.5"
                stroke="currentColor" strokeWidth="1.8" fill="none"
                opacity={active ? 1 : 0.8} />
            <path d="M3 15l4-4.5 3.5 4L14 9l7 9.5" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" opacity={active ? 0.6 : 0.3} />
            {/* GIF badge */}
            <rect x="12.5" y="12" width="9.5" height="6" rx="2"
                fill={active ? "#5865f2" : "currentColor"}
                opacity={active ? 1 : 0.55} />
            {/* G */}
            <path d="M13.8 13.8h1.3v.6h-.75v.9h.75v-.25h-.38v-.55h.88v1.3h-1.8v-2.0z" fill="#fff" />
            {/* I */}
            <path d="M15.55 13.8h.55v2.05h-.55z" fill="#fff" />
            {/* F */}
            <path d="M16.55 13.8h1.35v.55h-.8v.4h.72v.5h-.72v.6h-.55z" fill="#fff" />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" />
        </svg>
    );
}

function UploadImageIcon() {
    return (
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 15l4-4.5 3.5 4L14 9l7 9.5" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
            <circle cx="18" cy="6" r="5" fill="var(--background-primary, #313338)" />
            <path d="M18 3.5v5M15.5 6h5" stroke="#5865f2" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

// ─── Popover component ────────────────────────────────────────────────────────

interface PopoverProps {
    position: PopoverPosition;
    onClose(): void;
}

function GifConvertorPopover({ position, onClose }: PopoverProps) {
    const [stage, setStage] = React.useState<Stage>("idle");
    const [progress, setProgress] = React.useState<number>(0);
    const [gifBlob, setGifBlob] = React.useState<Blob | null>(null);
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    const [errorMsg, setErrorMsg] = React.useState<string>("");
    const [isDragOver, setDragOver] = React.useState(false);
    const [filename, setFilename] = React.useState("converted.gif");
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Cleanup preview URL
    React.useEffect(() => {
        return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    }, [previewUrl]);

    // Paste support
    React.useEffect(() => {
        const onPaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.kind === "file" && (item.type.startsWith("image/") || item.type.startsWith("video/"))) {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = item.getAsFile();
                    if (file) processFile(file);
                    break;
                }
            }
        };
        document.addEventListener("paste", onPaste, { capture: true });
        return () => document.removeEventListener("paste", onPaste, { capture: true });
    }, []);

    async function processFile(file: File) {
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
            setErrorMsg(t("يُدعَم الصور والفيديو فقط.", "Only image and video files are supported."));
            setStage("error");
            return;
        }
        const baseName = file.name.replace(/\.[^.]+$/, "") || "media";
        setFilename(`${baseName}.gif`);
        setStage("converting");
        setProgress(0);
        setGifBlob(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);

        try {
            const gif = await encodeGIF(file, setProgress);
            const blob = new Blob([gif as BlobPart], { type: "image/gif" });
            const url = URL.createObjectURL(blob);
            setGifBlob(blob);
            setPreviewUrl(url);
            setStage("preview");
        } catch (e: any) {
            console.error("[GifConvertor] Conversion error:", e);
            setErrorMsg(e?.message ?? t("فشل التحويل.", "Conversion failed."));
            setStage("error");
        }
    }

    async function handleSend() {
        if (!gifBlob) return;
        setStage("sending");
        try {
            await sendGIF(gifBlob, filename);
            showToast(t("تم إرسال GIF!", "GIF sent!"), Toasts.Type.SUCCESS);
            onClose();
        } catch (e: any) {
            console.error("[GifConvertor] Upload error:", e);
            setErrorMsg(e?.message ?? t("فشل الرفع.", "Upload failed."));
            setStage("error");
        }
    }

    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
    const onDragLeave = () => setDragOver(false);
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault(); setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    };
    const onClickZone = () => fileInputRef.current?.click();
    const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
        e.target.value = "";
    };

    const popoverStyle: React.CSSProperties = {
        bottom: position.bottom,
        left: position.left,
        transform: "translateX(-50%)",
    };

    return (
        <div
            className="nc-gifconv-popover"
            style={popoverStyle}
            onClick={e => e.stopPropagation()}
        >
            {/* Header */}
            <div className="nc-gifconv-header">
                <span className="nc-gifconv-title">✦ GIF Convertor</span>
                <button className="nc-gifconv-close" onClick={onClose} aria-label="Close">
                    <CloseIcon />
                </button>
            </div>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                style={{ display: "none" }}
                onChange={onFileInput}
            />

            {/* Idle / Error */}
            {(stage === "idle" || stage === "error") && (
                <>
                    <div
                        className={`nc-gifconv-dropzone${isDragOver ? " nc-gifconv-drag-over" : ""}`}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onClick={onClickZone}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === "Enter" && onClickZone()}
                        aria-label={t("أفلِت وسائط لتحويلها إلى GIF", "Drop media to convert to GIF")}
                    >
                        <span className="nc-gifconv-dropzone-icon">
                            <UploadImageIcon />
                        </span>
                        <span className="nc-gifconv-dropzone-label">
                            {isDragOver ? t("أفلِت للتحويل!", "Release to convert!") : t("أفلِت الوسائط هنا", "Drop media here")}
                        </span>
                        <span className="nc-gifconv-dropzone-sub">
                            or click to browse · Ctrl+V to paste<br />
                            Images &amp; Videos (MP4, WebM…)
                        </span>
                    </div>
                    {stage === "error" && (
                        <div className="nc-gifconv-error">⚠ {errorMsg}</div>
                    )}
                </>
            )}

            {/* Converting */}
            {stage === "converting" && (
                <div className="nc-gifconv-loading">
                    <div className="nc-gifconv-spinner" />
                    <span className="nc-gifconv-loading-label">
                        Converting to GIF… {progress > 0 && `(${Math.round(progress * 100)}%)`}
                    </span>
                </div>
            )}

            {/* Preview */}
            {stage === "preview" && previewUrl && (
                <div className="nc-gifconv-preview-wrap">
                    <img src={previewUrl} alt="GIF preview" className="nc-gifconv-preview-img" />
                    <span className="nc-gifconv-preview-label">Preview · {filename}</span>
                    <div className="nc-gifconv-actions">
                        <button
                            className="nc-gifconv-btn nc-gifconv-btn-secondary"
                            onClick={() => {
                                setStage("idle");
                                setGifBlob(null);
                                if (previewUrl) URL.revokeObjectURL(previewUrl);
                                setPreviewUrl(null);
                            }}
                        >
                            ← Try Again
                        </button>
                        <button
                            className="nc-gifconv-btn nc-gifconv-btn-primary"
                            onClick={handleSend}
                        >
                            ✦ Send GIF
                        </button>
                    </div>
                </div>
            )}

            {/* Sending */}
            {stage === "sending" && (
                <div className="nc-gifconv-loading">
                    <div className="nc-gifconv-spinner" />
                    <span className="nc-gifconv-loading-label">Uploading…</span>
                </div>
            )}
        </div>
    );
}

// ─── ChatBar button ───────────────────────────────────────────────────────────

const GifConvertorChatBarButton: ChatBarButtonFactory = ({ isMainChat }) => {
    const [open, setOpen] = React.useState(false);
    const [pos, setPos] = React.useState<PopoverPosition | null>(null);
    const btnWrapRef = React.useRef<HTMLSpanElement>(null);

    if (!isMainChat) return null;

    const toggle = () => {
        if (!open && btnWrapRef.current) {
            const rect = btnWrapRef.current.getBoundingClientRect();
            setPos({
                // Position above the button with 10px gap
                bottom: window.innerHeight - rect.top + 10,
                // Horizontally centred on the button
                left: rect.left + rect.width / 2,
            });
        }
        setOpen(v => !v);
    };

    const close = () => setOpen(false);

    // Close on outside click
    React.useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const t = e.target as HTMLElement;
            if (!t.closest(".nc-gifconv-popover") && !t.closest(".nc-gifconv-btn-wrap"))
                close();
        };
        const id = setTimeout(() => document.addEventListener("mousedown", handler), 10);
        return () => { clearTimeout(id); document.removeEventListener("mousedown", handler); };
    }, [open]);

    // Close on Escape
    React.useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open]);

    return (
        <>
            <span ref={btnWrapRef} className="nc-gifconv-btn-wrap">
                <ChatBarButton tooltip={t("حوّل صورة أو فيديو إلى GIF", "Convert image or video to GIF")} onClick={toggle}>
                    <GifIcon active={open} />
                </ChatBarButton>
            </span>
            {open && pos && <GifConvertorPopover position={pos} onClose={close} />}
        </>
    );
};

// ─── Plugin definition ────────────────────────────────────────────────────────

export default definePlugin({
    name: "GifConvertor",
    dependencies: ["ChatInputButtonAPI"],
    description: "Converts an image or video to GIF and sends it in the current channel.",
    authors: [{ name: t("مؤلف غير معروف", "Unknown"), id: 0n }],

    chatBarButton: {
        icon: GifIcon,
        render: GifConvertorChatBarButton,
    },
});
