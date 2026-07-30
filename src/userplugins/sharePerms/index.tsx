/*
 * Nightcord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { sendBotMessage } from "@api/Commands";
import { addHeaderBarButton, HeaderBarButton, removeHeaderBarButton } from "@api/HeaderBar";
import { definePluginSettings } from "@api/Settings";
import { SafetyIcon as VSafetyIcon } from "@components/Icons";
import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot, openModal } from "@utils/esharqModals";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Avatar, Button, ChannelStore, FluxDispatcher, Forms, GuildStore, IconUtils, React, RelationshipStore, RestAPI, ScrollerThin, SearchableSelect, Select, showToast, Text, Toasts, Tooltip, UserStore } from "@webpack/common";

import { t } from "@utils/esharqI18n";

// ─── Icons ───────────────────────────────────────────────────────────────────

function ShieldIcon(props: any) {
    return <VSafetyIcon width={props.width || 16} height={props.height || 16} {...props} />;
}

function InternalFolderIcon(props: any) {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
        </svg>
    );
}

function TrashIcon(props: any) {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
    );
}

function ClockIcon(props: any) {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}

function UsersIcon(props: any) {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    );
}

function PlusIcon(props: any) {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    );
}

function LogsIcon(props: any) {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
        </svg>
    );
}

function ArrowRight(props: any) {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
        </svg>
    );
}

function ServerIcon(props: any) {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
            <line x1="6" y1="6" x2="6.01" y2="6" />
            <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
    );
}

// ─── Stores / Actions ─────────────────────────────────────────────────────────

const GuildMemberActions = findByPropsLazy("setCommunicationDisabledUntil", "kickUser", "banUser", "setNickname");
const VoiceActions = findByPropsLazy("setChannel", "setServerMute");
const MemberRoleActions = findByPropsLazy("updateMemberRoles");
const MessageActions = findByPropsLazy("deleteMessages", "sendMessage");
const MessageStore = findByPropsLazy("getMessages");
const UserProfileActions = findByPropsLazy("openUserProfileModal", "closeUserProfileModal");
const InviteActions = findByPropsLazy("resolveInvite");
const PrivateChannelActions = findByPropsLazy("ensurePrivateChannel");
const VoiceStateStore = findByPropsLazy("getVoiceState");

// ─── Types ────────────────────────────────────────────────────────────────────

interface SharedUser {
    id: string;
    guildId: string;
    channelId: string;
    permissions: string;
    validUntil: string;
    startTime: number;
    prefix: string;
    maxUses: number;
    uses: number;
    usesMap?: Record<string, number>;
}

interface ShareLog {
    userId: string;
    command: string;
    targetId: string;
    timestamp: number;
    success: boolean;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

const settings = definePluginSettings({
    sharedUsers: {
        type: OptionType.STRING,
        description: "Internal: list of shared users",
        default: "[]",
        hidden: true
    },
    logs: {
        type: OptionType.STRING,
        description: "Internal: logs of actions",
        default: "[]",
        hidden: true
    }
});

// ─── Data helpers ─────────────────────────────────────────────────────────────

function parseDuration(str: string): number {
    const match = str.match(/^(\d+)([smhdwy]?)$/);
    if (!match) return 0;
    const val = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
        case "s": return val * 1000;
        case "m": return val * 60 * 1000;
        case "h": return val * 60 * 60 * 1000;
        case "d": return val * 24 * 60 * 60 * 1000;
        case "w": return val * 7 * 24 * 60 * 60 * 1000;
        case "y": return val * 365 * 24 * 60 * 60 * 1000;
        default: return val * 1000;
    }
}

function getSharedUsers(): SharedUser[] {
    try { return JSON.parse(settings.store.sharedUsers); } catch { return []; }
}

function saveSharedUsers(users: SharedUser[]) {
    settings.store.sharedUsers = JSON.stringify(users);
}

function getLogs(): ShareLog[] {
    try { return JSON.parse(settings.store.logs); } catch { return []; }
}

function saveLog(log: ShareLog) {
    const logs = getLogs();
    logs.unshift(log);
    settings.store.logs = JSON.stringify(logs.slice(0, 100));
}

function clearLogs() {
    settings.store.logs = "[]";
}

function formatTimeLeft(ms: number): string {
    if (ms === Infinity) return "Permanent";
    if (ms <= 0) return "Expired";
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const parts: string[] = [];
    if (days > 0) parts.push(days + "d");
    if (hours > 0) parts.push(hours + "h");
    if (minutes > 0) parts.push(minutes + "m");
    if (seconds > 0 || parts.length === 0) parts.push(seconds + "s");
    return parts.join(" ");
}

function formatRelativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

function getTimerColor(ms: number): string {
    if (ms === Infinity) return "var(--text-muted)";
    if (ms <= 0) return "var(--status-danger)";
    if (ms < 3600000) return "#f0b232"; // < 1h → orange
    if (ms < 86400000) return "#f0b232"; // < 1d → orange
    return "var(--status-positive)";
}

// ─── Permission chip config ────────────────────────────────────────────────────

const PERM_CONFIG: Record<string, { label: string; color: string; bg: string; }> = {
    all: { label: "Full Access", color: "#fff", bg: "#5865f2" },
    ban: { label: "Ban", color: "#fff", bg: "#ed4245" },
    kick: { label: "Kick", color: "#fff", bg: "#f04747" },
    timeout: { label: "Timeout", color: "#fff", bg: "#f0b232" },
    rename_user: { label: "Rename User", color: "#fff", bg: "#3ba55c" },
    add_role: { label: "Add Role", color: "#fff", bg: "#00b0f4" },
    mute_voice: { label: "Mute Voice", color: "#fff", bg: "#9b59b6" },
    disconnect_voice: { label: "Disconnect Voice", color: "#fff", bg: "#e67e22" },
    move_voice: { label: "Move Voice", color: "#fff", bg: "#1abc9c" },
};

const CMD_COLOR: Record<string, string> = {
    ban: "#ed4245", unban: "#ed4245",
    kick: "#f04747",
    timeout: "#f0b232", untimeout: "#f0b232",
    mute: "#9b59b6", unmute: "#9b59b6",
    disconnect: "#e67e22", move: "#1abc9c",
    rename: "#3ba55c", addrole: "#00b0f4",
    clear: "#95a5a6",
};

function getCmdColor(cmd: string): string {
    return CMD_COLOR[cmd.toLowerCase()] ?? "rgba(255,255,255,0.15)";
}

// ─── DM helpers ───────────────────────────────────────────────────────────────

async function sendDM(userId: string, content: string) {
    try {
        const channels = Object.values(ChannelStore.getMutablePrivateChannels());
        let dmId = (channels.find((c: any) => c.type === 1 && c.recipients?.includes(userId)) as any)?.id;
        if (!dmId) {
            const r = await RestAPI.post({ url: "/users/@me/channels", body: { recipient_id: userId } });
            dmId = r.body?.id;
        }
        if (dmId) await RestAPI.post({ url: `/channels/${dmId}/messages`, body: { content, flags: 0, tts: false } });
    } catch (e) { console.error("[SharePerms] DM error:", e); }
}

// ─── Header Button ────────────────────────────────────────────────────────────

function SharePermsButton() {
    return (
        <HeaderBarButton
            icon={InternalFolderIcon}
            tooltip={t("SharePerms", "SharePerms")}
            onClick={() => openModal(props => <SharePermsModal rootProps={props} />)}
        />
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const MODAL_STYLES = `
.sp-modal-root {
    display: flex;
    flex-direction: column;
    width: 560px;
    max-height: 80vh;
    border-radius: 12px;
    overflow: hidden;
    background: var(--modal-background);
    color: #e3e5e8;
}

.sp-modal-root * {
    box-sizing: border-box;
}

.sp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 20px 0 20px;
    flex-shrink: 0;
}

.sp-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
}

.sp-header-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(88,101,242,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #5865f2;
    flex-shrink: 0;
}

.sp-header-title {
    font-size: 16px;
    font-weight: 700;
    color: #fff;
    line-height: 1.2;
}

.sp-header-sub {
    font-size: 12px;
    color: #96989d;
    margin-top: 1px;
}

.sp-tabs {
    display: flex;
    gap: 2px;
    padding: 16px 20px 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
}

.sp-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 6px 6px 0 0;
    border: none;
    background: transparent;
    color: #96989d;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
    position: relative;
    bottom: -1px;
    border-bottom: 2px solid transparent;
}

.sp-tab:hover {
    color: #c4c9ce;
    background: rgba(255,255,255,0.04);
}

.sp-tab.active {
    color: #fff;
    border-bottom-color: #5865f2;
}

.sp-tab-badge {
    background: rgba(255,255,255,0.08);
    color: #96989d;
    font-size: 11px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 10px;
    min-width: 18px;
    text-align: center;
}

.sp-tab.active .sp-tab-badge {
    background: rgba(88,101,242,0.2);
    color: #7289da;
}

.sp-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    min-height: 0;
}

/* ── Active tab ── */
.sp-access-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 18px;
    background: rgba(255,255,255,0.04);
    border-radius: 10px;
    margin-bottom: 8px;
    border: 1px solid rgba(255,255,255,0.07);
    transition: border-color 0.15s, background 0.15s;
}

