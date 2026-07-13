/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addChatBarButton, ChatBarButton, ChatBarButtonFactory, removeChatBarButton } from "@api/ChatButtons";
import { FormSwitch } from "@components/FormSwitch";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import { ModalContent, ModalFooter, ModalHeader, ModalRoot, openModal, RenderModalProps } from "@utils/esharqModals";
import { ModalSize } from "@utils/modal";
import definePlugin from "@utils/types";
import { Button, ChannelStore, FluxDispatcher, MessageStore, React, Select, SelectedChannelStore, showToast, Text, TextArea, TextInput, Toasts, useState, UserStore } from "@webpack/common";

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

// ── Composer modal ────────────────────────────────────────────────────────────
function FakeDMModal({ rootProps }: { rootProps: RenderModalProps; }) {
    const channel = getDMChannel();
    const members = getChannelMembers();
    const me = UserStore.getCurrentUser();

    const [authorId, setAuthorId] = useState<string>(members.find(m => m.id !== me?.id)?.id ?? me?.id ?? "");
    const [content, setContent] = useState("");
    const [mode, setMode] = useState<"message" | "call">("message");
    const [missed, setMissed] = useState(false);
    const [duration, setDuration] = useState("60");

    const memberOptions = members.map(m => ({
        value: m.id,
        label: m.id === me?.id ? t("أنت", "You") : (m.globalName ?? m.username),
    }));

    function submit() {
        if (!channel) return;
        const author = UserStore.getUser(authorId);
        if (!author) return;
        if (mode === "message") {
            if (!content.trim()) return;
            injectMessage(channel.id, author, content, new Date());
        } else {
            injectCall(channel.id, author, missed, Math.max(0, parseInt(duration, 10) || 0), new Date());
        }
        setContent("");
        showToast(t("تمّت الإضافة محلياً (أنت فقط تراها)", "Injected locally (only you can see it)"), Toasts.Type.SUCCESS);
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold">{t("محادثة وهمية", "Fake DM")}</Text>
            </ModalHeader>
            <ModalContent className="esharq-fakedm-content">
                <Text variant="text-sm/normal" className="esharq-fakedm-note">
                    {t("محلّي بالكامل — لا يُرسَل شيء، وأنت وحدك من يراه.", "Fully local — nothing is sent, and only you can see it.")}
                </Text>

                <Text variant="text-xs/normal" className="esharq-fakedm-label">{t("المُرسِل", "Author")}</Text>
                <Select
                    options={memberOptions}
                    isSelected={v => v === authorId}
                    select={v => setAuthorId(v)}
                    serialize={String}
                />

                <Text variant="text-xs/normal" className="esharq-fakedm-label">{t("النوع", "Type")}</Text>
                <Select
                    options={[
                        { value: "message", label: t("رسالة", "Message") },
                        { value: "call", label: t("مكالمة", "Call") },
                    ]}
                    isSelected={v => v === mode}
                    select={v => setMode(v)}
                    serialize={String}
                />

                {mode === "message" ? (
                    <TextArea
                        value={content}
                        onChange={setContent}
                        placeholder={t("اكتب محتوى الرسالة الوهمية…", "Type the fake message content…")}
                        rows={3}
                    />
                ) : (
                    <>
                        <FormSwitch
                            title={t("مكالمة فائتة", "Missed call")}
                            value={missed}
                            onChange={setMissed}
                            hideBorder
                        />
                        {!missed && (
                            <>
                                <Text variant="text-xs/normal" className="esharq-fakedm-label">{t("المدة (ثانية)", "Duration (seconds)")}</Text>
                                <TextInput value={duration} onChange={setDuration} />
                            </>
                        )}
                    </>
                )}
            </ModalContent>
            <ModalFooter className="esharq-fakedm-footer">
                <Button color={Button.Colors.BRAND} onClick={submit}>
                    {t("إضافة", "Inject")}
                </Button>
                <Button color={Button.Colors.RED} onClick={() => {
                    if (!channel) return;
                    const n = clearFakes(channel.id);
                    showToast(t(`أُزيلت ${n} عنصراً وهمياً`, `Cleared ${n} fake item(s)`), Toasts.Type.SUCCESS);
                }}>
                    {t("مسح الوهمية (هذه المحادثة)", "Clear fakes (this channel)")}
                </Button>
                <Button color={Button.Colors.PRIMARY} look={Button.Looks.LINK} onClick={rootProps.onClose}>
                    {t("إغلاق", "Close")}
                </Button>
            </ModalFooter>
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
    description: "Inject fake local messages and call logs into a DM or group DM. Purely visual and stored only in your client — nothing is ever sent, and only you can see them. They persist across reloads until you clear them.",
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
