/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { showNotification } from "@api/Notifications";
import { PlainSettings, Settings } from "@api/Settings";
import { localStorage } from "@utils/localStorage";
import { Logger } from "@utils/Logger";
import { relaunch } from "@utils/native";
import { SettingsRouter } from "@webpack/common";
import { deflateSync, inflateSync } from "fflate";

import { deauthorizeCloud, getCloudAuth, getCloudUrl } from "./cloudSetup";
import { exportSettings, importSettings } from "./offline";
import { ManifestEntry, SyncRequest, SyncResponse } from "./types";

const logger = new Logger("SettingsSync:Cloud", "#39b7e0");

const MANIFEST_STORE_KEY = "Vencord_cloudManifest";
const API_VERSION_STORE_KEY = "Vencord_cloudApiVersions";

type ApiVersion = "v2" | "v1";

const SYNC_DIRECTION_KEY = "Vencord_cloudSyncDirection";
const SETTINGS_DIRTY_KEY = "Vencord_settingsDirty";
export const getCloudSyncDirection = () => localStorage.getItem(SYNC_DIRECTION_KEY) || "both";
export const setCloudSyncDirection = (direction: "push" | "pull" | "both" | "manual") => localStorage.setItem(SYNC_DIRECTION_KEY, direction);
export const areLocalSettingsDirty = () => localStorage.getItem(SETTINGS_DIRTY_KEY) === "true";
export const markLocalSettingsDirty = () => localStorage.setItem(SETTINGS_DIRTY_KEY, "true");
export const markLocalSettingsClean = () => localStorage.removeItem(SETTINGS_DIRTY_KEY);

async function loadApiVersionMap(): Promise<Record<string, ApiVersion>> {
    return await DataStore.get<Record<string, ApiVersion>>(API_VERSION_STORE_KEY) ?? {};
}

async function getApiVersion(): Promise<ApiVersion> {
    const map = await loadApiVersionMap();
    return map[getCloudUrl().origin] ?? "v2";
}

async function setApiVersion(version: ApiVersion) {
    await DataStore.update<Record<string, ApiVersion>>(API_VERSION_STORE_KEY, map => {
        map ??= {};
        map[getCloudUrl().origin] = version;
        return map;
    });
}

function toBase64(data: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < data.length; i++)
        binary += String.fromCharCode(data[i]);
    return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++)
        bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function computeChecksum(data: Uint8Array): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(data));
    const bytes = new Uint8Array(hash, 0, 8);
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

async function getLocalManifest(): Promise<ManifestEntry[]> {
    return await DataStore.get<ManifestEntry[]>(MANIFEST_STORE_KEY) ?? [];
}

async function saveLocalManifest(manifest: ManifestEntry[]) {
    await DataStore.set(MANIFEST_STORE_KEY, manifest);
}

/**
 * مفاتيح دفتر المزامنة نفسه — **لا تُسافر أبداً**.
 *
 * 🔴 البيان المحلّي (`Vencord_cloudManifest`) يسكن نفس متجر `DataStore` الذي
 * نرفعه كاملاً. فكان جهاز «أ» يرفع بيانه ضمن الحمولة، وجهاز «ب» يكتبه فوق
 * بيانه هو. وبيان «أ» يقول إنّ نسخة السحابة من QuickCSS مُطبَّقة — فإن كان
 * تطبيقها عند «ب» قد فشل، صار «ب» يزعم التطابق فلا يُعاد تنزيلها **أبداً**.
 * وهذا بعينه ما أُضيف `SyncApplyError` لمنعه.
 *
 * وكذلك `Vencord_cloudApiVersions`: نسخةٌ قادمة من جهازٍ آخر تُحوّل هذا
 * الجهاز إلى مسار واجهةٍ أقدم بلا سبب.
 */
const SYNC_BOOKKEEPING_KEYS: ReadonlySet<string> = new Set([MANIFEST_STORE_KEY, API_VERSION_STORE_KEY]);