.sp-access-card:hover {
    background: rgba(255,255,255,0.06);
    border-color: rgba(88,101,242,0.35);
}

.sp-access-avatar {
    flex-shrink: 0;
    border-radius: 50%;
    overflow: hidden;
}

.sp-access-info {
    flex: 1;
    min-width: 0;
}

.sp-access-name {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    margin-bottom: 5px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}

.sp-server-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(255,255,255,0.08);
    border-radius: 4px;
    padding: 2px 7px;
    font-size: 10px;
    color: #96989d;
    font-weight: 500;
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sp-perms-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 7px;
}

.sp-perm-chip {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
    letter-spacing: 0.1px;
}

.sp-meta-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.sp-timer {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}

.sp-uses-bar-wrap {
    flex: 1;
    max-width: 90px;
}

.sp-uses-bar-bg {
    height: 3px;
    border-radius: 2px;
    background: rgba(255,255,255,0.08);
    overflow: hidden;
}

.sp-uses-bar-fill {
    height: 100%;
    border-radius: 2px;
    background: #5865f2;
    transition: width 0.3s ease;
}

.sp-uses-text {
    font-size: 10px;
    color: #6d7174;
    margin-top: 2px;
    text-align: right;
}

.sp-revoke-btn {
    border: none;
    background: transparent;
    color: #6d7174;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 5px;
}

