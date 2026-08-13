/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addContextMenuPatch, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import { ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalRoot, openModal } from "@utils/esharqModals";
import definePlugin, { OptionType } from "@utils/types";
import { Button, FluxDispatcher, GuildChannelStore, GuildMemberStore, GuildRoleStore, GuildStore, Menu, React, Select, SelectedGuildStore, showToast, TextArea, UserStore, VoiceStateStore } from "@webpack/common";
import { Logger } from "@utils/Logger";

const logger = new Logger("FakePerm");

let isEnabled = false;

function fpHide(el: HTMLElement) {
    el.style.display = "none";
    el.setAttribute("data-fp-hidden", "true");
}

const mutedUsers = new Map<string, boolean>();
const deafenedUsers = new Map<string, boolean>();
const fakeNicks = new Map<string, string>();
const disconnectedUsers = new Set<string>();
const kickedUsers = new Set<string>();
const bannedUsers = new Set<string>();
const deletedMessages = new Set<string>();

// Red server-mute / server-deafen icons (Discord-style), drawn as a small badge on the voice row.
const MUTE_ICON_SVG = "<svg width='14' height='14' viewBox='0 0 24 24'><path fill='currentColor' d='M6.7 11H5c0 3.4 2.7 6.2 6 6.7V21h2v-3.3c3.3-.5 6-3.3 6-6.7h-1.7c0 3-2.5 5.1-5.3 5.1S6.7 14 6.7 11z'/><path fill='currentColor' d='M19.8 4.3 4.3 19.8l-1.4-1.4L18.4 2.9z'/><path fill='currentColor' d='M12 15c1.7 0 3-1.3 3-3V6c0-1.7-1.3-3-3-3S9 4.3 9 6v6c0 .2 0 .3.1.5L15 6.6V6c0-.6-.4-1-1-1s-2 .4-2 1'/></svg>";
const DEAFEN_ICON_SVG = "<svg width='14' height='14' viewBox='0 0 24 24'><path fill='currentColor' d='M12 3a9 9 0 0 0-9 9v7a2 2 0 0 0 2 2h2v-8H5v-1a7 7 0 0 1 14 0v1h-2v8h2a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9z'/><path fill='currentColor' d='M20.8 3.9 3.9 20.8l-1.4-1.4L19.4 2.5z'/></svg>";

function findVoiceRow(userId: string): HTMLElement | null {
    const el = document.querySelector(`[class*='voiceUser'] [data-user-id="${userId}"], [class*='VoiceUser'] [data-user-id="${userId}"]`)
        ?? document.querySelector(`[data-user-id="${userId}"]`);
    return (el?.closest("[class*='voiceUser'], [class*='VoiceUser'], li") as HTMLElement | null) ?? null;
}

// Renders the (local) server-mute / server-deafen badges on voice rows. Clears and
// re-draws every call so toggling off removes the icon. Replaces the old (dead) badge
// system that only bumped a counter with no visible effect.
function applyVoiceBadges() {
    document.querySelectorAll(".fp-vbadge").forEach(el => el.remove());
    if (!isEnabled) return;
    const add = (userId: string, svg: string) => {
        const row = findVoiceRow(userId);
        if (!row) return;
        const badge = document.createElement("span");
        badge.className = "fp-vbadge";
        badge.style.cssText = "display:inline-flex;align-items:center;margin-left:4px;color:#f23f43;flex-shrink:0;";
        badge.innerHTML = svg;
        row.appendChild(badge);
    };
    for (const [uid, on] of mutedUsers) if (on) add(uid, MUTE_ICON_SVG);
    for (const [uid, on] of deafenedUsers) if (on) add(uid, DEAFEN_ICON_SVG);
}

function getCurrentGuildId(): string | null {
    try { return SelectedGuildStore?.getGuildId() ?? null; } catch { return null; }
}

function notifyMemberListChange() {
    if (!isEnabled) return;
    try {
        const guildId = getCurrentGuildId();
        if (!guildId) return;

        const myId = UserStore?.getCurrentUser()?.id;
        if (myId && VoiceStateStore) {
            const myVS = VoiceStateStore.getVoiceStateForUser(myId);
            if (!myVS || myVS.guildId !== guildId) return;
        }

        FluxDispatcher?.dispatch({ type: "GUILD_MEMBER_LIST_UPDATE", ops: [], id: "everyone", guildId });
    } catch (err) { logger.debug("Ignored error", err); }
}