async function buildLocalData(): Promise<Map<string, Uint8Array>> {
    const encoder = new TextEncoder();
    const data = new Map<string, Uint8Array>();

    data.set("settings", encoder.encode(JSON.stringify(VencordNative.settings.get())));

    // 🔴 القراءة صارت تُبلّغ بالعطل بدل أن تُعيد فراغاً. فقفلٌ عابر على ملفّ
    // CSS — من مضادّ فيروسات أو مجلدٍ مُزامَن — كان يُسقط المزامنة **كلّها**،
    // بما فيها الإعدادات وبيانات الإضافات. يُستثنى المفتاح وحده: لا يُرفَع،
    // فتبقى نسخة السحابة كما هي ولا تُمحى بفراغ.
    try {
        const quickCss = await VencordNative.quickCss.get();
        if (quickCss) data.set("quickCss", encoder.encode(quickCss));
    } catch (e) {
        logger.error("Could not read QuickCSS — excluded from this sync:", e);
    }

    const dataStoreEntries = await DataStore.entries();
    if (dataStoreEntries) {
        const travelling = dataStoreEntries.filter(([k]) => !SYNC_BOOKKEEPING_KEYS.has(String(k)));
        data.set("dataStore", encoder.encode(JSON.stringify(travelling)));
    }

    return data;
}

/** فشل تطبيق تنزيلٍ أو أكثر — يمنع تسجيل البيان كي يُعاد لاحقاً. */
class SyncApplyError extends Error {
    /**
     * @param settingsChanged هل طُبِّق **بعضُ** ما نُزِّل قبل الفشل؟
     *
     * 🔴 كان الرمي يمحو هذه الحقيقة: تُستورَد الإعدادات فعلاً وتصل القرص،
     * ثمّ يفشل عنصرٌ بعدها فيُقال للمستخدم «تعذّرت المزامنة» وحدها. فيظنّ أنّ
     * شيئاً لم يتغيّر، ولا يُعرَض عليه إعادة التشغيل التي يحتاجها ما تغيّر.
     */
    constructor(public readonly keys: string[], public readonly settingsChanged = false) {
        super(`تعذّر تطبيق ${keys.length} عنصراً من المزامنة: ${keys.join(", ")}`);
        this.name = "SyncApplyError";
    }
}

interface ApplyResult {
    settingsChanged: boolean;
    /** مفاتيح أُجّلت عمداً — **يجب ألّا تُسجَّل في البيان** وإلّا لن تُعرَض ثانيةً. */
    deferred: string[];
}

/** يُسقط من البيان ما لم يُطبَّق فعلاً، فيبقى الخلاف قائماً ويُعاد عرضه لاحقاً. */
function withoutDeferred(manifest: ManifestEntry[], deferred: string[]) {
    return deferred.length === 0 ? manifest : manifest.filter(e => !deferred.includes(e.key));
}

