/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import * as DataStore from "@api/DataStore";
import { HeaderBarButton } from "@api/HeaderBar";
import { showNotification } from "@api/Notifications";
import { popNotice, showNotice } from "@api/Notices";
import { getUserSettingLazy } from "@api/UserSettings";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import { Logger } from "@utils/Logger";
import { useForceUpdater } from "@utils/react";
import definePlugin, { PluginNative } from "@utils/types";
import { React, useEffect } from "@webpack/common";

import { settings } from "./settings";

const logger = new Logger("PerformanceBoost");

const Native = IS_DISCORD_DESKTOP
    ? (VencordNative.pluginHelpers.PerformanceBoost as PluginNative<typeof import("./native")>)
    : null;

let active = false;
let ready = false; // يصبح true عند CONNECTION_OPEN (أو مهلة احتياطية) — لتجاهل بلاغ الألعاب عند الإقلاع
let readyFallbackTimer: ReturnType<typeof setTimeout> | null = null; // مهلة احتياطية إن لم يصل CONNECTION_OPEN
let manualOff = false; // المستخدم أوقفه يدوياً ⇒ يطغى على الكشف التلقائي حتى يُفعّله بنفسه
let notifiedManualOff = false; // أُعلِم المستخدم مرة واحدة فقط أن التفعيل التلقائي مُعطَّل بسبب الإيقاف اليدوي
const HW_ACK_KEY = "PerformanceBoost_hwRestartAcknowledged";
const MANUAL_OFF_KEY = "PerformanceBoost_manualOff"; // يُحفَظ علَم الإيقاف اليدوي عبر إعادة التشغيل
const buttonUpdaters = new Set<() => void>();
const refreshButtons = () => buttonUpdaters.forEach(u => u());

// يفتح الكشف الحيّ عن الألعاب (idempotent): يُستدعى من CONNECTION_OPEN أو من المهلة الاحتياطية.
function markReady() {
    if (ready) return;
    ready = true;
    if (readyFallbackTimer !== null) {
        clearTimeout(readyFallbackTimer);
        readyFallbackTimer = null;
    }
}

// مفاتيح DataStore لحفظ القيم الأصلية
const ORIG_COMPACT_KEY = "PerformanceBoost_originalCompact";
const ORIG_GIF_KEY = "PerformanceBoost_originalGif";

const NOTICE_COLORS = { success: "#3ba55c", warning: "#faa81a", error: "#ed4245", info: "#5865f2" } as const;
function notice(message: string, type: keyof typeof NOTICE_COLORS) {
    showNotification({ title: "PerformanceBoost", body: message, color: NOTICE_COLORS[type], noPersist: true });
}

function applyCss() {
    const root = document.documentElement;
    root.classList.toggle("vc-perfboost-no-anim", settings.store.disableAnimations);
    root.classList.toggle("vc-perfboost-hide-activities", settings.store.hideActivities);
}
function removeCss() {
    document.documentElement.classList.remove("vc-perfboost-no-anim", "vc-perfboost-hide-activities");
}

// ── تطبيق واستعادة الإعدادات التلقائية (Compact + GIF) ──
async function applyUserSettings() {
    try {
        const compactSetting = getUserSettingLazy("textAndImages", "messageDisplayCompact");
        if (compactSetting?.updateSetting && typeof compactSetting.getSetting === "function") {
            const original = compactSetting.getSetting();
            if (original !== undefined && (await DataStore.get(ORIG_COMPACT_KEY)) === undefined) {
                await DataStore.set(ORIG_COMPACT_KEY, original);
            }
            if (settings.store.compactMode) compactSetting.updateSetting(true);
        }
    } catch (e) { logger.warn("Failed to set compact mode", e); }

    try {
        const gifSetting = getUserSettingLazy("textAndImages", "gifAutoPlay");
        if (gifSetting?.updateSetting && typeof gifSetting.getSetting === "function") {
            const original = gifSetting.getSetting();
            if (original !== undefined && (await DataStore.get(ORIG_GIF_KEY)) === undefined) {
                await DataStore.set(ORIG_GIF_KEY, original);
            }
            if (settings.store.disableGifAutoplay) gifSetting.updateSetting(false);
        }
    } catch (e) { logger.warn("Failed to set GIF autoplay", e); }
}

