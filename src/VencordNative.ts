/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Settings } from "@api/Settings";
import type { BundledPlugin as CommunityBundle, CommunityEntry, ImportResult as CommunityImportResult } from "@main/communityPlugins";
import type { BisectSession } from "@main/crashBisect";
import type { CspRequestResult } from "@main/csp/manager";
import type { PluginIpcMappings } from "@main/ipcPlugins";
import { UserThemeHeader } from "@main/themes";
import { IpcEvents } from "@shared/IpcEvents";
import type { IpcRes } from "@utils/types";
import { ipcRenderer } from "electron/renderer";

export function invoke<T = any>(event: IpcEvents, ...args: any[]) {
    return ipcRenderer.invoke(event, ...args) as Promise<T>;
}

export function sendSync<T = any>(event: IpcEvents, ...args: any[]) {
    return ipcRenderer.sendSync(event, ...args) as T;
}

const PluginHelpers = {} as Record<string, Record<string, (...args: any[]) => Promise<any>>>;
const pluginIpcMap = sendSync<PluginIpcMappings>(IpcEvents.GET_PLUGIN_IPC_METHOD_MAP);

for (const [plugin, methods] of Object.entries(pluginIpcMap)) {
    const map = PluginHelpers[plugin] = {};
    for (const [methodName, method] of Object.entries(methods)) {
        map[methodName] = (...args: any[]) => invoke(method as IpcEvents, ...args);
    }
}