async function applyDownloads(
    downloads: SyncResponse["downloads"],
    opts: { userInitiated: boolean }
): Promise<ApplyResult> {
    if (downloads.length === 0) return { settingsChanged: false, deferred: [] };

    let settingsChanged = false;
    const decoder = new TextDecoder();
    const failed: string[] = [];
    const deferred: string[] = [];

    for (const dl of downloads) {
        /**
         * 🔴 كل مفتاحٍ في مصيدته، والفشل **يُسجَّل ويُرفَع للمنادي**.
         *
         * كان الفشل يُلتقَط ويُطبَع ثمّ يمضي التنفيذ إلى `saveLocalManifest`،
         * فيُسجَّل أنّ ما لم يُطبَّق قد طُبِّق. وبعدها تتطابق البصمات فلا
         * يُعاد تنزيله **أبداً** — يضيع بلا أن يعلم أحد.
         *
         * وفكّ الترميز **داخل** المصيدة لا قبلها: قيمةٌ مشوّهة كانت ترمي قبل
         * الدخول إليها، فتُسقط كل ما بقي من العناصر بلا سطرٍ يُسمّي المفتاح.
         */
        try {
            const text = decoder.decode(fromBase64(dl.value));

            if (dl.key === "settings") {
                await importSettings(JSON.stringify({ settings: JSON.parse(text) }), "all", true);
                settingsChanged = true;
            } else if (dl.key === "quickCss") {
                await VencordNative.quickCss.set(text);
                settingsChanged = true;
            } else if (dl.key === "dataStore") {
                /**
                 * 🔴 هذا هو المفتاح الذي **نرفعه فعلاً** — ولم يكن له فرعٌ
                 * يُطابقه. الرفع يضع `data.set("dataStore", …)`، والتطبيق كان
                 * يقبل `"dataStore/<مفتاح>"` وحدها — صيغةٌ **لا كاتب لها في
                 * المستودع كلّه**. فكل تنزيلٍ لبيانات الإضافات يسقط بلا سطر
                 * سجلّ، ثمّ يُسجَّل البيان أنّه طُبِّق فلا يُعاد أبداً.
                 *
                 * لكنّ الكتابة هنا تشمل **المتجر كلّه**، وكتابةُ الإضافات إلى
                 * `DataStore` لا تُعلِّم الإعدادات بأنّها اتّسخت — فالإقلاع
                 * التالي يسحب من السحابة ويدهس ما لم يُرفَع قطّ. لذلك لا
                 * تُطبَّق الحمولة إلّا في حالين لا ثالث لهما:
                 *   • استعادةٌ طلبها المستخدم بنفسه، أو
                 *   • جهازٌ لا بيانات فيه أصلاً — فلا شيء يُدهَس.
                 * وما عدا ذلك **يُؤجَّل ولا يُسجَّل**، فيُعرَض ثانيةً.
                 */
                const entries = JSON.parse(text);
                if (!Array.isArray(entries)) throw new Error("dataStore ليس مصفوفة مداخل");

                if (!opts.userInitiated) {
                    const localKeys = (await DataStore.keys())
                        .filter(k => !SYNC_BOOKKEEPING_KEYS.has(String(k)));
                    if (localKeys.length > 0) {
                        deferred.push(dl.key);
                        logger.info(
                            `Deferring the "dataStore" download: ${localKeys.length} local entries would be overwritten. ` +
                            "It will be offered again, and applies on a sync you start yourself."
                        );
                        continue;
                    }
                }

                const incoming = (entries as [string, unknown][])
                    .filter(([k]) => !SYNC_BOOKKEEPING_KEYS.has(String(k)));
                await DataStore.setMany(incoming);
                settingsChanged = true;
            } else if (dl.key.startsWith("dataStore/")) {
                // صيغةٌ لكل مفتاحٍ على حدة — تبقى مقبولة لخادمٍ يحفظها هكذا.
                const dsKey = dl.key.slice("dataStore/".length);
                if (SYNC_BOOKKEEPING_KEYS.has(dsKey)) {
                    deferred.push(dl.key);
                    continue;
                }
                await DataStore.set(dsKey, JSON.parse(text));
                settingsChanged = true;
            }
        } catch (e) {
            logger.error(`تعذّر تطبيق «${dl.key}» من المزامنة — لن يُسجَّل مُطبَّقاً:`, e);
            failed.push(dl.key);
        }
    }

    if (failed.length > 0) throw new SyncApplyError(failed, settingsChanged);

    return { settingsChanged, deferred };
}

function handleAuthFailure() {
    showNotification({
        title: "Cloud Settings",
        body: "Cloud sync was disabled because this account isn't connected. Reconnect in Cloud Settings.",
        color: "var(--yellow-360)",
        onClick: () => SettingsRouter.openUserSettings("equicord_cloud_panel"),
    });
    Settings.cloud.authenticated = false;
}

async function doSyncV2(uploads: SyncRequest["uploads"], clientManifest: ManifestEntry[]): Promise<SyncResponse | null> {
    let res: Response;
    try {
        res = await fetch(new URL("/v2/sync", getCloudUrl()), {
            method: "POST",
            headers: {
                Authorization: await getCloudAuth(),
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ client_manifest: clientManifest, uploads } satisfies SyncRequest),
        });
    } catch (e) {
        logger.error("v2 sync network error, will retry next sync", e);
        return null;
    }

    if (res.status === 404) {
        logger.info("Server does not support v2, falling back to v1");
        await setApiVersion("v1");
        return null;
    }

    if (res.status === 401) {
        handleAuthFailure();
        return null;
    }

    if (!res.ok) {
        logger.error(`Sync failed, API returned ${res.status}`);
        showNotification({
            title: "Cloud Settings",
            body: `Could not synchronize settings (API returned ${res.status}).`,
            color: "var(--red-360)",
        });
        return null;
    }

    return await res.json();
}