.sp-revoke-btn:hover {
    background: rgba(237,66,69,0.12);
    color: #ed4245;
}

/* ── Add tab ── */
.sp-form-section {
    margin-bottom: 18px;
}

.sp-form-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: #96989d;
    margin-bottom: 8px;
}

.sp-row-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 18px;
}

.sp-perm-chips-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

/* Minimal permission toggles */
.sp-perm-toggle {
    display: flex;
    align-items: center;
    padding: 5px 12px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    color: #96989d;
    transition: all 0.12s;
    white-space: nowrap;
}

.sp-perm-toggle:hover {
    border-color: rgba(255,255,255,0.2);
    color: #c4c9ce;
    background: rgba(255,255,255,0.07);
}

.sp-perm-toggle.selected {
    background: rgba(88,101,242,0.15);
    border-color: rgba(88,101,242,0.5);
    color: #c9cdfb;
    font-weight: 600;
}

.sp-perm-toggle.selected-danger {
    background: rgba(237,66,69,0.12);
    border-color: rgba(237,66,69,0.4);
    color: #f38d8f;
    font-weight: 600;
}

.sp-perm-toggle.selected-warn {
    background: rgba(240,178,50,0.12);
    border-color: rgba(240,178,50,0.4);
    color: #f5d37c;
    font-weight: 600;
}

.sp-grant-btn {
    width: 100%;
    height: 40px;
    border-radius: 8px;
    border: none;
    background: #5865f2;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.15s, opacity 0.15s;
    margin-top: 4px;
}

.sp-grant-btn:hover {
    background: #4752c4;
}

.sp-grant-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

/* Fix checkbox spacing in multi-select popouts */
[role="listbox"] [role="option"] {
    gap: 14px !important;
    padding-left: 14px !important;
}

[role="listbox"] [role="option"] [class*="checkbox"],
[role="listbox"] [role="option"] input[type="checkbox"],
[role="listbox"] [role="option"] svg {
    margin-right: 8px !important;
    flex-shrink: 0 !important;
}

/* ── Logs tab ── */
.sp-log-section-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #6d7174;
    margin: 16px 0 8px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.sp-log-section-title::after {
    content: "";
    flex: 1;
    height: 1px;
    background: rgba(255,255,255,0.06);
}

.sp-log-entry {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(255,255,255,0.03);
    margin-bottom: 5px;
    border-left: 3px solid transparent;
    transition: background 0.1s;
}

.sp-log-entry:hover {
    background: rgba(255,255,255,0.06);
}