async function revertUserSettings() {
    try {
        const originalCompact = await DataStore.get<boolean>(ORIG_COMPACT_KEY);
        if (originalCompact !== undefined) {
            const compactSetting = getUserSettingLazy("textAndImages", "messageDisplayCompact");
            if (compactSetting?.updateSetting) await compactSetting.updateSetting(originalCompact);
            await DataStore.del(ORIG_COMPACT_KEY);
        }
    } catch (e) { logger.warn("Failed to revert compact mode", e); }

    try {
        const originalGif = await DataStore.get<boolean>(ORIG_GIF_KEY);
        if (originalGif !== undefined) {
            const gifSetting = getUserSettingLazy("textAndImages", "gifAutoPlay");
            if (gifSetting?.updateSetting) await gifSetting.updateSetting(originalGif);
            await DataStore.del(ORIG_GIF_KEY);
        }
    } catch (e) { logger.warn("Failed to revert GIF autoplay", e); }
}

// ── أولوية العمليات والكاش ──
async function setPriority(level: "belowNormal" | "normal") {
    if (!Native) { notice(t("تغيير الأولوية يتطلب نسخة سطح المكتب.", "Changing priority requires the desktop app."), "warning"); return; }
    try {
        const res = await Native.setProcessPriority(level);
        if (res.ok && level === "belowNormal") notice(t(`تم خفض أولوية ${res.changed} عملية`, `Lowered priority for ${res.changed} process(es)`), "success");
        else if (!res.ok) notice(t("تغيير الأولوية غير متاح: " + res.reason, "Priority change unavailable: " + res.reason), "warning");
    } catch (e) { logger.error("setPriority failed", e); }
}

async function cleanCache() {
    if (!Native) { notice(t("تنظيف الكاش يتطلب نسخة سطح المكتب.", "Cache cleaning requires the desktop app."), "warning"); return; }
    try {
        const res = await Native.cleanCache();
        notice(res.ok ? t(`تم تنظيف الكاش (${res.cleared}).`, `Cache cleaned (${res.cleared}).`) : t("تعذّر تنظيف الكاش", "Could not clean cache"), res.ok ? "success" : "warning");
    } catch (e) { logger.error("cleanCache failed", e); }
}

// ── إعادة التشغيل لتسريع العتاد (مرة واحدة فقط) ──
let restarting = false;
async function doRestart() {
    if (restarting) return;
    restarting = true;
    notice(t("جاري إعادة التشغيل...", "Restarting..."), "success");
    popNotice();
    try {
        if (!Native) { location.reload(); return; }
        await Native.relaunchApp();
    } catch (e) {
        logger.error("restart failed", e);
        restarting = false;
        location.reload();
    }
}

async function promptHardwareRestart() {
    if (await DataStore.get(HW_ACK_KEY)) return;
    await DataStore.set(HW_ACK_KEY, true);
    showNotice(
        t("لتطبيق تعطيل تسريع العتاد: عطّله يدوياً من إعدادات Discord ← متقدّم، ثم أعد التشغيل.", "To disable hardware acceleration: turn it off manually in Discord Settings → Advanced, then restart."),
        t("أعد التشغيل الآن", "Restart now"),
        doRestart
    );
}

// ── التفعيل والإيقاف (كل شيء تلقائي) ──
async function applyMode() {
    if (active) return;
    active = true;
    notifiedManualOff = false; // أُعيد التفعيل ⇒ نسمح بإعلامٍ جديد لاحقاً إن أُوقف يدوياً مرة أخرى
    applyCss();
    await applyUserSettings();
    if (settings.store.changeProcessPriority) await setPriority("belowNormal");
    if (settings.store.cleanCacheOnStart) await cleanCache();
    if (settings.store.reduceHardwareAcceleration) await promptHardwareRestart();
    refreshButtons();
    notice(t("تم تفعيل وضع الأداء ⚡", "Performance mode enabled ⚡"), "success");
}

async function revertMode() {
    if (!active) return;
    active = false;
    removeCss();
    await revertUserSettings();
    if (settings.store.changeProcessPriority) await setPriority("normal");
    refreshButtons();
    notice(t("تم إيقاف وضع الأداء", "Performance mode disabled"), "success");
}