async function putV2(manual?: boolean) {
    const localManifest = await getLocalManifest();
    const manifestMap = new Map(localManifest.map(e => [e.key, e]));

    const localData = await buildLocalData();
    const uploads: SyncRequest["uploads"] = [];

    for (const [key, value] of localData) {
        const checksum = await computeChecksum(value);
        const existing = manifestMap.get(key);

        if (!existing || existing.checksum !== checksum)
            uploads.push({ key, value: toBase64(value), checksum });
    }

    if (uploads.length === 0 && !manual) {
        logger.info("No changes to push");
        delete localStorage.Vencord_settingsDirty;
        return;
    }

    const response = await doSyncV2(uploads, localManifest);
    if (!response) return;

    for (const err of response.errors)
        logger.error(`Sync error for ${err.key}: ${err.error}`);

    const applied = await applyDownloads(response.downloads, { userInitiated: !!manual });
    // ما أُجّل لا يُسجَّل: البيان يجب أن يبقى مخالفاً حتى يُطبَّق فعلاً.
    await saveLocalManifest(withoutDeferred(response.server_manifest, applied.deferred));

    PlainSettings.cloud.settingsSyncVersion = Date.now();
    await VencordNative.settings.set(JSON.stringify(PlainSettings));

    logger.info(`Sync complete: ${response.uploaded.length} uploaded, ${response.downloads.length} downloaded`);

    if (manual) {
        showNotification({
            title: "Cloud Settings",
            body: applied.settingsChanged
                ? "Settings synced! Click here to restart to fully apply changes."
                : "Settings synchronized to the cloud!",
            color: "var(--green-360)",
            onClick: applied.settingsChanged ? (IS_WEB ? () => location.reload() : relaunch) : undefined,
            noPersist: true,
        });
    }

    delete localStorage.Vencord_settingsDirty;
}

async function getV2(shouldNotify: boolean, force: boolean) {
    const localManifest = force ? [] : await getLocalManifest();

    const response = await doSyncV2([], localManifest);
    if (!response) return false;

    for (const err of response.errors)
        logger.error(`Sync error for ${err.key}: ${err.error}`);

    if (response.downloads.length === 0) {
        logger.info("Settings up to date");
        if (shouldNotify)
            showNotification({
                title: "Cloud Settings",
                body: "Your settings are up to date.",
                noPersist: true,
            });
        return false;
    }

    // الاستعادة التي يطلبها المستخدم بنفسه تأتي بـ`force` — وهي وحدها
    // المأذون لها بالكتابة على متجر بيانات الإضافات كاملاً.
    const applied = await applyDownloads(response.downloads, { userInitiated: force });
    const { settingsChanged } = applied;
    await saveLocalManifest(withoutDeferred(response.server_manifest, applied.deferred));

    PlainSettings.cloud.settingsSyncVersion = Date.now();
    await VencordNative.settings.set(JSON.stringify(PlainSettings));

    logger.info(`Pulled ${response.downloads.length} keys from cloud`);

    if (shouldNotify)
        showNotification({
            title: "Cloud Settings",
            body: settingsChanged
                ? "Your settings have been updated! Click here to restart to fully apply changes!"
                : "Cloud data synchronized.",
            color: "var(--green-360)",
            onClick: settingsChanged ? (IS_WEB ? () => location.reload() : relaunch) : undefined,
            noPersist: true,
        });

    delete localStorage.Vencord_settingsDirty;
    return true;
}

async function deleteV2() {
    const auth = await getCloudAuth();

    const manifestRes = await fetch(new URL("/v2/manifest", getCloudUrl()), {
        headers: { Authorization: auth },
    });

    if (!manifestRes.ok) {
        showNotification({
            title: "Cloud Settings",
            body: `Could not fetch manifest for deletion (API returned ${manifestRes.status}).`,
            color: "var(--red-360)",
        });
        return;
    }

    const { entries }: { entries: ManifestEntry[]; } = await manifestRes.json();

    await Promise.all(entries.map(async entry => {
        const res = await fetch(new URL(`/v2/data/${encodeURIComponent(entry.key)}`, getCloudUrl()), {
            method: "DELETE",
            headers: { Authorization: auth },
        });
        if (!res.ok && res.status !== 404)
            logger.error(`Failed to delete key ${entry.key}: ${res.status}`);
    }));

    await saveLocalManifest([]);

    PlainSettings.cloud.settingsSyncVersion = 0;
    await VencordNative.settings.set(JSON.stringify(PlainSettings));

    logger.info("Settings deleted from cloud successfully");
    showNotification({
        title: "Cloud Settings",
        body: "Settings deleted from cloud!",
        color: "var(--green-360)",
    });
}