.sp-log-entry.success { border-left-color: #3ba55c; }
.sp-log-entry.failed  { border-left-color: #ed4245; }

.sp-log-cmd-badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #fff;
    flex-shrink: 0;
}

.sp-log-arrow {
    color: #484c52;
    flex-shrink: 0;
}

.sp-log-target {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    min-width: 0;
}

.sp-log-target-name {
    font-size: 12px;
    font-weight: 500;
    color: #e3e5e8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.sp-log-status {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 2px 6px;
    border-radius: 10px;
    flex-shrink: 0;
}

.sp-log-status.success { color: #3ba55c; background: rgba(59,165,92,0.12); }
.sp-log-status.failed  { color: #ed4245; background: rgba(237,66,69,0.12); }

.sp-log-time {
    font-size: 10px;
    color: #6d7174;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
}

.sp-log-executor {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-shrink: 0;
}

.sp-log-executor-name {
    font-size: 12px;
    font-weight: 600;
    color: #e3e5e8;
    max-width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* ── Empty state ── */
.sp-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 20px;
    text-align: center;
    gap: 10px;
}

.sp-empty-icon {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: rgba(255,255,255,0.05);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #484c52;
    margin-bottom: 6px;
}

.sp-empty-title {
    font-size: 15px;
    font-weight: 600;
    color: #e3e5e8;
}

.sp-empty-sub {
    font-size: 12px;
    color: #6d7174;
    max-width: 280px;
    line-height: 1.5;
}

/* ── Logs header ── */
.sp-logs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
}

.sp-logs-count {
    font-size: 12px;
    color: #6d7174;
}

.sp-clear-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid rgba(255,255,255,0.08);
    background: transparent;
    color: #6d7174;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
}

.sp-clear-btn:hover {
    border-color: #ed4245;
    color: #ed4245;
    background: rgba(237,66,69,0.08);
}
`;

// ─── Log section helper ────────────────────────────────────────────────────────

function groupLogsByDate(logs: ShareLog[]): { title: string; entries: ShareLog[] }[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86400000);

    const groups: Record<string, ShareLog[]> = {};
    for (const log of logs) {
        const d = new Date(log.timestamp);
        d.setHours(0, 0, 0, 0);
        let key: string;
        if (d.getTime() === today.getTime()) key = "Today";
        else if (d.getTime() === yesterday.getTime()) key = "Yesterday";
        else key = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        if (!groups[key]) groups[key] = [];
        groups[key].push(log);
    }

    return Object.entries(groups).map(([title, entries]) => ({ title, entries }));
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

function SharePermsModal({ rootProps }: { rootProps: any; }) {
    const [tab, setTab] = React.useState<"active" | "add" | "logs">("active");
    const [users, setUsers] = React.useState(getSharedUsers());
    const [logs, setLogs] = React.useState(getLogs());

    // Add form state
    const [newUserIds, setNewUserIds] = React.useState<string[]>([]);
    const [newGuildId, setNewGuildId] = React.useState("");
    const [newDuration, setNewDuration] = React.useState("1d");
    const [newMaxUses, setNewMaxUses] = React.useState("0");
    const [newPerms, setNewPerms] = React.useState<string[]>(["all"]);
    const [isGranting, setIsGranting] = React.useState(false);
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    React.useEffect(() => {
        const timer = setInterval(() => {
            forceUpdate();
            setLogs(getLogs());
            setUsers(getSharedUsers());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const friends = RelationshipStore.getFriendIDs()
        .map((id: string) => UserStore.getUser(id))
        .filter(Boolean);

    const guilds = Object.values(GuildStore.getGuilds());

    const activeCount = users.length;
    const logCount = logs.length;

    // ── Grant access ──────────────────────────────────────────────────────────
    const handleGrant = async () => {
        if (newUserIds.length === 0 || !newGuildId) return;
        setIsGranting(true);
        try {
            const updated = [...users];
            for (const userId of newUserIds) {
                const newUser: SharedUser = {
                    id: userId,
                    guildId: newGuildId,
                    channelId: "",
                    permissions: newPerms.join(","),
                    validUntil: newDuration,
                    startTime: Date.now(),
                    prefix: "+",
                    maxUses: parseInt(newMaxUses) || 0,
                    uses: 0,
                    usesMap: {}
                };
                updated.push(newUser);

                const guild = GuildStore.getGuild(newGuildId) as any;
                const usesInfo = newUser.maxUses > 0 ? `${newUser.maxUses} times` : "Unlimited";
                const content = "🛡 **Nightcord — Permission Access Granted**\n\n" +
                    "Hello! You have been granted remote administrative access to my account permissions.\n\n" +
                    `**Server:** ${guild?.name ?? newGuildId}\n` +
                    `**Validity:** ${newDuration === "0" ? "Permanent" : newDuration}\n` +
                    `**Usage Limit:** ${usesInfo}\n` +
                    `**Permissions:** ${newPerms.map(p => PERM_CONFIG[p]?.label || p).join(", ")}\n\n` +
                    "**Available Commands:**\n" +
                    "`+timeout <ID> <duration>` · `+kick <ID>` · `+ban <ID>` · `+rename <ID> <name>`\n" +
                    "`+mute <ID>` · `+unmute <ID>` · `+disconnect <ID>` · `+move <ID>`\n" +
                    "`+addrole <ID> <RoleID>`\n\n" +
                    "*Please use these permissions responsibly.*";
                await sendDM(userId, content);
            }
            setUsers(updated);
            saveSharedUsers(updated);
            setNewUserIds([]);
            setNewGuildId("");
            setNewPerms(["all"]);
            showToast("Access granted ✓", Toasts.Type.SUCCESS);
            setTab("active");
        } finally {
            setIsGranting(false);
        }
    };

    // ── Revoke ────────────────────────────────────────────────────────────────
    const handleRevoke = async (index: number) => {
        const u = users[index];
        const updated = [...users];
        updated.splice(index, 1);
        setUsers(updated);
        saveSharedUsers(updated);

        if (u) {
            const guild = GuildStore.getGuild(u.guildId) as any;
            await sendDM(u.id, "🛡 **Nightcord — Permission Access Revoked**\n\n" +
                "Your administrative remote access has been revoked.\n\n" +
                `**Server:** ${guild?.name ?? u.guildId}\n` +
                "**Status:** Access Terminated");
        }
        showToast("Access revoked", Toasts.Type.MESSAGE);
    };

    // ── Permission toggle ─────────────────────────────────────────────────────
    const togglePerm = (val: string) => {
        if (val === "all") {
            setNewPerms(["all"]);
            return;
        }
        const without = newPerms.filter(p => p !== "all");
        if (without.includes(val)) {
            const next = without.filter(p => p !== val);
            setNewPerms(next.length === 0 ? ["all"] : next);
        } else {
            setNewPerms([...without, val]);
        }
    };

    // ── Clear logs ────────────────────────────────────────────────────────────
    const handleClearLogs = () => {
        clearLogs();
        setLogs([]);
    };

    const logGroups = groupLogsByDate(logs);

    return (
        <ModalRoot {...rootProps} size="medium" className="sp-modal-root">
            <style>{MODAL_STYLES}</style>

            {/* Header */}
            <div className="sp-header">
                <div className="sp-header-left">
                    <div className="sp-header-icon">
                        <ShieldIcon width={18} height={18} />
                    </div>
                    <div>
                        <div className="sp-header-title">{t("SharePerms", "SharePerms")}</div>
                        <div className="sp-header-sub">{t("إدارة الوصول عن بُعد", "Remote Access Management")}</div>
                    </div>
                </div>
                <ModalCloseButton onClick={rootProps.onClose} />
            </div>

            {/* Tabs */}
            <div className="sp-tabs">
                {([
                    { id: "active", label: t("الوصول النشط", "Active Access"), icon: <UsersIcon />, count: activeCount },
                    { id: "add", label: t("إضافة وصول", "Add Access"), icon: <PlusIcon />, count: null },
                    { id: "logs", label: t("السجلّات", "Logs"), icon: <LogsIcon />, count: logCount },
                ] as const).map(t_tab => (
                    <button
                        key={t_tab.id}
                        className={`sp-tab${tab === t_tab.id ? " active" : ""}`}
                        onClick={() => setTab(t_tab.id)}
                    >
                        {t_tab.icon}
                        {t_tab.label}
                        {t_tab.count !== null && (
                            <span className="sp-tab-badge">{t_tab.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <ModalContent className="sp-content">

                {/* ── Tab: Active ─────────────────────────────────────────── */}
                {tab === "active" && (
                    <div>
                        {users.length === 0 ? (
                            <div className="sp-empty">
                                <div className="sp-empty-icon">
                                    <UsersIcon width={22} height={22} />
                                </div>
                                <div className="sp-empty-title">{t("لا يوجد وصول نشط", "No active access")}</div>
                                <div className="sp-empty-sub">{t("امنح الوصول من تبويب «إضافة وصول»", "Grant access from the 'Add Access' tab")}</div>
                                <button className="sp-grant-btn" style={{ width: "auto", padding: "0 20px", marginTop: 8 }} onClick={() => setTab("add")}>
                                    <PlusIcon /> {t("إضافة وصول", "Add Access")}
                                </button>
                            </div>
                        ) : users.map((u, i) => {
                            const user = UserStore.getUser(u.id);
                            const guild = GuildStore.getGuild(u.guildId) as any;
                            const dur = parseDuration(u.validUntil);
                            const timeLeft = dur ? Math.max(0, u.startTime + dur - Date.now()) : Infinity;
                            const isExpired = dur > 0 && timeLeft <= 0;
                            const perms = u.permissions.split(",");
                            const usageRatio = u.maxUses > 0 ? u.uses / u.maxUses : 0;

                            return (
                                <div key={`${u.id}-${i}`} className="sp-access-card" style={{ opacity: isExpired ? 0.5 : 1 }}>
                                    <div className="sp-access-avatar">
                                        <Avatar
                                            src={IconUtils.getUserAvatarURL(user || { id: u.id, avatar: null } as any)}
                                            size={"SIZE_40" as any}
                                        />
                                    </div>
                                    <div className="sp-access-info">
                                        <div className="sp-access-name">
                                            {user?.globalName || user?.username || u.id}
                                            {guild && (
                                                <span className="sp-server-pill">
                                                    <ServerIcon width={10} height={10} />
                                                    {guild.name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="sp-perms-row">
                                            {perms.map(p => {
                                                const cfg = PERM_CONFIG[p];
                                                return cfg ? (
                                                    <span key={p} className="sp-perm-chip" style={{ background: cfg.bg + "18", color: cfg.bg, border: `1px solid ${cfg.bg}30` }}>
                                                        {cfg.label}
                                                    </span>
                                                ) : null;
                                            })}
                                        </div>
                                        <div className="sp-meta-row">
                                            <span className="sp-timer" style={{ color: getTimerColor(timeLeft) }}>
                                                <ClockIcon />
                                                {formatTimeLeft(timeLeft)}
                                            </span>
                                            {u.maxUses > 0 && (
                                                <div className="sp-uses-bar-wrap">
                                                    <div className="sp-uses-bar-bg">
                                                        <div
                                                            className="sp-uses-bar-fill"
                                                            style={{
                                                                width: `${Math.min(100, usageRatio * 100)}%`,
                                                                background: usageRatio > 0.8 ? "#ed4245" : usageRatio > 0.5 ? "#f0b232" : "#5865f2"
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="sp-uses-text">{u.uses}/{u.maxUses} {t("استخدامات", "uses")}</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button className="sp-revoke-btn" onClick={() => handleRevoke(i)}>
                                        <TrashIcon />
                                        {t("إلغاء الوصول", "Revoke")}
                                    </button>
                                </div>
                            );
                        })}

                    </div>
                )}

                {/* ── Tab: Add ────────────────────────────────────────────── */}
                {tab === "add" && (
                    <div>
                        <div className="sp-form-section">
                            <div className="sp-form-label">
                                <UsersIcon width={12} height={12} />
                                {t("المستخدمون المستهدَفون", "Target Users")}
                            </div>
                            <SearchableSelect
                                options={friends.map((f: any) => ({
                                    label: f.globalName || f.username,
                                    value: f.id
                                }))}
                                value={newUserIds}
                                onChange={(val: string[]) => setNewUserIds(val)}
                                placeholder={t("اختر أصدقاء…", "Select friends...")}
                                multi={true}
                                {...{
                                    renderOption: (opt: any) => {
                                        const u = UserStore.getUser(opt.value);
                                        return (
                                            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 16px 10px 14px" }}>
                                                <span style={{ marginLeft: 8, display: "flex" }}><Avatar src={IconUtils.getUserAvatarURL(u)} size={"SIZE_32" as any} /></span>
                                                <span style={{ fontSize: 14, fontWeight: 500, color: "#e3e5e8" }}>{opt.label}</span>
                                            </div>
                                        );
                                    },
                                    renderOptionLabel: (opt: any) => {
                                        const u = UserStore.getUser(opt.value);
                                        return (
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <Avatar src={IconUtils.getUserAvatarURL(u)} size={"SIZE_20" as any} />
                                                <span style={{ color: "#e3e5e8" }}>{opt.label}</span>
                                            </div>
                                        );
                                    }
                                } as any}
                            />
                        </div>

                        <div className="sp-form-section">
                            <div className="sp-form-label">
                                <ServerIcon />
                                {t("السيرفر", "Server")}
                            </div>
                            <SearchableSelect
                                options={guilds.map((g: any) => ({ label: g.name, value: g.id }))}
                                value={newGuildId}
                                onChange={(val: string) => setNewGuildId(val)}
                                placeholder={t("اختر سيرفراً…", "Select a server...")}
                            />
                        </div>

                        <div className="sp-row-2">
                            <div>
                                <div className="sp-form-label">
                                    <ClockIcon width={12} height={12} />
                                    {t("المدّة", "Duration")}
                                </div>
                                <Select
                                    options={[
                                        { label: t("ساعة واحدة", "1 Hour"), value: "1h" },
                                        { label: t("6 ساعات", "6 Hours"), value: "6h" },
                                        { label: t("12 ساعة", "12 Hours"), value: "12h" },
                                        { label: t("يوم واحد", "1 Day"), value: "1d" },
                                        { label: t("أسبوع واحد", "1 Week"), value: "1w" },
                                        { label: t("دائم", "Permanent"), value: "0" },
                                    ]}
                                    isSelected={(v: string) => newDuration === v}
                                    select={(v: string) => setNewDuration(v)}
                                    serialize={(v: string) => v}
                                />
                            </div>
                            <div>
                                <div className="sp-form-label">
                                    <LogsIcon />
                                    {t("أقصى عدد استخدامات", "Max Uses")}
                                </div>
                                <Select
                                    options={[
                                        { label: t("غير محدود", "Unlimited"), value: "0" },
                                        { label: t("استخدام واحد", "1 use"), value: "1" },
                                        { label: t("3 استخدامات", "3 uses"), value: "3" },
                                        { label: t("5 استخدامات", "5 uses"), value: "5" },
                                        { label: t("10 استخدامات", "10 uses"), value: "10" },
                                        { label: t("25 استخداماً", "25 uses"), value: "25" },
                                        { label: t("50 استخداماً", "50 uses"), value: "50" },
                                    ]}
                                    isSelected={(v: string) => newMaxUses === v}
                                    select={(v: string) => setNewMaxUses(v)}
                                    serialize={(v: string) => v}
                                />
                            </div>
                        </div>

                        <div className="sp-form-section">
                            <div className="sp-form-label">
                                <ShieldIcon width={12} height={12} />
                                {t("الصلاحيات", "Permissions")}
                            </div>
                            <div className="sp-perm-chips-grid">
                                {Object.entries(PERM_CONFIG).map(([val, cfg]) => {
                                    const isSelected = newPerms.includes(val);
                                    const isDanger = ["ban", "kick"].includes(val);
                                    const isWarn = ["timeout", "disconnect_voice"].includes(val);
                                    const selectedClass = isSelected
                                        ? isDanger ? " selected-danger" : isWarn ? " selected-warn" : " selected"
                                        : "";
                                    return (
                                        <button
                                            key={val}
                                            className={`sp-perm-toggle${selectedClass}`}
                                            onClick={() => togglePerm(val)}
                                        >
                                            {cfg.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <button
                            className="sp-grant-btn"
                            onClick={handleGrant}
                            disabled={isGranting || newUserIds.length === 0 || !newGuildId}
                        >
                            {isGranting ? t("جارٍ المنح…", "Granting...") : (
                                <><ShieldIcon width={15} height={15} /> {t("منح الوصول", "Grant Access")}</>
                            )}
                        </button>
                    </div>
                )}

                {/* ── Tab: Logs ───────────────────────────────────────────── */}
                {tab === "logs" && (
                    <div>
                        <div className="sp-logs-header">
                            <span className="sp-logs-count">
                                {logCount > 0 ? `${logCount} action${logCount > 1 ? "s" : ""} logged` : "No logs"}
                            </span>
                            {logCount > 0 && (
                                <button className="sp-clear-btn" onClick={handleClearLogs}>
                                    <TrashIcon /> {t("مسح الكل", "Clear all")}
                                </button>
                            )}
                        </div>

                        {logs.length === 0 ? (
                            <div className="sp-empty">
                                <div className="sp-empty-icon">
                                    <LogsIcon width={22} height={22} />
                                </div>
                                <div className="sp-empty-title">{t("لا توجد إجراءات مسجّلة", "No logged actions")}</div>
                                <div className="sp-empty-sub">{t("ستظهر هنا الإجراءات التي ينفّذها المستخدمون المصرّح لهم", "Actions performed by authorized users will appear here")}</div>
                            </div>
                        ) : logGroups.map(group => (
                            <div key={group.title}>
                                <div className="sp-log-section-title">{group.title}</div>
                                {group.entries.map((log, i) => {
                                    const executor = UserStore.getUser(log.userId);
                                    const target = UserStore.getUser(log.targetId);
                                    const cmdColor = getCmdColor(log.command);
                                    const isSuccess = log.success;

                                    return (
                                        <div key={i} className={`sp-log-entry ${isSuccess ? "success" : "failed"}`}>
                                            {/* Executor */}
                                            <div className="sp-log-executor">
                                                <Avatar
                                                    src={IconUtils.getUserAvatarURL(executor || { id: log.userId, avatar: null } as any)}
                                                    size={"SIZE_24" as any}
                                                />
                                                <span className="sp-log-executor-name">
                                                    {executor?.globalName || executor?.username || log.userId.slice(0, 8)}
                                                </span>
                                            </div>

                                            {/* Command badge */}
                                            <span className="sp-log-cmd-badge" style={{ background: cmdColor }}>
                                                {log.command}
                                            </span>

                                            {/* Arrow + target */}
                                            <span className="sp-log-arrow"><ArrowRight /></span>
                                            <div className="sp-log-target">
                                                {target && (
                                                    <Avatar
                                                        src={IconUtils.getUserAvatarURL(target)}
                                                        size={"SIZE_16" as any}
                                                    />
                                                )}
                                                <span className="sp-log-target-name">
                                                    {target?.globalName || target?.username || log.targetId.replace(/<@!?(\d+)>/, "$1").slice(0, 10)}
                                                </span>
                                            </div>

                                            {/* Status + time */}
                                            <span className={`sp-log-status ${isSuccess ? "success" : "failed"}`}>
                                                {isSuccess ? "✓" : "✗"}
                                            </span>
                                            <Tooltip text={new Date(log.timestamp).toLocaleString("en-US")}>
                                                {(tooltipProps: any) => (
                                                    <span {...tooltipProps} className="sp-log-time">
                                                        {formatRelativeTime(log.timestamp)}
                                                    </span>
                                                )}
                                            </Tooltip>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}

            </ModalContent>
        </ModalRoot>
    );
}

// ─── Id resolver ──────────────────────────────────────────────────────────────

function resolveId(arg: string): string {
    if (!arg) return "";
    const match = arg.match(/<@!?(\d+)>/);
    return match ? match[1] : arg;
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

function AboutWarning() {
    return (
        <div style={{
            border: "1px solid #ed4245", borderRadius: 8, padding: "12px 14px", marginBottom: 12,
            background: "rgba(237, 66, 69, 0.1)", color: "var(--text-normal, #dbdee1)", fontSize: 13, lineHeight: 1.6
        }}>
            ⚠️ {t(
                "تحذير خطير: هذه الإضافة تسمح لمستخدمين آخرين تمنحهم الوصول بأن ينفّذوا إجراءات إشراف (طرد/حظر/إسكات/إعادة تسمية) عبر حسابك أنت — تظهر هذه الإجراءات كأنّك من قام بها وتتحمّل مسؤوليتها الكاملة. تنفّذ الإضافة أوامر تصلك عبر الرسائل، وهذه أتمتة قد تعرّض حسابك للحظر. امنح الوصول لأشخاص تثق بهم تماماً فقط، واستخدمها على مسؤوليتك.",
                "Serious warning: this plugin lets other users you grant access to perform moderation actions (kick/ban/timeout/rename) THROUGH YOUR account — those actions appear as done by you and you are fully responsible for them. It executes commands received via messages, which is automation that can get your account banned. Only grant access to people you fully trust, and use at your own risk."
            )}
        </div>
    );
}

export default definePlugin({
    name: "SharePerms",
    description: "Multi-user permission sharing with interactive UI. ⚠️ Lets authorized users run moderation actions through your account — high abuse risk, use only with fully trusted people.",
    authors: [{ name: "Nightcord", id: 0n }],
    settings,
    settingsAboutComponent: AboutWarning,

    start() {
        FluxDispatcher.subscribe("MESSAGE_CREATE", this.onMessage);
        addHeaderBarButton("shareperms-manager", () => <SharePermsButton />, 6);
    },

    stop() {
        FluxDispatcher.unsubscribe("MESSAGE_CREATE", this.onMessage);
        removeHeaderBarButton("shareperms-manager");
    },

    onMessage: async ({ message }: any) => {
        if (!message?.content) return;

        const users = getSharedUsers();
        const configIndex = users.findIndex(u => u.id === message.author.id);
        if (configIndex === -1) return;

        const config = users[configIndex];
        const duration = parseDuration(config.validUntil);
        if (duration !== 0 && Date.now() > config.startTime + duration) return;

        const channel = ChannelStore.getChannel(message.channel_id);
        const isDM = channel?.type === 1;
        const isTargetGuild = channel?.guild_id === config.guildId;
        if (!isDM && !isTargetGuild) return;

        const { prefix } = config;
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift()?.toLowerCase();
        if (!command) return;

        if (config.maxUses > 0) {
            const currentUses = config.usesMap?.[command] || 0;
            if (currentUses >= config.maxUses) {
                sendBotMessage(message.channel_id, { content: `❌ Error: You have reached your limit of ${config.maxUses} uses for \`${command}\`.` });
                return;
            }
        }

        const { guildId } = config;
        const permsList = config.permissions.split(",");
        const hasAll = permsList.includes("all");
        const channelId = message.channel_id;

        let success = false;
        let targetId = "";

        try {
            if (command === "tempmute" || command === "timeout") {
                if (!hasAll && !permsList.includes("timeout")) return;
                targetId = resolveId(args[0]);
                const durationStr = args[1] || "10m";
                const d = parseDuration(durationStr);
                const until = new Date(Date.now() + d).toISOString();
                await RestAPI.patch({ url: `/guilds/${guildId}/members/${targetId}`, body: { communication_disabled_until: until } });
                sendBotMessage(channelId, { content: `✅ <@${targetId}> timed out until ${new Date(until).toLocaleString()}.` });
                success = true;
            }
            else if (command === "kick") {
                if (!hasAll && !permsList.includes("kick")) return;
                targetId = resolveId(args[0]);
                await RestAPI.del({ url: `/guilds/${guildId}/members/${targetId}`, reason: args.slice(1).join(" ") || "." } as any);
                sendBotMessage(channelId, { content: `✅ <@${targetId}> kicked.` });
                success = true;
            }
            else if (command === "ban") {
                if (!hasAll && !permsList.includes("ban")) return;
                targetId = resolveId(args[0]);
                await RestAPI.put({ url: `/guilds/${guildId}/bans/${targetId}`, body: { delete_message_seconds: 0, reason: args.slice(1).join(" ") || "." } } as any);
                sendBotMessage(channelId, { content: `✅ <@${targetId}> banned.` });
                success = true;
            }
            else if (command === "unmute") {
                if (!hasAll && !permsList.includes("mute_voice")) return;
                targetId = resolveId(args[0]);
                await VoiceActions.setServerMute(guildId, targetId, false);
                sendBotMessage(channelId, { content: `✅ <@${targetId}> voice unmuted.` });
                success = true;
            }
            else if (command === "untimeout") {
                if (!hasAll && !permsList.includes("timeout")) return;
                targetId = resolveId(args[0]);
                await RestAPI.patch({ url: `/guilds/${guildId}/members/${targetId}`, body: { communication_disabled_until: null } });
                sendBotMessage(channelId, { content: `✅ Timeout removed from <@${targetId}>.` });
                success = true;
            }
            else if (command === "unban") {
                if (!hasAll && !permsList.includes("ban")) return;
                targetId = resolveId(args[0]);
                await RestAPI.del({ url: `/guilds/${guildId}/bans/${targetId}` } as any);
                sendBotMessage(channelId, { content: `✅ <@${targetId}> unbanned.` });
                success = true;
            }
            else if (command === "rename") {
                if (!hasAll && !permsList.includes("rename_user")) return;
                targetId = resolveId(args[0]);
                const newName = args.slice(1).join(" ");
                try {
                    await RestAPI.patch({ url: `/guilds/${guildId}/members/${targetId}`, body: { nick: newName } });
                    sendBotMessage(channelId, { content: `✅ <@${targetId}> renamed to ${newName}.` });
                    success = true;
                } catch {
                    await GuildMemberActions.setNickname(guildId, targetId, newName, "SharePerms");
                    sendBotMessage(channelId, { content: `✅ <@${targetId}> renamed to ${newName}.` });
                    success = true;
                }
            }
            else if (command === "addrole") {
                if (!hasAll && !permsList.includes("add_role")) return;
                targetId = resolveId(args[0]);
                const roleId = resolveId(args[1]);
                const MemberStore = findByPropsLazy("getMember");
                const member = MemberStore.getMember(guildId, targetId);
                const roles = new Set([...(member?.roles || []), roleId]);
                await MemberRoleActions.updateMemberRoles(guildId, targetId, Array.from(roles));
                sendBotMessage(channelId, { content: `✅ Role <@&${roleId}>{t("أُضيف إلى", "added to")}<@${targetId}>.` });
                success = true;
            }
            else if (command === "mute") {
                if (!hasAll && !permsList.includes("mute_voice")) return;
                targetId = resolveId(args[0]);
                await VoiceActions.setServerMute(guildId, targetId, true);
                sendBotMessage(channelId, { content: `✅ <@${targetId}> voice muted.` });
                success = true;
            }
            else if (command === "disconnect") {
                if (!hasAll && !permsList.includes("disconnect_voice")) return;
                targetId = resolveId(args[0]);
                await VoiceActions.setChannel(guildId, targetId, null);
                sendBotMessage(channelId, { content: `✅ <@${targetId}> disconnected from voice.` });
                success = true;
            }
            else if (command === "move") {
                if (!hasAll && !permsList.includes("move_voice")) return;
                targetId = resolveId(args[0]);
                const authorVoiceState = VoiceStateStore.getVoiceState(guildId, message.author.id);
                const destChannelId = authorVoiceState?.channelId;
                if (!destChannelId) {
                    sendBotMessage(channelId, { content: "❌ Error: You must be in a voice channel to move someone." });
                    return;
                }
                await VoiceActions.setChannel(guildId, targetId, destChannelId);
                sendBotMessage(channelId, { content: `✅ <@${targetId}>{t("نُقل إلى", "moved to")}<#${destChannelId}>.` });
                success = true;
            }

            if (success) {
                if (!config.usesMap) config.usesMap = {};
                config.usesMap[command] = (config.usesMap[command] || 0) + 1;
                config.uses++;
                users[configIndex] = config;
                saveSharedUsers(users);
                saveLog({ userId: message.author.id, command, targetId, timestamp: Date.now(), success: true });
            }
        } catch (e: any) {
            console.error("[SharePerms] Command error:", e);
            const errorMsg = e.body?.message || e.message || JSON.stringify(e);
            sendBotMessage(channelId, { content: `❌ Error: ${errorMsg}` });
            saveLog({ userId: message.author.id, command: command || "unknown", targetId: targetId || "unknown", timestamp: Date.now(), success: false });
        }
    },

    headerBarButtons: []
});