function hideMessageInDOM(messageId: string) {
    // Only ever hide the single targeted message row (its <li>). We used to also
    // scan every sibling afterwards to hide "orphaned" date separators, but
    // Discord's message list is virtualized: DOM order does not reliably match
    // chronological/visual order (nodes get recycled/repositioned as you scroll),
    // so that sibling scan could end up hiding unrelated messages along with the
    // target one. Better to occasionally leave a stray date header than to hide
    // messages the user never asked to hide.
    let msgEl: HTMLElement | null =
        document.querySelector(`[data-list-item-id$="${messageId}"]`) ??
        document.querySelector(`li[id$="-${messageId}"]`) ??
        document.querySelector(`[id$="-${messageId}"]`);
    if (!msgEl) {
        for (const li of document.querySelectorAll("ol[data-list-id='chat-messages'] > li")) {
            if ((li as HTMLElement).id.includes(messageId)) { msgEl = li as HTMLElement; break; }
        }
    }
    if (!msgEl) return;
    // Always hide the whole row, not a smaller nested element that might happen
    // to share the same id suffix (e.g. an inner content/aria-label wrapper),
    // otherwise part of the message could stay visible.
    const row = (msgEl.closest("li") as HTMLElement | null) ?? msgEl;
    fpHide(row);
}

function getGuild(guildId: string | null) {
    if (!guildId) return null;
    try { return (GuildStore as any)?.getGuild?.(guildId) ?? null; } catch { return null; }
}

function getMember(guildId: string | null, userId: string) {
    if (!guildId) return null;
    try { return GuildMemberStore?.getMember(guildId, userId) ?? null; } catch { return null; }
}

function getGuildRoles(guildId: string | null): Array<{ id: string; name: string; color: number; }> {
    if (!guildId) return [];
    try {
        return (GuildRoleStore as any)?.getSortedRoles?.(guildId)?.filter((r: any) => r.id !== guildId).map((r: any) => ({ id: r.id, name: r.name, color: r.color })) ?? [];
    } catch {
        try {
            const guild = getGuild(guildId);
            if (!guild?.roles) return [];
            return Object.values(guild.roles as Record<string, any>).filter((r: any) => r.id !== guildId).sort((a: any, b: any) => b.position - a.position).map((r: any) => ({ id: r.id, name: r.name, color: r.color }));
        } catch { return []; }
    }
}

function getMemberRoleIds(guildId: string | null, userId: string): string[] {
    if (!guildId) return [];
    try { return (GuildMemberStore as any)?.getMember?.(guildId, userId)?.roles ?? []; } catch { return getMember(guildId, userId)?.roles ?? []; }
}

function toast(msg: string) {
    try { showToast(msg); } catch (err) { logger.debug("Ignored error", err); }
}

// ─── Common Styles ───────────────────────────────────────────────────────────

const modalTitle: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 600, lineHeight: "24px", color: "#ffffff", margin: 0, padding: 0 };
function footerBtn(bg: string): React.CSSProperties { return { flex: 1, fontFamily: "var(--font-primary)", fontSize: "14px", fontWeight: 500, height: "38px", background: bg, color: "#ffffff", border: "none", borderRadius: "8px", cursor: "pointer" }; }
function sectionLabel(mb = "8px"): React.CSSProperties { return { fontFamily: "var(--font-primary)", fontSize: "16px", fontWeight: 600, color: "#ffffff", marginBottom: mb }; }

// ─── Modals ───────────────────────────────────────────────────────────────────

function RenameModal({ rootProps, user, guildId }: { rootProps: any; user: any; guildId: string | null; }) {
    const member = getMember(guildId, user.id);
    const [nick, setNick] = React.useState<string>(fakeNicks.get(user.id) ?? member?.nick ?? user.username ?? "");
    function applyNick() {
        const trimmed = nick.trim();
        if (trimmed) fakeNicks.set(user.id, trimmed);
        else fakeNicks.delete(user.id);
        notifyMemberListChange();
        toast(t(`تم تغيير الاسم المستعار ← ${trimmed || "(إعادة تعيين)"}`, `Nickname changed → ${trimmed || "(reset)"}`));
        rootProps.onClose();
    }
    return (
        <ModalRoot {...rootProps} size="small">
            <ModalHeader separator={false}><h2 style={{ ...modalTitle, flex: 1 }}>{t("تغيير الاسم المستعار", "Change Nickname")}</h2><ModalCloseButton onClick={rootProps.onClose} /></ModalHeader>
            <ModalContent style={{ padding: "0 16px 20px" }}>
                <div style={sectionLabel()}>{t("الاسم المستعار", "Nickname")}</div>
                <input value={nick} onChange={e => setNick(e.target.value)} autoFocus maxLength={32} onKeyDown={e => { if (e.key === "Enter") applyNick(); }} style={{ width: "100%", background: "#383a40", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "8px", padding: "10px 12px", color: "#ffffff", fontFamily: "var(--font-primary)", fontSize: "16px", outline: "none", boxSizing: "border-box" as any }} />
            </ModalContent>
            <ModalFooter>
                <div style={{ display: "flex", gap: "12px", width: "100%", padding: "16px" }}>
                    <button onClick={rootProps.onClose} style={footerBtn("#4e5058") as any}>{t("إلغاء", "Cancel")}</button>
                    <button onClick={applyNick} style={footerBtn("#5865f2") as any}>{t("تطبيق", "Apply")}</button>
                </div>
            </ModalFooter>
        </ModalRoot>
    );
}

