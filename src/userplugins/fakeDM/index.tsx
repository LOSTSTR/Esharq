/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addChatBarButton, ChatBarButton, ChatBarButtonFactory, removeChatBarButton } from "@api/ChatButtons";
import { EquicordDevs } from "@utils/constants";
import { isArabicMode, t } from "@utils/esharqI18n";
import { ModalContent, ModalHeader, ModalRoot, openModal, RenderModalProps } from "@utils/esharqModals";
import { ModalSize } from "@utils/modal";
import definePlugin from "@utils/types";
import { ChannelStore, FluxDispatcher, MessageStore, React, SelectedChannelStore, showToast, Text, Toasts, useCallback, useMemo, useState, UserStore } from "@webpack/common";

// ── Snowflake / timestamp helpers ────────────────────────────────────────────
let idCounter = 0;
function uniqueSnowflake(date: Date): string {
    const offset = idCounter++ % 4096;
    const ms = Math.max(0, date.getTime() - 1420070400000);
    return ((BigInt(ms) << 22n) | BigInt(offset)).toString();
}

// ── Persistence (local-only; nothing leaves your client) ─────────────────────
const STORAGE_KEY = "esharq-fakeDM-store";

interface PersistedMessage { type: "message"; channelId: string; authorId: string; content: string; timestamp: string; id: string; }
interface PersistedCall { type: "call"; channelId: string; callerId: string; missed: boolean; durationSec: number; timestamp: string; endedTimestamp: string; id: string; }
type PersistedFake = PersistedMessage | PersistedCall;

function loadPersisted(): PersistedFake[] {
    try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function savePersisted(fakes: PersistedFake[]) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fakes)); } catch { }
}

// Per-channel set of the fake message ids we injected, so we can delete them cleanly.
const fakeIds = new Map<string, Set<string>>();
function registerFake(channelId: string, id: string) {
    if (!fakeIds.has(channelId)) fakeIds.set(channelId, new Set());
    fakeIds.get(channelId)!.add(id);
}

/** Removes one injected fake — used by the per-item delete in the list. */
function removeFake(channelId: string, id: string) {
    FluxDispatcher.dispatch({ type: "MESSAGE_DELETE", channelId, id, mlDeleted: true });
    fakeIds.get(channelId)?.delete(id);
    savePersisted(loadPersisted().filter(f => f.id !== id));
}

function clearFakes(channelId: string): number {
    const ids = fakeIds.get(channelId);
    if (!ids?.size) return 0;
    let n = 0;
    for (const id of ids) {
        FluxDispatcher.dispatch({ type: "MESSAGE_DELETE", channelId, id, mlDeleted: true });
        n++;
    }
    savePersisted(loadPersisted().filter(f => !(f.channelId === channelId && ids.has(f.id))));
    ids.clear();
    return n;
}

// ── Channel helpers ──────────────────────────────────────────────────────────
function getDMChannel(): any | null {
    try {
        const id = SelectedChannelStore.getChannelId();
        if (!id) return null;
        const ch = ChannelStore.getChannel(id);
        return ch && (ch.type === 1 || ch.type === 3) ? ch : null;
    } catch { return null; }
}

function getChannelMembers(): any[] {
    const ch = getDMChannel();
    if (!ch) return [];
    const me = UserStore.getCurrentUser();
    const members: any[] = [];
    if (me) members.push(me);
    for (const id of (ch.recipients ?? [])) {
        if (id === me?.id) continue;
        const u = UserStore.getUser(id);
        if (u) members.push(u);
    }
    return members;
}

function displayName(user: any): string {
    return user?.globalName ?? user?.username ?? "?";
}