export default {
    themes: {
        uploadTheme: async (fileName: string, fileData: string): Promise<void> => {
            throw new Error("uploadTheme is WEB only");
        },
        deleteTheme: async (fileName: string): Promise<void> => {
            throw new Error("deleteTheme is WEB only");
        },
        getThemesList: () => invoke<Array<UserThemeHeader>>(IpcEvents.GET_THEMES_LIST),
        getThemeData: (fileName: string) => invoke<string | undefined>(IpcEvents.GET_THEME_DATA, fileName),
        getSystemValues: () => invoke<Record<string, string>>(IpcEvents.GET_THEME_SYSTEM_VALUES),

        openFolder: () => invoke<void>(IpcEvents.OPEN_THEMES_FOLDER),
    },

    updater: {
        getUpdates: () => invoke<IpcRes<Record<"hash" | "author" | "message", string>[]>>(IpcEvents.GET_UPDATES),
        update: () => invoke<IpcRes<boolean>>(IpcEvents.UPDATE),
        rebuild: () => invoke<IpcRes<boolean>>(IpcEvents.BUILD),
        getRepo: () => invoke<IpcRes<string>>(IpcEvents.GET_REPO),
    },

    settings: {
        get: () => sendSync<Settings>(IpcEvents.GET_SETTINGS),
        set: (settings: Settings, pathToNotify?: string) => invoke<void>(IpcEvents.SET_SETTINGS, settings, pathToNotify),
        getSettingsDir: () => invoke<string>(IpcEvents.GET_SETTINGS_DIR),

        openFolder: () => invoke<void>(IpcEvents.OPEN_SETTINGS_FOLDER),
    },

    quickCss: {
        get: () => invoke<string>(IpcEvents.GET_QUICK_CSS),
        set: (css: string) => invoke<void>(IpcEvents.SET_QUICK_CSS, css),

        addChangeListener(cb: (newCss: string) => void) {
            ipcRenderer.removeAllListeners(IpcEvents.QUICK_CSS_UPDATE);
            ipcRenderer.on(IpcEvents.QUICK_CSS_UPDATE, (_, css) => cb(css));
        },

        addThemeChangeListener(cb: () => void) {
            ipcRenderer.removeAllListeners(IpcEvents.THEME_UPDATE);
            ipcRenderer.on(IpcEvents.THEME_UPDATE, () => cb());
        },

        openFile: () => invoke<void>(IpcEvents.OPEN_QUICKCSS),
        openEditor: () => invoke<void>(IpcEvents.OPEN_MONACO_EDITOR),
        getEditorTheme: () => sendSync<string>(IpcEvents.GET_MONACO_THEME),
    },

    native: {
        getVersions: () => process.versions as Partial<NodeJS.ProcessVersions>,
        supportsWindowsMaterial: () => sendSync<boolean>(IpcEvents.SUPPORTS_WINDOWS_MATERIAL),
        openExternal: (url: string) => invoke<void>(IpcEvents.OPEN_EXTERNAL, url),
        getRendererCss: () => invoke<string>(IpcEvents.GET_RENDERER_CSS),
        onRendererCssUpdate: (cb: (newCss: string) => void) => {
            if (!IS_DEV) return;

            ipcRenderer.removeAllListeners(IpcEvents.RENDERER_CSS_UPDATE);
            ipcRenderer.on(IpcEvents.RENDERER_CSS_UPDATE, (_e, newCss: string) => cb(newCss));
        }
    },

    csp: {
        /**
         * Note: Only supports full explicit matches, not wildcards.
         *
         * If `*.example.com` is allowed, `isDomainAllowed("https://sub.example.com")` will return false.
         */
        isDomainAllowed: (url: string, directives: string[]) => invoke<boolean>(IpcEvents.CSP_IS_DOMAIN_ALLOWED, url, directives),
        removeOverride: (url: string) => invoke<boolean>(IpcEvents.CSP_REMOVE_OVERRIDE, url),
        requestAddOverride: (url: string, directives: string[], callerName: string) =>
            invoke<CspRequestResult>(IpcEvents.CSP_REQUEST_ADD_OVERRIDE, url, directives, callerName),

        /** جرد الوجهات المسموح بها — لصفحة «الرصد». */
        listPolicies: () => invoke<{
            builtIn: { host: string; directives: string[]; }[];
            custom: { host: string; directives: string[]; }[];
        }>(IpcEvents.CSP_LIST_POLICIES),
    },

    tray: {
        setUpdateState: (available: boolean) => ipcRenderer.send(IpcEvents.SET_TRAY_UPDATE_STATE, available),
        onCheckUpdates: (cb: () => void) => {
            ipcRenderer.removeAllListeners(IpcEvents.TRAY_CHECK_UPDATES);
            ipcRenderer.on(IpcEvents.TRAY_CHECK_UPDATES, cb);
        },
        onRepair: (cb: () => void) => {
            ipcRenderer.removeAllListeners(IpcEvents.TRAY_REPAIR);
            ipcRenderer.on(IpcEvents.TRAY_REPAIR, cb);
        },
    },

    /**
     * إضافات المجتمع — يستوردها العضو من جهازه ولا تغادره.
     *
     * 🔴 `getBundle` **متزامنة**: تُقرأ في تمهيد المُصيِّر قبل أن يُقلع webpack
     * عند ديسكورد. ولو كانت وعداً لسُجّلت رقع الإضافة بعد تحميل الوحدات فلا
     * تُطابق شيئاً — وهو فشل صامت لا رسالة له.
     */
    /** تنصيف الانهيار — جلسة بحثٍ ثنائيّ لا تمسّ الإعدادات المحفوظة. */
    bisect: {
        /** 🔴 متزامن: يُقرأ قبل بدء أي إضافة. */
        get: () => sendSync<BisectSession | null>(IpcEvents.BISECT_GET),
        start: (candidates: string[]) => invoke<BisectSession>(IpcEvents.BISECT_START, candidates),
        answer: (stillHappens: boolean) => invoke<BisectSession | { done: true; culprit: string | null; }>(IpcEvents.BISECT_ANSWER, stillHappens),
        cancel: () => invoke<void>(IpcEvents.BISECT_CANCEL)
    },

    /** جرد ما يُخزَّن على القرص — أحجام ومسارات، لا محتوى. */
    dataInventory: {
        read: () => invoke<{ root: string; entries: { key: string; path: string; files: number; bytes: number; exists: boolean; }[]; }>(IpcEvents.DATA_INVENTORY),
        openRoot: () => invoke<void>(IpcEvents.DATA_OPEN_ROOT)
    },

    /** مقاييس العمليات — تُقرأ عند الطلب فقط، لصفحة «ميزانيات الأداء». */
    perf: {
        appMetrics: () => invoke<{ type: string; pid: number; cpu: number | null; memMB: number; }[]>(IpcEvents.PERF_APP_METRICS)
    },

    communityPlugins: {
        getBundle: () => sendSync<CommunityBundle[]>(IpcEvents.COMMUNITY_GET_BUNDLE),
        list: () => invoke<CommunityEntry[]>(IpcEvents.COMMUNITY_LIST),
        pickAndImport: () => invoke<CommunityImportResult>(IpcEvents.COMMUNITY_PICK_AND_IMPORT),
        remove: (id: string) => invoke<boolean>(IpcEvents.COMMUNITY_REMOVE, id),
        setEnabled: (id: string, enabled: boolean) => invoke<boolean>(IpcEvents.COMMUNITY_SET_ENABLED, id, enabled),
        openFolder: (id: string) => invoke<void>(IpcEvents.COMMUNITY_OPEN_FOLDER, id),
        readSource: (id: string) => invoke<{ path: string; text: string; }[]>(IpcEvents.COMMUNITY_READ_SOURCE, id)
    },

    pluginHelpers: PluginHelpers
};