function KickModal({ rootProps, user, guildId }: { rootProps: any; user: any; guildId: string | null; }) {
    const [reason, setReason] = React.useState("");
    const username = user.globalName ?? user.username ?? "this user";
    const tag = user.username ?? "";
    return (
        <ModalRoot {...rootProps} size="small">
            <ModalHeader separator={false}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 700, color: "#ffffff", margin: 0, flex: 1 }}>
                    {t(`طرد ${username} من الخادم`, `Kick ${username} from server`)}
                </h2>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent style={{ padding: "8px 16px 20px" }}>
                <p style={{ fontFamily: "var(--font-primary)", fontSize: "14px", color: "#ffffff", lineHeight: "20px", marginBottom: "16px", marginTop: "4px" }}>
                    {t(`هل أنت متأكد من طرد @${tag} من الخادم؟ سيتمكّن من العودة بدعوة جديدة.`, `Are you sure you want to kick @${tag} from the server? They will be able to return with a new invitation.`)}
                </p>
                <div style={{ fontFamily: "var(--font-primary)", fontSize: "14px", fontWeight: 600, color: "#ffffff", marginBottom: "8px" }}>{t("سبب الطرد", "Reason for kick")}</div>
                <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder=""
                    style={{ width: "100%", height: "120px", background: "var(--input-background, #1e1f22)", border: "1px solid var(--background-tertiary, #1e1f22)", borderRadius: "4px", padding: "10px", color: "#ffffff", fontFamily: "var(--font-primary)", fontSize: "14px", lineHeight: "20px", resize: "none", outline: "none", boxSizing: "border-box" as any }}
                />
            </ModalContent>
            <ModalFooter>
                <div style={{ display: "flex", gap: "8px", width: "100%", padding: "16px" }}>
                    <button onClick={rootProps.onClose} style={footerBtn("#4e5058") as any}>{t("إلغاء", "Cancel")}</button>
                    <button onClick={() => { kickedUsers.add(user.id); disconnectedUsers.add(user.id); notifyMemberListChange(); toast(t(`تم طرد @${tag} (محلي)`, `@${tag} kicked (local)`)); rootProps.onClose(); }}
                        style={footerBtn("#da373c") as any}>
                        {t("طرد", "Kick")}
                    </button>
                </div>
            </ModalFooter>
        </ModalRoot>
    );
}

const BAN_REASONS = [
    { label: t("حساب مشبوه أو رسائل مزعجة", "Suspicious account or spam"), value: "spam" },
    { label: t("حساب مُخترَق أو مُختطَف", "Compromised or hacked account"), value: "compromised" },
    { label: t("مخالفة قواعد الخادم", "Non-respect of server rules"), value: "rules" },
    { label: t("أخرى", "Other"), value: "other" },
];
const DELETE_OPTIONS = [
    { label: t("عدم حذف أي شيء", "Don't delete anything"), value: "0" },
    { label: t("آخر ساعة", "Last hour"), value: "3600" },
    { label: t("آخر 24 ساعة", "Last 24 hours"), value: "86400" },
    { label: t("آخر 7 أيام", "Last 7 days"), value: "604800" },
];

function BanModal({ rootProps, user }: { rootProps: any; user: any; }) {
    const [reason, setReason] = React.useState<string | null>(null);
    const [customReason, setCustomReason] = React.useState("");
    const [deleteValue, setDeleteValue] = React.useState("3600");
    return (
        <ModalRoot {...rootProps} size="small">
            <ModalHeader separator={false}><h2 style={{ ...modalTitle, flex: 1 }}>{t(`حظر @${user.username}؟`, `Ban @${user.username}?`)}</h2><ModalCloseButton onClick={rootProps.onClose} /></ModalHeader>
            <ModalContent style={{ padding: "0 16px 20px" }}>
                <div style={sectionLabel()}>{t("السبب", "Reason")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
                    {BAN_REASONS.map(opt => (
                        <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", fontFamily: "var(--font-primary)", fontSize: "16px", color: "#ffffff", userSelect: "none" as any }} onClick={() => setReason(opt.value)}>
                            <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, border: reason === opt.value ? "6px solid #5865f2" : "2px solid #4e5058", background: reason === opt.value ? "#fff" : "transparent", boxSizing: "border-box" as any }} />
                            {opt.label}
                        </label>
                    ))}
                </div>
                {reason === "other" && <TextArea value={customReason} onChange={(v: string) => setCustomReason(v)} rows={3} style={{ marginBottom: "16px" }} />}
                <div style={sectionLabel()}>{t("حذف الرسائل", "Delete messages")}</div>
                <Select options={DELETE_OPTIONS} select={(v: string) => setDeleteValue(v)} isSelected={(v: string) => v === deleteValue} serialize={(v: string) => v} maxVisibleItems={5} closeOnSelect={true} />
            </ModalContent>
            <ModalFooter>
                <div style={{ display: "flex", gap: "12px", width: "100%", padding: "16px", justifyContent: "flex-end" }}>
                    <Button look={Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={rootProps.onClose}>{t("إلغاء", "Cancel")}</Button>
                    <Button look={Button.Looks.FILLED} color={Button.Colors.RED} onClick={() => { if (!reason) return toast(t("اختر سبباً", "Select a reason")); bannedUsers.add(user.id); kickedUsers.add(user.id); disconnectedUsers.add(user.id); notifyMemberListChange(); toast(t(`تم حظر @${user.username} (محلي)`, `@${user.username} banned (local)`)); rootProps.onClose(); }}>{t("حظر", "Ban")}</Button>
                </div>
            </ModalFooter>
        </ModalRoot>
    );
}