/** Discord CDN avatar, or the default avatar when the user has none. */
function avatarUrl(user: any): string {
    if (user?.avatar) {
        const ext = user.avatar.startsWith("a_") ? "gif" : "png";
        return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=64`;
    }
    const idx = Number((BigInt(user?.id ?? "0") >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

function buildAuthor(user: any) {
    return {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator ?? "0",
        avatar: user.avatar ?? null,
        public_flags: user.publicFlags ?? 0,
        flags: user.flags ?? 0,
        banner: user.banner ?? null,
        accent_color: null,
        global_name: user.globalName ?? user.username,
        avatar_decoration_data: user.avatarDecorationData
            ? { asset: user.avatarDecorationData.asset, sku_id: user.avatarDecorationData.skuId }
            : null,
        banner_color: null,
    };
}

// ── Injection (local MESSAGE_CREATE dispatch — never sent to Discord) ─────────
function injectMessage(channelId: string, author: any, content: string, date: Date, persistedId?: string) {
    const id = persistedId ?? uniqueSnowflake(date);
    FluxDispatcher.dispatch({
        type: "MESSAGE_CREATE",
        channelId,
        message: {
            attachments: [], components: [], embeds: [], mention_roles: [], mentions: [],
            author: buildAuthor(author),
            channel_id: channelId,
            content,
            edited_timestamp: null,
            flags: 0,
            id,
            mention_everyone: false,
            nonce: id,
            pinned: false,
            timestamp: date.toISOString(),
            tts: false,
            type: 0,
        },
        optimistic: false,
        isPushNotification: false,
    });
    registerFake(channelId, id);
    if (!persistedId) {
        const fakes = loadPersisted();
        fakes.push({ type: "message", channelId, authorId: author.id, content, timestamp: date.toISOString(), id });
        savePersisted(fakes);
    }
}

function injectCall(channelId: string, caller: any, missed: boolean, durationSec: number, date: Date, persistedId?: string, persistedEnded?: string) {
    const id = persistedId ?? uniqueSnowflake(date);
    const endedDate = persistedEnded ? new Date(persistedEnded) : new Date(date.getTime() + (missed ? 0 : durationSec * 1000));
    FluxDispatcher.dispatch({
        type: "MESSAGE_CREATE",
        channelId,
        message: {
            attachments: [], components: [], embeds: [], mention_roles: [], mentions: [],
            author: buildAuthor(caller),
            channel_id: channelId,
            content: "",
            edited_timestamp: null,
            flags: 0,
            id,
            mention_everyone: false,
            nonce: id,
            pinned: false,
            timestamp: date.toISOString(),
            tts: false,
            type: 3,
            call: { participants: [caller.id], ended_timestamp: endedDate.toISOString(), duration: missed ? undefined : durationSec },
        },
        optimistic: false,
        isPushNotification: false,
    });
    registerFake(channelId, id);
    if (!persistedId) {
        const fakes = loadPersisted();
        fakes.push({ type: "call", channelId, callerId: caller.id, missed, durationSec, timestamp: date.toISOString(), endedTimestamp: endedDate.toISOString(), id });
        savePersisted(fakes);
    }
}

// ── Restore persisted fakes when a channel's messages load ───────────────────
function restoreForChannel(channelId: string) {
    const fakes = loadPersisted().filter(f => f.channelId === channelId);
    for (const f of fakes) {
        if (MessageStore.getMessage(channelId, f.id)) continue;
        if (f.type === "message") {
            const author = UserStore.getUser(f.authorId);
            if (author) injectMessage(channelId, author, f.content, new Date(f.timestamp), f.id);
        } else {
            const caller = UserStore.getUser(f.callerId);
            if (caller) injectCall(channelId, caller, f.missed, f.durationSec, new Date(f.timestamp), f.id, f.endedTimestamp);
        }
    }
}

function onLoadMessages(e: any) {
    if (e?.channelId) setTimeout(() => restoreForChannel(e.channelId), 60);
}

// ── datetime-local <-> Date ──────────────────────────────────────────────────
// `datetime-local` speaks LOCAL wall-clock time with no zone. toISOString() would
// shift by the UTC offset and silently place the fake in the wrong hour, so the
// offset is subtracted before slicing.
function toLocalInput(d: Date): string {
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
}
function fromLocalInput(s: string): Date | null {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

// ── Composer modal ────────────────────────────────────────────────────────────
function FakeDMModal({ rootProps }: { rootProps: RenderModalProps; }) {
    const channel = getDMChannel();
    const members = useMemo(getChannelMembers, []);
    const me = UserStore.getCurrentUser();

    const [authorId, setAuthorId] = useState<string>(members.find(m => m.id !== me?.id)?.id ?? me?.id ?? "");
    const [content, setContent] = useState("");
    const [mode, setMode] = useState<"message" | "call">("message");
    const [missed, setMissed] = useState(false);
    const [minutes, setMinutes] = useState("5");
    const [when, setWhen] = useState(() => toLocalInput(new Date()));
    // Bumped after every inject/delete so the list below re-reads localStorage.
    const [rev, setRev] = useState(0);

    const rtl = isArabicMode();

    const fakes = useMemo(
        () => (channel ? loadPersisted().filter(f => f.channelId === channel.id) : []).slice().reverse(),
        [channel?.id, rev]
    );

    const shiftBy = useCallback((ms: number) => setWhen(toLocalInput(new Date(Date.now() - ms))), []);

    function submit() {
        if (!channel) return;
        const author = UserStore.getUser(authorId);
        if (!author) return;
        const date = fromLocalInput(when);
        if (!date) {
            showToast(t("التاريخ غير صالح", "Invalid date"), Toasts.Type.FAILURE);
            return;
        }
        if (mode === "message") {
            if (!content.trim()) return;
            injectMessage(channel.id, author, content, date);
            setContent("");
        } else {
            const secs = Math.max(0, Math.round((parseFloat(minutes) || 0) * 60));
            injectCall(channel.id, author, missed, secs, date);
        }
        setRev(n => n + 1);
        showToast(t("تمّت الإضافة محلياً (أنت فقط تراها)", "Injected locally (only you can see it)"), Toasts.Type.SUCCESS);
    }

    const cls = (...xs: (string | false | undefined)[]) => xs.filter(Boolean).join(" ");

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold">
                    {mode === "message" ? t("محادثة وهمية", "Fake DM") : t("مكالمة وهمية", "Fake Call")}
                </Text>
            </ModalHeader>

            {/* dir sits on our own div, not on ModalContent: the shim types Discord's
                modal parts as accepting any prop, so tsc would never catch it if Discord
                simply dropped `dir` instead of forwarding it to the DOM. */}
            <ModalContent>
                <div className="esharq-fakedm" dir={rtl ? "rtl" : "ltr"}>
                    <Text variant="text-xs/normal" className="esharq-fakedm-note">
                        {t("محلّي بالكامل — لا يُرسَل شيء، وأنت وحدك من يراه.", "Fully local — nothing is sent, and only you can see it.")}
                    </Text>

                    {/* Mode tabs */}
                    <div className="esharq-fakedm-tabs" role="tablist">
                        {(["message", "call"] as const).map(m => (
                            <button
                                key={m}
                                role="tab"
                                aria-selected={mode === m}
                                className={cls("esharq-fakedm-tab", mode === m && "esharq-fakedm-tab-on")}
                                onClick={() => setMode(m)}
                            >
                                {m === "message" ? t("💬 رسالة", "💬 Message") : t("📞 مكالمة", "📞 Call")}
                            </button>
                        ))}
                    </div>

                    {/* Sender. Avatar cards for a 1:1 DM; a plain list for group DMs — the
                        two-button design in the reference cannot express 3+ recipients. */}
                    <Text variant="text-xs/semibold" className="esharq-fakedm-label">
                        {mode === "message" ? t("المُرسِل", "Sender") : t("المُتّصِل", "Caller")}
                    </Text>
                    <div className={cls("esharq-fakedm-people", members.length > 3 && "esharq-fakedm-people-wrap")}>
                        {members.map(m => (
                            <button
                                key={m.id}
                                className={cls("esharq-fakedm-person", authorId === m.id && "esharq-fakedm-person-on")}
                                onClick={() => setAuthorId(m.id)}
                                aria-pressed={authorId === m.id}
                            >
                                <img className="esharq-fakedm-avatar" src={avatarUrl(m)} alt="" />
                                <span className="esharq-fakedm-person-name">
                                    {m.id === me?.id ? t("أنت", "You") : displayName(m)}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* When */}
                    <Text variant="text-xs/semibold" className="esharq-fakedm-label">{t("التوقيت", "When")}</Text>
                    <div className="esharq-fakedm-row">
                        <input
                            type="datetime-local"
                            className="esharq-fakedm-date"
                            value={when}
                            onChange={e => setWhen(e.currentTarget.value)}
                            dir="ltr"
                        />
                        <button className="esharq-fakedm-chip" onClick={() => shiftBy(0)}>{t("الآن", "Now")}</button>
                    </div>
                    <div className="esharq-fakedm-row esharq-fakedm-row-wrap">
                        <button className="esharq-fakedm-chip" onClick={() => shiftBy(5 * 60e3)}>{t("قبل ٥ دقائق", "5m ago")}</button>
                        <button className="esharq-fakedm-chip" onClick={() => shiftBy(60 * 60e3)}>{t("قبل ساعة", "1h ago")}</button>
                        <button className="esharq-fakedm-chip" onClick={() => shiftBy(24 * 3600e3)}>{t("أمس", "Yesterday")}</button>
                        <button className="esharq-fakedm-chip" onClick={() => shiftBy(7 * 24 * 3600e3)}>{t("الأسبوع الماضي", "Last week")}</button>
                    </div>

                    {mode === "message" ? (
                        <textarea
                            className="esharq-fakedm-textarea"
                            value={content}
                            onChange={e => setContent(e.currentTarget.value)}
                            placeholder={t("اكتب الرسالة…  (Enter للإضافة، Shift+Enter لسطر جديد)", "Type the message…  (Enter to inject, Shift+Enter for a new line)")}
                            rows={3}
                            autoFocus
                            onKeyDown={e => {
                                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
                            }}
                        />
                    ) : (
                        <>
                            <div className="esharq-fakedm-row">
                                <button
                                    className={cls("esharq-fakedm-seg", !missed && "esharq-fakedm-seg-ok")}
                                    onClick={() => setMissed(false)}
                                    aria-pressed={!missed}
                                >
                                    {t("✔ تمّت", "✔ Answered")}
                                </button>
                                <button
                                    className={cls("esharq-fakedm-seg", missed && "esharq-fakedm-seg-miss")}
                                    onClick={() => setMissed(true)}
                                    aria-pressed={missed}
                                >
                                    {t("✖ فائتة", "✖ Missed")}
                                </button>
                            </div>
                            {!missed && (
                                <div className="esharq-fakedm-row">
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        className="esharq-fakedm-num"
                                        value={minutes}
                                        onChange={e => setMinutes(e.currentTarget.value)}
                                        dir="ltr"
                                    />
                                    <span className="esharq-fakedm-unit">{t("دقيقة", "min")}</span>
                                </div>
                            )}
                        </>
                    )}

                    <div className="esharq-fakedm-actions">
                        <button className="esharq-fakedm-submit" onClick={submit}>
                            {mode === "message" ? t("إضافة الرسالة", "Inject Message") : t("إضافة المكالمة", "Inject Call")}
                        </button>
                        <button
                            className="esharq-fakedm-clear"
                            disabled={fakes.length === 0}
                            onClick={() => {
                                if (!channel) return;
                                const n = clearFakes(channel.id);
                                setRev(x => x + 1);
                                showToast(t(`أُزيلت ${n} عنصراً وهمياً`, `Cleared ${n} fake item(s)`), Toasts.Type.SUCCESS);
                            }}
                        >
                            {t("🗑 مسح الكل", "🗑 Clear all")}
                        </button>
                    </div>

                    {/* What you injected here — the reference offers clear-all only, so a
                        single mistake costs you the whole fabricated history. */}
                    {fakes.length > 0 && (
                        <>
                            <Text variant="text-xs/semibold" className="esharq-fakedm-label">
                                {t(`المُضاف في هذه المحادثة (${fakes.length})`, `Injected here (${fakes.length})`)}
                            </Text>
                            <div className="esharq-fakedm-list">
                                {fakes.map(f => (
                                    <div key={f.id} className="esharq-fakedm-item">
                                        <span className="esharq-fakedm-item-icon">{f.type === "call" ? "📞" : "💬"}</span>
                                        <span className="esharq-fakedm-item-text">
                                            {f.type === "message"
                                                ? f.content
                                                : f.missed
                                                    ? t("مكالمة فائتة", "Missed call")
                                                    : t(`مكالمة (${Math.round(f.durationSec / 60)} دقيقة)`, `Call (${Math.round(f.durationSec / 60)} min)`)}
                                        </span>
                                        <span className="esharq-fakedm-item-time" dir="ltr">
                                            {new Date(f.timestamp).toLocaleString(rtl ? "ar" : "en-GB", { dateStyle: "short", timeStyle: "short" })}
                                        </span>
                                        <button
                                            className="esharq-fakedm-item-del"
                                            aria-label={t("حذف", "Delete")}
                                            onClick={() => { removeFake(f.channelId, f.id); setRev(x => x + 1); }}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

function FakeDMIcon() {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 5.94 2 10.8c0 2.5 1.2 4.74 3.14 6.32V22l3.9-2.14c.94.22 1.94.34 2.96.34 5.52 0 10-3.94 10-8.8S17.52 2 12 2z" />
        </svg>
    );
}

const renderChatButton: ChatBarButtonFactory = ({ channel, isMainChat }) => {
    if (!isMainChat || !channel || (channel.type !== 1 && channel.type !== 3)) return null;
    return (
        <ChatBarButton
            tooltip={t("محادثة وهمية", "Fake DM")}
            onClick={() => openModal(p => <FakeDMModal rootProps={p} />)}
        >
            <FakeDMIcon />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "FakeDM",
    description: "Inject fake local messages and call logs into a DM or group DM, at any date and time you pick. Purely visual and stored only in your client — nothing is ever sent, and only you can see them. They persist across reloads until you clear them.",
    authors: [EquicordDevs.LOSTSTR],
    dependencies: ["ChatInputButtonAPI"],

    start() {
        addChatBarButton("esharq-fakedm", renderChatButton, FakeDMIcon);
        FluxDispatcher.subscribe("LOAD_MESSAGES_SUCCESS", onLoadMessages);
    },

    stop() {
        removeChatBarButton("esharq-fakedm");
        FluxDispatcher.unsubscribe("LOAD_MESSAGES_SUCCESS", onLoadMessages);
        // Remove any currently-injected fakes from the open channel view.
        for (const channelId of [...fakeIds.keys()]) clearFakes(channelId);
    },
});