function toggle() {
    if (active) {
        revertMode();
        manualOff = true;  // إيقاف يدوي ⇒ يطغى على الكشف التلقائي حتى تُفعّله بنفسك
    } else {
        applyMode();
        manualOff = false; // تفعيل يدوي ⇒ يُمحى العلَم ويستأنف الكشف التلقائي بعدها
    }
    settings.store.gameMode = active;
    DataStore.set(MANUAL_OFF_KEY, manualOff);
}

// ── أيقونة البرق (تتغير ألوانها) ──
function BoltIcon({ active: isActive }: { active: boolean; }) {
    const color = isActive ? "#3ba55c" : "#ed4245"; // أخضر عند التفعيل، أحمر عند الإيقاف
    return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1">
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
        </svg>
    );
}

function PerfHeaderButton() {
    const forceUpdate = useForceUpdater();
    useEffect(() => {
        buttonUpdaters.add(forceUpdate);
        return () => void buttonUpdaters.delete(forceUpdate);
    }, []);
    return (
        <HeaderBarButton
            icon={() => <BoltIcon active={active} />}
            tooltip={active ? t("إيقاف وضع الأداء", "Disable performance mode") : t("تفعيل وضع الأداء", "Enable performance mode")}
            onClick={toggle}
        />
    );
}

export default definePlugin({
    name: "PerformanceBoost",
    description: "Game/performance mode: automatically reduces animations, compacts messages, stops GIFs, lowers process priority, and cleans cache — all revertible. (Hardware acceleration requires one-time manual toggle + restart.)",
    authors: [EquicordDevs.LOSTSTR],
    tags: ["Utility"],
    dependencies: ["HeaderBarAPI"],
    settings,
    headerBarButton: { icon: () => <BoltIcon active={active} />, render: PerfHeaderButton },
    flux: {
        CONNECTION_OPEN() {
            // اكتمل الاتصال ⇒ نفتح الكشف الحيّ عن الألعاب (نكون قد تجاوزنا دفعة بلاغات الإقلاع).
            markReady();
        },
        RUNNING_GAMES_CHANGE({ games }: { games: { id: string; }[]; }) {
            // !ready ⇒ نتجاهل بلاغ الألعاب عند الإقلاع.
            if (!settings.store.autoDetectGames || !ready) return;

            // manualOff ⇒ المستخدم أوقفه يدوياً فنحترم قراره ولا نُعيد التفعيل، لكن نُعلمه مرة واحدة.
            if (manualOff) {
                if (games?.length && !notifiedManualOff) {
                    notice(t("تم تعطيل التفعيل التلقائي لأنك أوقفت وضع الأداء يدوياً. أعد تفعيله من الزر أو الإعدادات.", "Auto-enable is disabled because you turned off Performance mode manually. Re-enable it from the button or settings."), "info");
                    notifiedManualOff = true;
                }
                return;
            }

            if (games?.length) { if (!active) applyMode(); }
            else if (active) revertMode();
        }
    },
    async start() {
        // نحترم اختيار المستخدم: نُحمِّل علَم الإيقاف اليدوي، ونستعيد حالته اليدوية المحفوظة فقط (gameMode)،
        // ولا نُفعّل تلقائياً من كشف الألعاب عند الإقلاع. الكشف الحيّ يبقى عبر RUNNING_GAMES_CHANGE أثناء الجلسة.
        manualOff = (await DataStore.get<boolean>(MANUAL_OFF_KEY)) ?? false;
        if (settings.store.gameMode) await applyMode();
        else await revertUserSettings(); // مُعطَّل يبقى مُعطَّلاً + تنظيف أي إعداد عالق من جلسة سابقة
        // نفتح الكشف الحيّ عند CONNECTION_OPEN (انظر flux أعلاه)، مع مهلة احتياطية 15ث إن لم يصل الحدث —
        // فلا يُفعَّل الوضع تلقائياً عند فتح Discord ولعبة شغّالة.
        readyFallbackTimer = setTimeout(markReady, 15000);
    },
    stop() {
        revertMode();
        // ننظّف المهلة الاحتياطية ونُعيد ضبط الحالة لإعادة تفعيل نظيفة لاحقاً.
        if (readyFallbackTimer !== null) {
            clearTimeout(readyFallbackTimer);
            readyFallbackTimer = null;
        }
        ready = false;
        notifiedManualOff = false;
    }
});