const TIMEOUT_DURATIONS = [
    { label: t("60 ثانية", "60 sec"), seconds: 60 }, { label: t("5 دقائق", "5 min"), seconds: 300 },
    { label: t("10 دقائق", "10 min"), seconds: 600 }, { label: t("ساعة", "1 hour"), seconds: 3600 },
    { label: t("يوم", "1 day"), seconds: 86400 }, { label: t("أسبوع", "1 week"), seconds: 604800 },
];

function TimeoutModal({ rootProps, user }: { rootProps: any; user: any; }) {
    const [selectedIdx, setSelectedIdx] = React.useState(0);
    const [reason, setReason] = React.useState("");
    const username = user.globalName ?? user.username ?? "this user";
    const tag = user.username ?? "";
    return (
        <ModalRoot {...rootProps} size="small">
            <ModalHeader separator={false}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 700, color: "#ffffff", margin: 0, flex: 1 }}>
                    {t(`مهلة ${username}`, `Timeout ${username}`)}
                </h2>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent style={{ padding: "8px 16px 20px" }}>
                <p style={{ fontFamily: "var(--font-primary)", fontSize: "14px", color: "#ffffff", lineHeight: "20px", marginBottom: "20px", marginTop: "4px" }}>
                    {t("لا يستطيع الأعضاء المفروضة عليهم مهلة مؤقتة إرسال الرسائل أو التفاعل في القنوات النصية، ولا يُسمح لهم بالانضمام إلى القنوات الصوتية أو قنوات المؤتمرات.", "Temporarily timed out members cannot send messages or react in text channels. They are also not allowed to join voice or conference channels.")}{" "}
                    <span style={{ color: "#00a8fc", cursor: "pointer" }}>{t("اعرف المزيد", "Learn more")}</span>
                </p>
                <div style={{ fontFamily: "var(--font-primary)", fontSize: "14px", fontWeight: 600, color: "#ffffff", marginBottom: "8px" }}>{t("المدّة", "Duration")}</div>
                <div style={{ display: "flex", marginBottom: "20px", borderRadius: "4px", overflow: "hidden", border: "1px solid var(--background-modifier-accent, rgba(255,255,255,0.1))" }}>
                    {TIMEOUT_DURATIONS.map((d, i) => (
                        <button key={i} onClick={() => setSelectedIdx(i)} style={{
                            flex: 1,
                            fontFamily: "var(--font-primary)",
                            fontSize: "14px",
                            fontWeight: 500,
                            background: selectedIdx === i ? "#5865f2" : "var(--background-secondary, #2b2d31)",
                            color: "#ffffff",
                            border: "none",
                            borderRight: i < TIMEOUT_DURATIONS.length - 1 ? "1px solid var(--background-modifier-accent, rgba(255,255,255,0.1))" : "none",
                            padding: "8px 2px",
                            height: "36px",
                            cursor: "pointer",
                            whiteSpace: "nowrap" as any,
                            textAlign: "center" as any,
                            boxSizing: "border-box" as any,
                        }}>
                            {d.label}
                        </button>
                    ))}
                </div>
                <div style={{ fontFamily: "var(--font-primary)", fontSize: "14px", fontWeight: 600, color: "#ffffff", marginBottom: "8px" }}>{t("السبب", "Reason")}</div>
                <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder={t("أدخل سبباً. سيظهر فقط في سجلّات الخادم ولن يتمكّن هذا العضو من رؤيته.", "Enter a reason. It will only be visible in server logs and this member won't be able to see it.")}
                    style={{ width: "100%", height: "100px", background: "var(--input-background, #1e1f22)", border: "1px solid var(--background-tertiary, #1e1f22)", borderRadius: "4px", padding: "10px", color: "#ffffff", fontFamily: "var(--font-primary)", fontSize: "14px", lineHeight: "20px", resize: "none", outline: "none", boxSizing: "border-box" as any }}
                />
            </ModalContent>
            <ModalFooter>
                <div style={{ display: "flex", gap: "8px", width: "100%", padding: "16px" }}>
                    <button onClick={rootProps.onClose} style={footerBtn("#4e5058") as any}>{t("إلغاء", "Cancel")}</button>
                    <button onClick={() => {
                        const d = TIMEOUT_DURATIONS[selectedIdx];
                        disconnectedUsers.add(user.id);
                        notifyMemberListChange();
                        toast(t(`تم فرض مهلة على @${tag} لمدّة ${d.label} (محلي)`, `@${tag} timed out for ${d.label} (local)`));
                        setTimeout(() => { disconnectedUsers.delete(user.id); notifyMemberListChange(); }, d.seconds * 1000);
                        rootProps.onClose();
                    }} style={footerBtn("#5865f2") as any}>
                        {t("مهلة", "Timeout")}
                    </button>
                </div>
            </ModalFooter>
        </ModalRoot>
    );
}

