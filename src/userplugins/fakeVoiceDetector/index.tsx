/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { get as dsGet, set as dsSet } from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { isArabicMode, t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { Button, React, SelectedChannelStore, Toasts, useEffect, UserStore, useState, VoiceStateStore } from "@webpack/common";

// SHA-256 hex of the owner's secret. Only the hash lives in the source; the plaintext is known
// only to the owner, so nobody else can arm the detector from the settings UI.
const EXPECTED_HASH = "c7db3f20b3f8c4c2f4067677111d906e416a0d954b456ce58da3a1b6040aa946";

const LOG_KEY = "FakeVoiceDetector_log";
const LOG_CAP = 200;
const RELOG_MS = 10_000; // لا نُكرّر تسجيل نفس الشخص خلال 10ث (نتفادى الوميض)

let armed = false;

type Reason = "impossible" | "spoke";

// ── العلامة الحيّة: من يزيّف الآن في قناتي فقط. تختفي فور إغلاقه الفيك ديفن أو مغادرته. ──
interface Live { reason: Reason; since: number; }
const live = new Map<string, Live>();
const toasted = new Set<string>();

// ── السجلّ الدائم: كل من ضُبط يستخدم الفيك ديفن (يبقى محفوظاً عبر إعادة التشغيل). ──
interface LogEntry { userId: string; name: string; reason: Reason; at: number; }
let log: LogEntry[] = [];
const lastLogged = new Map<string, number>();

async function sha256hex(input: string) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyPassword(pw: string) {
    armed = !!pw && (await sha256hex(pw)) === EXPECTED_HASH;
    return armed;
}

function userName(userId: string) {
    return UserStore.getUser(userId)?.username ?? userId;
}

function reasonText(reason: Reason, name: string) {
    return reason === "impossible"
        ? t(`⚠️ ${name}: مُصمّ لكن غير مكتوم — حالة مستحيلة طبيعياً (تزييف مؤكَّد)`, `⚠️ ${name}: deafened but NOT muted — impossible normally (confirmed fake)`)
        : t(`⚠️ ${name}: يتكلّم وهو ظاهرٌ مُصمّ (Fake Deafen)`, `⚠️ ${name}: talking while appearing deafened (Fake Deafen)`);
}

function toast(message: string) {
    Toasts.show({
        id: Toasts.genId(),
        message,
        type: Toasts.Type.FAILURE,
        options: { position: Toasts.Position.BOTTOM, duration: 6000 }
    });
}

function addLog(userId: string, reason: Reason) {
    const now = Date.now();
    if (now - (lastLogged.get(userId) ?? 0) < RELOG_MS) return; // تفادي الوميض
    lastLogged.set(userId, now);
    log.unshift({ userId, name: userName(userId), reason, at: now });
    if (log.length > LOG_CAP) log.length = LOG_CAP;
    dsSet(LOG_KEY, log).catch(() => { /* تخزين غير متاح — السجلّ يبقى في الذاكرة */ });
}

// يرفع علامة حيّة على مستخدم. الحالة المستحيلة تَغلِب «تكلّم» (دليل أقوى). التسجيل يحدث
// مرّة عند أوّل رصد (الانتقال إلى مزيّف) لا عند كل تحديث.
function markLive(userId: string, reason: Reason) {
    const existing = live.get(userId);
    if (existing && (existing.reason === reason || existing.reason === "impossible")) return;

    const isNew = !existing;
    live.set(userId, { reason, since: Date.now() });
    console.warn("[FakeVoiceDetector]", reasonText(reason, userName(userId)));

    if (isNew) {
        addLog(userId, reason);
        if (!toasted.has(userId)) { toasted.add(userId); toast(reasonText(reason, userName(userId))); }
    }
    renderPanel();
}

function removeLive(userId: string) {
    if (live.delete(userId)) { toasted.delete(userId); renderPanel(); }
}

function clearLive() {
    if (live.size === 0) return;
    live.clear();
    toasted.clear();
    renderPanel();
}

// يُطابق العلامة الحيّة مع الحالة الحاليّة لقناتي: يضيف الحالة المستحيلة فوراً، ويُزيل من
// أغلق الفيك ديفن (لم يعد يظهر مُصمّاً) أو غادر — فالعلامة لحظيّة لا دائمة.
function evaluateChannel() {
    if (!armed) { clearLive(); return; }
    const myChannel = SelectedChannelStore.getVoiceChannelId();
    if (!myChannel) { clearLive(); return; }

    const states = VoiceStateStore.getVoiceStatesForChannel(myChannel) as Record<string, { selfDeaf: boolean; selfMute: boolean; }>;
    const myId = UserStore.getCurrentUser()?.id;
    const present = new Set<string>();

    for (const userId in states) {
        if (userId === myId) continue;
        present.add(userId);
        const vs = states[userId];
        if (vs.selfDeaf && !vs.selfMute) markLive(userId, "impossible"); // مستحيل ⇒ تزييف مؤكَّد فوراً
        else if (!vs.selfDeaf) removeLive(userId);                       // لم يعد مُصمّاً ⇒ أغلق الفيك ديفن
    }
    for (const id of [...live.keys()]) if (!present.has(id)) removeLive(id); // غادر قناتي
}

// ── العلامة الحمراء الحيّة: لوحة عائمة صغيرة (DOM خالص — أمتن من ترقيع واجهة الصوت) ──
let panel: HTMLElement | null = null;

function ensurePanel() {
    if (panel || typeof document === "undefined" || !document.body) return;
    panel = document.createElement("div");
    panel.className = "fvd-panel";
    panel.setAttribute("dir", isArabicMode() ? "rtl" : "ltr");
    document.body.appendChild(panel);
}

function removePanel() {
    panel?.remove();
    panel = null;
}

function renderPanel() {
    if (live.size === 0) { removePanel(); return; }
    ensurePanel();
    if (!panel) return;

    panel.textContent = "";
    const title = document.createElement("div");
    title.className = "fvd-title";
    title.textContent = t(`🔴 تزييف تصامّ الآن (${live.size})`, `🔴 Faking now (${live.size})`);
    panel.appendChild(title);

    for (const [userId, f] of live) {
        const row = document.createElement("div");
        row.className = "fvd-row";

        const dot = document.createElement("span");
        dot.className = "fvd-dot";
        row.appendChild(dot);

        const name = document.createElement("span");
        name.className = "fvd-name";
        name.textContent = userName(userId); // textContent — لا حقن HTML من الأسماء
        row.appendChild(name);

        const tag = document.createElement("span");
        tag.className = "fvd-tag";
        tag.textContent = f.reason === "impossible" ? t("مؤكَّد", "confirmed") : t("تكلّم", "spoke");
        row.appendChild(tag);

        panel.appendChild(row);
    }
}

// ── عارض السجلّ الدائم (داخل إعدادات الإضافة) ────────────────────────────────
function LogView() {
    const [entries, setEntries] = useState<LogEntry[]>(log);
    const dir = isArabicMode() ? "rtl" : "ltr";

    useEffect(() => {
        dsGet<LogEntry[]>(LOG_KEY).then(e => { if (Array.isArray(e)) { log = e; setEntries(e); } }).catch(() => { /* لا سجلّ بعد */ });
    }, []);

    function clearLog() {
        log = [];
        lastLogged.clear();
        setEntries([]);
        dsSet(LOG_KEY, []).catch(() => { /* تجاهل */ });
    }

    return (
        <div className="fvd-log" dir={dir}>
            <div className="fvd-log-head">
                <span className="fvd-log-title">{t(`📋 سجلّ من استخدم الفيك ديفن (${entries.length})`, `📋 Fake-Deafen log (${entries.length})`)}</span>
                {entries.length > 0 && (
                    <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={clearLog}>
                        {t("مسح السجلّ", "Clear log")}
                    </Button>
                )}
            </div>
            {entries.length === 0 ? (
                <div className="fvd-log-empty">{t("لا سجلّات بعد.", "No entries yet.")}</div>
            ) : (
                <div className="fvd-log-list">
                    {entries.map((e, i) => (
                        <div key={i} className="fvd-log-row">
                            <span className="fvd-log-name">{e.name}</span>
                            <span className="fvd-log-reason">{e.reason === "impossible" ? t("مؤكَّد", "confirmed") : t("تكلّم", "spoke")}</span>
                            <span className="fvd-log-time">{new Date(e.at).toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const settings = definePluginSettings({
    password: {
        type: OptionType.STRING,
        description: "The secret that arms the detector. Nothing runs until it matches.",
        default: "",
        onChange: async (value: string) => {
            const ok = await verifyPassword(value);
            toast(ok ? t("🔓 تم تفعيل الكاشف", "🔓 Detector armed") : t("🔒 كلمة سر غير صحيحة — الكاشف متوقف", "🔒 Wrong password. Detector stays off"));
            if (ok) evaluateChannel(); else clearLive();
        }
    },
    viewLog: {
        type: OptionType.COMPONENT,
        component: LogView
    }
});

export default definePlugin({
    name: "FakeVoiceDetector",
    description: "Instantly detect who is using Fake Deafen in your voice channel — flags the impossible \"deafened-but-not-muted\" state on entry (no speech needed) and anyone audible while appearing deafened. The red marker is live (clears the moment they turn Fake Deafen off) and every detection is kept in a persistent log. Locked behind a secret.",
    authors: [EquicordDevs.LOSTSTR],
    settings,

    flux: {
        // كشف فوري لأول صوت: مايك المزيّف مفتوح، فأول نَفَس/نقرة تكشفه بلا تأخير.
        SPEAKING({ userId, speakingFlags }: { userId: string; speakingFlags: number; }) {
            if (!armed || !speakingFlags) return;
            if (userId === UserStore.getCurrentUser()?.id) return;
            const myChannel = SelectedChannelStore.getVoiceChannelId();
            if (!myChannel) return;
            const vs = VoiceStateStore.getVoiceStateForUser(userId);
            if (vs?.channelId === myChannel && vs.selfDeaf) markLive(userId, "spoke");
        },

        // كشف/تنظيف فوري بلا كلام: أي تغيّر حالة صوت في قناتي يُعيد المطابقة (يرصد الحالة
        // المستحيلة لحظة الدخول/التبديل، ويُزيل العلامة لحظة إغلاق الفيك ديفن أو المغادرة).
        VOICE_STATE_UPDATES() {
            evaluateChannel();
        }
    },

    async start() {
        try { const e = await dsGet<LogEntry[]>(LOG_KEY); if (Array.isArray(e)) log = e; } catch { /* لا سجلّ */ }
        await verifyPassword(settings.store.password);
        evaluateChannel(); // يمسك من كان يزيّف قبل تشغيل الإضافة/أثناء وجودي في القناة
    },

    stop() {
        armed = false;
        clearLive();
        removePanel();
    }
});