async function putV1(manual?: boolean) {
    const settings = await exportSettings({ syncDataStore: false, minify: true });

    const res = await fetch(new URL("/v1/settings", getCloudUrl()), {
        method: "PUT",
        headers: {
            Authorization: await getCloudAuth(),
            "Content-Type": "application/octet-stream",
        },
        body: deflateSync(new TextEncoder().encode(settings)) as Uint8Array<ArrayBuffer>,
    });

    if (!res.ok) {
        logger.error(`Failed to sync up, API returned ${res.status}`);
        showNotification({
            title: "Cloud Settings",
            body: `Could not synchronize settings to cloud (API returned ${res.status}).`,
            color: "var(--red-360)",
        });
        return;
    }

    const { written } = await res.json();
    PlainSettings.cloud.settingsSyncVersion = written;
    VencordNative.settings.set(JSON.stringify(PlainSettings));

    logger.info("Settings uploaded to cloud successfully");

    if (manual) {
        showNotification({
            title: "Cloud Settings",
            body: "Synchronized settings to the cloud!",
            noPersist: true,
        });
    }

    delete localStorage.Vencord_settingsDirty;
}

async function getV1(shouldNotify: boolean, force: boolean) {
    const res = await fetch(new URL("/v1/settings", getCloudUrl()), {
        method: "GET",
        headers: {
            Authorization: await getCloudAuth(),
            Accept: "application/octet-stream",
            "If-None-Match": Settings.cloud.settingsSyncVersion.toString(),
        },
    });

    if (res.status === 401) {
        handleAuthFailure();
        return false;
    }

    if (res.status === 404) {
        logger.info("No settings on the cloud");
        if (shouldNotify)
            showNotification({
                title: "Cloud Settings",
                body: "There are no settings in the cloud.",
                noPersist: true,
            });
        return false;
    }

    if (res.status === 304) {
        logger.info("Settings up to date");
        if (shouldNotify)
            showNotification({
                title: "Cloud Settings",
                body: "Your settings are up to date.",
                noPersist: true,
            });
        return false;
    }

    if (!res.ok) {
        logger.error(`Failed to sync down, API returned ${res.status}`);
        showNotification({
            title: "Cloud Settings",
            body: `Could not synchronize settings from the cloud (API returned ${res.status}).`,
            color: "var(--red-360)",
        });
        return false;
    }

    const written = Number(res.headers.get("etag")!);
    const localWritten = Settings.cloud.settingsSyncVersion;

    if (!force && written < localWritten) {
        if (shouldNotify)
            showNotification({
                title: "Cloud Settings",
                body: "Your local settings are newer than the cloud ones.",
                noPersist: true,
            });
        return false;
    }

    const data = await res.arrayBuffer();
    const settings = new TextDecoder().decode(inflateSync(new Uint8Array(data)));
    await importSettings(settings, "all", true);

    PlainSettings.cloud.settingsSyncVersion = written;
    VencordNative.settings.set(JSON.stringify(PlainSettings));

    logger.info("Settings loaded from cloud successfully");
    if (shouldNotify)
        showNotification({
            title: "Cloud Settings",
            body: "Your settings have been updated! Click here to restart to fully apply changes!",
            color: "var(--green-360)",
            onClick: IS_WEB ? () => location.reload() : relaunch,
            noPersist: true,
        });

    delete localStorage.Vencord_settingsDirty;
    return true;
}

async function deleteV1() {
    const res = await fetch(new URL("/v1/settings", getCloudUrl()), {
        method: "DELETE",
        headers: { Authorization: await getCloudAuth() },
    });

    if (!res.ok) {
        logger.error(`Failed to delete, API returned ${res.status}`);
        showNotification({
            title: "Cloud Settings",
            body: `Could not delete settings (API returned ${res.status}).`,
            color: "var(--red-360)",
        });
        return;
    }

    logger.info("Settings deleted from cloud successfully");
    showNotification({
        title: "Cloud Settings",
        body: "Settings deleted from cloud!",
        color: "var(--green-360)",
    });
}