function AddRoleModal({ rootProps, user, guildId }: { rootProps: any; user: any; guildId: string | null; }) {
    const [search, setSearch] = React.useState("");
    const allRoles = getGuildRoles(guildId);
    const memberRoleIds = getMemberRoleIds(guildId, user.id);
    const filtered = allRoles.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));
    return (
        <ModalRoot {...rootProps} size="small">
            <ModalContent style={{ padding: "8px 0 0", background: "var(--background-floating, #18191c)", borderRadius: 8, minWidth: 220 }}>
                <div style={{ padding: "4px 8px" }}>
                    <input autoFocus placeholder={t("الرتبة", "Role")} value={search} onChange={e => setSearch(e.target.value)} style={{ width: "100%", background: "transparent", border: "1px solid var(--brand-experiment, #5865f2)", borderRadius: 4, outline: "none", color: "var(--text-normal, #dcddde)", fontSize: 14, padding: "4px 8px", boxSizing: "border-box" }} />
                </div>
                <div style={{ maxHeight: 300, overflowY: "auto", scrollbarWidth: "none", padding: "4px 0" }}>
                    {filtered.map(role => {
                        const color = role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#80848e";
                        return (
                            <div key={role.id} onClick={() => { toast(t(`الرتبة ${role.name} — محاكاة`, `Role ${role.name} — simulation`)); rootProps.onClose(); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", cursor: "pointer", opacity: memberRoleIds.includes(role.id) ? 0.5 : 1 }} onMouseEnter={e => (e.currentTarget.style.background = "var(--background-modifier-hover)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                                <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, flexShrink: 0 }} />
                                <span style={{ color: "var(--text-normal, #dcddde)", fontSize: 14 }}>{role.name}</span>
                            </div>
                        );
                    })}
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

// ─── Context menu patches ─────────────────────────────────────────────────────

function findGroupWithItem(children: any[], itemIds: string[]): number {
    for (let i = 0; i < children.length; i++) {
        const el = children[i];
        if (!el?.props) continue;
        const sub = Array.isArray(el.props.children) ? el.props.children : el.props.children ? [el.props.children] : [];
        for (const child of sub) {
            if (child?.props?.id && itemIds.includes(child.props.id)) return i;
        }
    }
    return -1;
}

const messageContextPatch: NavContextMenuPatchCallback = (children, { message }: any) => {
    if (!children || !Array.isArray(children) || !isEnabled || !message?.id) return;
    try {
        const guildId = getCurrentGuildId();
        if (!guildId) return;
        const hasDelete = children.some((g: any) => {
            const sub = Array.isArray(g?.props?.children) ? g.props.children : [];
            return sub.some((c: any) => c?.props?.id === "delete-message");
        });
        children.splice(-1, 0, (
            <Menu.MenuGroup key="fp-msg-group">
                <Menu.MenuItem key="fp-delete-msg" id="fp-delete-msg" label={hasDelete ? t("حذف عندي (وهمي)", "Delete for me (fake)") : t("حذف الرسالة", "Delete message")} color="danger"
                    action={() => { deletedMessages.add(message.id); hideMessageInDOM(message.id); toast(t("تم حذف الرسالة (محلي)", "Message deleted (local)")); }} />
            </Menu.MenuGroup>
        ));
    } catch (e) {
        console.error("[FakePerm] Message context patch error:", e);
    }
};

const userContextPatch: NavContextMenuPatchCallback = (children, { user }: any) => {
    if (!children || !Array.isArray(children) || !isEnabled || !user) return;
    try {
        const guildId = getCurrentGuildId();
        if (!guildId) return;

        const HIDDEN_IDS = new Set(["roles", "perm-viewer-permissions"]);
        for (let i = 0; i < children.length; i++) {
            const group = children[i];
            if (!group?.props?.children) continue;
            const sub: any[] = Array.isArray(group.props.children)
                ? group.props.children
                : [group.props.children];
            const filtered = sub.filter((child: any) => !HIDDEN_IDS.has(child?.props?.id ?? ""));
            if (filtered.length !== sub.length) {
                children[i] = React.cloneElement(group, { children: filtered });
            }
        }
        const { username } = user;
        const allRoles = getGuildRoles(guildId);
        const memberRoleIds = getMemberRoleIds(guildId, user.id);

        const groupA = (
            <Menu.MenuGroup key="fp-group-a">
                <Menu.MenuItem key="fp-rename" id="fp-rename" label={t("تغيير الاسم المستعار", "Change Nickname")} action={() => openModal(p => <RenameModal rootProps={p} user={user} guildId={guildId} />)} />
                <Menu.MenuItem key="fp-roles" id="fp-roles" label={t("الرتب", "Roles")}>
                    {allRoles.length === 0
                        ? <Menu.MenuItem key="fp-roles-empty" id="fp-roles-empty" label={t("لا توجد رتب", "No roles")} disabled />
                        : [...allRoles.map(role => {
                            const hasRole = memberRoleIds.includes(role.id);
                            const color = role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#80848e";
                            return (
                                <Menu.MenuItem key={`fp-role-${role.id}`} id={`fp-role-${role.id}`} label={role.name} action={() => { }}
                                    render={() => (
                                        <div style={{ display: "flex", alignItems: "center", padding: "8px 10px", gap: 8, width: "100%", boxSizing: "border-box", cursor: "pointer" }}>
                                            <div style={{ width: 14, height: 14, borderRadius: "50%", background: color, flexShrink: 0 }} />
                                            <span style={{ flex: 1, color: "#ffffff", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{role.name}</span>
                                            <div style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, border: hasRole ? "none" : "1.5px solid #72767d", background: hasRole ? "#5865f2" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                {hasRole && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                            </div>
                                        </div>
                                    )} />
                            );
                        }),
                        <Menu.MenuItem key="fp-role-add" id="fp-role-add" label={t("+ إضافة رتبة", "+ Add a role")} action={() => openModal(p => <AddRoleModal rootProps={p} user={user} guildId={guildId} />)}
                            render={() => <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderTop: "1px solid rgba(79,84,92,0.48)", color: "#b9bbbe", fontSize: 13, cursor: "pointer" }}><span>+</span><span>{t("إضافة رتبة", "Add a role")}</span></div>} />,
                        ]}
                </Menu.MenuItem>
                <Menu.MenuItem key="fp-move" id="fp-move" label={t("النقل إلى", "Move to")}>
                    {(() => {
                        const allChannels: Array<{ id: string; name: string; position: number; }> = [];
                        try {
                            const gc = (GuildChannelStore as any)?.getChannels?.(guildId) ?? {};
                            const va: any[] = [...(gc.VOCAL ?? []), ...(gc[2] ?? []), ...(gc[13] ?? [])];
                            if (va.length === 0) for (const arr of Object.values(gc)) { if (Array.isArray(arr)) for (const item of arr as any[]) { const ch = (item as any).channel ?? item; if ((ch?.type === 2 || ch?.type === 13) && ch.id && ch.name) va.push(item); } }
                            const seen = new Set<string>();
                            for (const item of va) { const ch = (item as any).channel ?? item; if (ch?.id && ch?.name && !seen.has(ch.id)) { seen.add(ch.id); allChannels.push({ id: ch.id, name: ch.name, position: ch.position ?? 0 }); } }
                        } catch (err) { logger.debug("Ignored error", err); }
                        allChannels.sort((a, b) => a.position - b.position);
                        if (allChannels.length === 0) return <Menu.MenuItem key="fp-move-empty" id="fp-move-empty" label={t("لا توجد قنوات صوتية", "No voice channels")} disabled />;
                        return allChannels.map(ch => <Menu.MenuItem key={`fp-move-${ch.id}`} id={`fp-move-${ch.id}`} label={`🔊 ${ch.name}`} action={() => toast(t(`تم النقل إلى #${ch.name} — محاكاة`, `Moved to #${ch.name} — simulation`))} />);
                    })()}
                </Menu.MenuItem>
                <Menu.MenuCheckboxItem key="fp-mute" id="fp-mute" label={t("كتم في الخادم", "Server Mute")} color="danger" checked={mutedUsers.get(user.id) === true} action={() => { const next = !mutedUsers.get(user.id); mutedUsers.set(user.id, next); applyVoiceBadges(); }} />
                <Menu.MenuCheckboxItem key="fp-deafen" id="fp-deafen" label={t("إصمام في الخادم", "Server Deafen")} color="danger" checked={deafenedUsers.get(user.id) === true} action={() => { const next = !deafenedUsers.get(user.id); deafenedUsers.set(user.id, next); applyVoiceBadges(); }} />
                <Menu.MenuItem key="fp-disconnect" id="fp-disconnect" label={t("قطع الاتصال", "Disconnect")} color="danger" action={() => { disconnectedUsers.add(user.id); notifyMemberListChange(); toast(t(`تم فصل @${username} من الصوت (محلي)`, `@${username} disconnected from voice (local)`)); }} />
                <Menu.MenuItem key="fp-kick" id="fp-kick" label={t(`مهلة ${username}`, `Timeout ${username}`)} color="danger" action={() => openModal(p => <TimeoutModal rootProps={p} user={user} />)} />
                <Menu.MenuItem key="fp-expulser" id="fp-expulser" label={t(`طرد ${username}`, `Kick ${username}`)} color="danger" action={() => openModal(p => <KickModal rootProps={p} user={user} guildId={guildId} />)} />
                <Menu.MenuItem key="fp-ban" id="fp-ban" label={t(`حظر ${username}`, `Ban ${username}`)} color="danger" action={() => openModal(p => <BanModal rootProps={p} user={user} />)} />
            </Menu.MenuGroup>
        );

        const idxBlock = findGroupWithItem(children, ["block", "ignore"]);
        if (idxBlock >= 0) children.splice(idxBlock + 1, 0, groupA);
        else children.splice(-1, 0, groupA);
    } catch (e) {
        console.error("[FakePerm] User context patch error:", e);
    }
};

// ─── Settings ─────────────────────────────────────────────────────────────────

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Enable fake permissions in right-click menu",
        default: false,
        onChange(v: boolean) {
            isEnabled = Boolean(v);
            if (!isEnabled) {
                // Full cleanup when disabling
                document.querySelectorAll("[id^='fp-ibadge-']").forEach(el => el.remove());
                document.querySelectorAll("[data-fp-hidden='true']").forEach(el => {
                    (el as HTMLElement).style.display = "";
                    (el as HTMLElement).removeAttribute("data-fp-hidden");
                });
                mutedUsers.clear();
                deafenedUsers.clear();
                fakeNicks.clear();
                disconnectedUsers.clear();
                kickedUsers.clear();
                bannedUsers.clear();
                deletedMessages.clear();
                applyVoiceBadges();
            }
            toast(isEnabled ? t("تم تفعيل FakePerm ✓", "FakePerm enabled ✓") : t("تم تعطيل FakePerm ✓", "FakePerm disabled ✓"));
        }
    }
});

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "FakePerm",
    description: "Visually simulates moderation options in the right-click menu. No real action. Turn off ShowHiddenThings to use the permission part, since both rewrite the same checks.",
    authors: [{ name: t("مؤلف غير معروف", "Unknown"), id: 0n }],
    dependencies: ["ContextMenuAPI"],
    requiresRestart: false,
    settings,

    patches: [
        {
            find: "showCommunicationDisabledStyles",
            predicate: () => isEnabled && !isPluginEnabled("ShowHiddenThings"),
            replacement: {
                match: /&&\i\.\i\.canManageUser\(\i\.\i\.MODERATE_MEMBERS,\i\.author,\i\)/,
                replace: "",
            },
        },
        {
            find: "INVITES_DISABLED)||",
            predicate: () => isEnabled && !isPluginEnabled("ShowHiddenThings"),
            replacement: {
                match: /\i\.\i\.can\(\i\.\i.MANAGE_GUILD,\i\)/,
                replace: "true",
            },
        },
        {
            find: /,checkElevated:!1}\),\i\.\i\)}(?<=getCurrentUser\(\);return.+?)/,
            predicate: () => isEnabled && !isPluginEnabled("ShowHiddenThings"),
            replacement: {
                match: /return \i\.\i\(\i\.\i\(\{user:\i,context:\i,checkElevated:!1\}\),\i\.\i\)/,
                replace: "return true",
            }
        },
        // fixes a bug where Members page must be loaded to see highest role
        {
            find: "#{intl::GUILD_MEMBER_MOD_VIEW_HIGHEST_ROLE}),children:",
            predicate: () => isEnabled && !isPluginEnabled("ShowHiddenThings"),
            replacement: {
                match: /(#{intl::GUILD_MEMBER_MOD_VIEW_HIGHEST_ROLE}.{0,80})role:\i(?<=\[\i\.roles,\i\.highestRoleId,(\i)\].+?)/,
                replace: (_, rest, roles) => `${rest}role:$self.getHighestRole(arguments[0],${roles})`,
            }
        }
        // أُزيلت رقعة «فتح عرض الإشراف على نفسك»: كانت نسخةً حرفيةً مكرّرة من رقعة إضافة
        // ShowHiddenThings الأساسية (نفس البحث ونفس الاستبدال)، تحرسها هنا شرطيةٌ تُعطّلها
        // متى فُعّلت تلك الإضافة. أسقطها المصدر الأصلي ضمن «إصلاحات webpack»: صيانة رقعة
        // واحدة في مكان واحد مُحدَّث أضمن من نسخة ثانية تتخلّف. من يريد الميزة يُفعّل
        // ShowHiddenThings ⇐ خيار «عرض الإشراف».
    ],

    getHighestRole({ member }: { member: any; }, roles: any[]): any | undefined {
        try {
            return roles.find(role => role.id === member.highestRoleId);
        } catch {
            return undefined;
        }
    },

    _domInterval: null as ReturnType<typeof setInterval> | null,
    _domTimer: null as ReturnType<typeof setTimeout> | null,

    applyDomOverrides() {
        if (!isEnabled) return;
        for (const [userId, fakeNick] of fakeNicks) {
            document.querySelectorAll(`[data-user-id="${userId}"]`).forEach(el => {
                const nickEl = el.querySelector("[class*='nick'], [class*='Nick'], [class*='username'], [class*='Username']") as HTMLElement | null;
                if (nickEl && nickEl.dataset.fpOriginal === undefined) nickEl.dataset.fpOriginal = nickEl.textContent ?? "";
                if (nickEl && nickEl.dataset.fpNick !== fakeNick) { nickEl.dataset.fpNick = fakeNick; nickEl.textContent = fakeNick; }
            });
        }
        for (const userId of disconnectedUsers) {
            document.querySelectorAll(`[class*='voiceUser'] [data-user-id="${userId}"], [class*='VoiceUser'] [data-user-id="${userId}"]`).forEach(el => {
                const voiceEl = el.closest("li, [class*='voiceUser'], [class*='VoiceUser']") as HTMLElement | null;
                if (voiceEl && voiceEl.getAttribute("data-fp-hidden") !== "true") fpHide(voiceEl);
            });
        }
        for (const userId of kickedUsers) {
            document.querySelectorAll(`[data-user-id="${userId}"]`).forEach(el => {
                const memberEl = el.closest("li, [class*='member'], [class*='Member']") as HTMLElement | null;
                if (memberEl && memberEl.getAttribute("data-fp-hidden") !== "true") fpHide(memberEl);
            });
        }
        applyVoiceBadges();
    },

    async start() {
        isEnabled = settings.store.enabled === true;

        // Patches are ALWAYS registered — they check isEnabled at runtime
        addContextMenuPatch("user-context", userContextPatch);
        addContextMenuPatch("message", messageContextPatch);

        const style = document.createElement("style");
        style.id = "fakeperm-roles-style";
        style.textContent = "[class*='submenu']::-webkit-scrollbar{display:none!important}[class*='submenu']{scrollbar-width:none!important} .fp-footer-fix { display: flex; gap: 8px; padding: 16px; }";
        document.head.appendChild(style);

        // A MutationObserver on body+subtree used to drive this, which made the
        // browser build a mutation record for every single DOM change Discord
        // makes — typing, scrolling, hovering — even while no fake state was set
        // and the callback returned immediately. A slow poll costs nothing when
        // idle and is plenty for keeping the overrides applied.
        this._domInterval = setInterval(() => {
            if (!isEnabled) return;
            if (fakeNicks.size === 0 && disconnectedUsers.size === 0 && kickedUsers.size === 0 && mutedUsers.size === 0 && deafenedUsers.size === 0) return;
            if (this._domTimer) return;
            this._domTimer = setTimeout(() => {
                this._domTimer = null;
                if (isEnabled) this.applyDomOverrides();
            }, 150);
        }, 3000);
    },

    stop() {
        if (this._domInterval) { clearInterval(this._domInterval); this._domInterval = null; }
        if (this._domTimer) { clearTimeout(this._domTimer); this._domTimer = null; }
        removeContextMenuPatch("user-context", userContextPatch);
        removeContextMenuPatch("message", messageContextPatch);
        isEnabled = false;
        document.getElementById("fakeperm-roles-style")?.remove();
        document.querySelectorAll("[id^='fp-ibadge-']").forEach(el => el.remove());
        document.querySelectorAll("[data-fp-hidden='true']").forEach(el => {
            (el as HTMLElement).style.display = "";
            (el as HTMLElement).removeAttribute("data-fp-hidden");
        });
        mutedUsers.clear(); deafenedUsers.clear(); fakeNicks.clear();
        disconnectedUsers.clear(); kickedUsers.clear(); bannedUsers.clear(); deletedMessages.clear();
        applyVoiceBadges();
    },
});
