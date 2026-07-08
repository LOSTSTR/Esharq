/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { Devs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import { Logger } from "@utils/Logger";
import { relaunch } from "@utils/native";
import definePlugin from "@utils/types";
import { checkForUpdates, update } from "@utils/updater";
import { Alerts } from "@webpack/common";

import gitHash from "~git-hash";

const logger = new Logger("ArabicAutoUpdater");
const REPO = "LOSTSTR/Esharq";
const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const SEEN_KEY = "esharq-last-seen-update";

let checked = false;

async function checkForUpdate() {
    if (checked) return;
    checked = true;

    try {
        const res = await fetch(API_URL, {
            headers: { Accept: "application/vnd.github+json" }
        });
        if (!res.ok) return;

        const data = await res.json();
        // The release tag is static (v1.0.0-stable); the real commit hash lives in
        // the release title "Esharq <hash>" — same source the in-client updater reads.
        const releaseName: string = data.name ?? "";
        const remoteHash = releaseName.slice(releaseName.lastIndexOf(" ") + 1);

        if (!remoteHash || remoteHash === gitHash) return;

        // Migrate any old localStorage value to DataStore on first run. Discord removes
        // window.localStorage in the renderer (anti-token-theft), so a bare reference throws
        // ReferenceError — guard with typeof so the update check never fails because of it.
        if (typeof localStorage !== "undefined") {
            const legacyValue = localStorage.getItem(SEEN_KEY);
            if (legacyValue) {
                await DataStore.set(SEEN_KEY, legacyValue);
                localStorage.removeItem(SEEN_KEY);
            }
        }

        const lastSeen = await DataStore.get<string>(SEEN_KEY);
        if (lastSeen === remoteHash) return;

        await DataStore.set(SEEN_KEY, remoteHash);

        Alerts.show({
            title: t("تحديث جديد متاح!", "New update available!"),
            body: (
                <>
                    <p>{t("يتوفر إصدار جديد من", "A new version of")} <strong>{t("اشراق", "Esharq")}</strong>{t(" متاح.", " is available.")}</p>
                    <p>{t("الإصدار الحالي:", "Current version:")} <code>{gitHash.slice(0, 7)}</code></p>
                    <p>{t("الإصدار الجديد:", "New version:")} <code>{remoteHash}</code></p>
                    <p>{t("هل تريد التحديث الآن؟", "Do you want to update now?")}</p>
                </>
            ),
            confirmText: t("تحديث الآن", "Update now"),
            cancelText: t("لاحقاً", "Later"),
            onConfirm: applyUpdateInClient
        });
    } catch (e) {
        logger.error("فشل فحص التحديثات:", e);
    }
}

// الخيار A: يُطبّق التحديث داخل التطبيق مباشرةً عبر المحدّث المدمج (ينزّل + يبني الإصدار الجديد)
// ثم يعرض إعادة التشغيل — بدل فتح المتصفّح للتنزيل اليدوي. عند أي تعذّر (محدّث معطّل / فشل
// البناء / غير مرصود) يرجع بأمان إلى فتح صفحة الإصدارات.
async function applyUpdateInClient() {
    if (IS_WEB || IS_UPDATER_DISABLED) {
        VencordNative.native.openExternal(RELEASES_PAGE);
        return;
    }
    try {
        const outdated = await checkForUpdates();
        if (!outdated) {
            VencordNative.native.openExternal(RELEASES_PAGE);
            return;
        }
        await update();
        Alerts.show({
            title: t("اكتمل التحديث ✅", "Update complete ✅"),
            body: <p>{t("طُبِّق التحديث بنجاح. أعد تشغيل ديسكورد لتفعيله.", "The update was applied. Restart Discord to activate it.")}</p>,
            confirmText: t("إعادة التشغيل الآن", "Restart now"),
            cancelText: t("لاحقاً", "Later"),
            onConfirm: () => relaunch()
        });
    } catch (e) {
        logger.error("in-client update failed:", e);
        Alerts.show({
            title: t("تعذّر التحديث التلقائي", "Auto-update failed"),
            body: <p>{t("سنفتح صفحة الإصدارات لتنزيله يدوياً.", "Opening the releases page for a manual download instead.")}</p>,
            confirmText: t("فتح صفحة الإصدارات", "Open releases page"),
            onConfirm: () => VencordNative.native.openExternal(RELEASES_PAGE)
        });
    }
}

export default definePlugin({
    name: "ArabicAutoUpdater",
    description: "Automatically checks for Esharq updates and notifies you when a new version is available",
    authors: [Devs.thororen],
    tags: ["Utility"],

    flux: {
        async CONNECTION_OPEN() {
            await checkForUpdate();
        }
    }
});
