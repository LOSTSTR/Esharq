/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { Devs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { Alerts, SettingsRouter } from "@webpack/common";

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

        // The release title carries a SHORT hash (e.g. "Esharq 6153823") while ~git-hash
        // is the full commit sha. A bare `===` therefore never matches and fires a spurious
        // "update available" on the very build we're already running. Compare as a prefix so
        // the current build is recognised as up-to-date.
        if (!remoteHash || gitHash.startsWith(remoteHash)) return;

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
            onConfirm: openUpdaterTab
        });
    } catch (e) {
        logger.error("فشل فحص التحديثات:", e);
    }
}

// "تحديث الآن" يفتح قسم "مُحدِّث اشراق" داخل الإعدادات (لا يفتح المتصفّح) حيث يُطبّق المستخدم
// التحديث بنفسه عبر المحدّث المدمج. يرجع لصفحة الإصدارات فقط إن كان المحدّث معطّلاً أو على الويب.
function openUpdaterTab() {
    if (IS_WEB || IS_UPDATER_DISABLED) {
        VencordNative.native.openExternal(RELEASES_PAGE);
        return;
    }
    SettingsRouter.openUserSettings("equicord_updater_panel");
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