export function shouldCloudSync(direction: "push" | "pull") {
    const localDirection = localStorage.Vencord_cloudSyncDirection;
    return localDirection === direction || localDirection === "both";
}

export async function putCloudSettings(manual?: boolean) {
    try {
        const version = await getApiVersion();
        if (version === "v2") {
            await putV2(manual);
            if (await getApiVersion() === "v1")
                await putV1(manual);
        } else {
            await putV1(manual);
        }
    } catch (e: any) {
        logger.error("Failed to sync up", e);
        // 🔴 الفشل الجزئي ليس فشلاً كاملاً: قد تكون الإعدادات وصلت القرص
        // فعلاً قبل أن يتعثّر عنصرٌ بعدها. أن يُقال «تعذّرت المزامنة» وحدها
        // يجعل المستخدم يظنّ أنّ شيئاً لم يتغيّر — ولا يُعرَض عليه إعادة
        // التشغيل التي يحتاجها ما تغيّر بالفعل.
        const partial = e instanceof SyncApplyError && e.settingsChanged;
        showNotification({
            title: "Cloud Settings",
            body: partial
                ? `Some of your settings were applied, but not all (${e.toString()}). `
                    + "Click here to restart so the applied ones take effect — the rest stays pending and will be offered again."
                : `Could not synchronize settings to the cloud (${e.toString()}).`,
            color: partial ? "var(--status-warning)" : "var(--red-360)",
            onClick: partial ? (IS_WEB ? () => location.reload() : relaunch) : undefined,
        });
    }
}

export async function getCloudSettings(shouldNotify = true, force = false) {
    try {
        const version = await getApiVersion();
        if (version === "v2") {
            const result = await getV2(shouldNotify, force);
            if (await getApiVersion() === "v1")
                return await getV1(shouldNotify, force);
            return result;
        }
        return await getV1(shouldNotify, force);
    } catch (e: any) {
        logger.error("Failed to sync down", e);
        // 🔴 الفشل الجزئي ليس فشلاً كاملاً: قد تكون الإعدادات وصلت القرص
        // فعلاً قبل أن يتعثّر عنصرٌ بعدها. أن يُقال «تعذّرت المزامنة» وحدها
        // يجعل المستخدم يظنّ أنّ شيئاً لم يتغيّر — ولا يُعرَض عليه إعادة
        // التشغيل التي يحتاجها ما تغيّر بالفعل.
        const partial = e instanceof SyncApplyError && e.settingsChanged;
        showNotification({
            title: "Cloud Settings",
            body: partial
                ? `Some of your settings were applied, but not all (${e.toString()}). `
                    + "Click here to restart so the applied ones take effect — the rest stays pending and will be offered again."
                : `Could not synchronize settings from the cloud (${e.toString()}).`,
            color: partial ? "var(--status-warning)" : "var(--red-360)",
            onClick: partial ? (IS_WEB ? () => location.reload() : relaunch) : undefined,
        });
        return false;
    }
}

export async function deleteCloudSettings() {
    try {
        const version = await getApiVersion();
        if (version === "v2")
            await deleteV2();
        else
            await deleteV1();
    } catch (e: any) {
        logger.error("Failed to delete", e);
        showNotification({
            title: "Cloud Settings",
            body: `Could not delete settings (${e.toString()}).`,
            color: "var(--red-360)",
        });
    }
}

export async function eraseAllCloudData() {
    const res = await fetch(new URL("/v1/", getCloudUrl()), {
        method: "DELETE",
        headers: { Authorization: await getCloudAuth() },
    });

    if (!res.ok) {
        logger.error(`Failed to erase data, API returned ${res.status}`);
        showNotification({
            title: "Cloud Integrations",
            body: `Could not erase all data (API returned ${res.status}), please contact support.`,
            color: "var(--red-360)",
        });
        return;
    }

    Settings.cloud.authenticated = false;
    await deauthorizeCloud();
    await saveLocalManifest([]);

    showNotification({
        title: "Cloud Integrations",
        body: "Successfully erased all data.",
        color: "var(--green-360)",
    });
}
