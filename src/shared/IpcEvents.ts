/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

export const enum IpcEvents {
    INIT_FILE_WATCHERS = "VencordInitFileWatchers",
    QUICK_CSS_UPDATE = "VencordQuickCssUpdate",
    OPEN_QUICKCSS = "VencordOpenQuickCss",
    GET_QUICK_CSS = "VencordGetQuickCss",
    SET_QUICK_CSS = "VencordSetQuickCss",
    UPLOAD_THEME = "VencordUploadTheme",
    DELETE_THEME = "VencordDeleteTheme",
    GET_THEMES_LIST = "VencordGetThemesList",
    GET_THEME_DATA = "VencordGetThemeData",
    GET_THEME_SYSTEM_VALUES = "VencordGetThemeSystemValues",
    GET_SETTINGS_DIR = "VencordGetSettingsDir",
    /** حال حفظ الإعدادات على القرص — لتشخيص «إعداداتي تعود كما كانت». */
    GET_SETTINGS_HEALTH = "EsharqGetSettingsHealth",
    GET_SETTINGS = "VencordGetSettings",
    SET_SETTINGS = "VencordSetSettings",
    THEME_UPDATE = "VencordThemeUpdate",
    OPEN_EXTERNAL = "VencordOpenExternal",
    GET_UPDATES = "VencordGetUpdates",
    GET_REPO = "VencordGetRepo",
    UPDATE = "VencordUpdate",
    BUILD = "VencordBuild",
    OPEN_MONACO_EDITOR = "VencordOpenMonacoEditor",
    GET_MONACO_THEME = "VencordGetMonacoTheme",

    GET_PLUGIN_IPC_METHOD_MAP = "VencordGetPluginIpcMethodMap",

    CSP_IS_DOMAIN_ALLOWED = "VencordCspIsDomainAllowed",
    CSP_REMOVE_OVERRIDE = "VencordCspRemoveOverride",
    CSP_REQUEST_ADD_OVERRIDE = "VencordCspRequestAddOverride",

    OPEN_THEMES_FOLDER = "VencordOpenThemesFolder",
    OPEN_SETTINGS_FOLDER = "VencordOpenSettingsFolder",
    GET_RENDERER_CSS = "VencordGetRendererCss",
    RENDERER_CSS_UPDATE = "VencordRendererCssUpdate",
    PRELOAD_GET_RENDERER_JS = "VencordPreloadGetRendererJs",

    SET_TRAY_UPDATE_STATE = "VencordSetTrayUpdateState",
    TRAY_REPAIR = "VencordTrayRepair",
    TRAY_CHECK_UPDATES = "VencordTrayCheckUpdates",
    TRAY_ABOUT = "VencordTrayAbout",
    SUPPORTS_WINDOWS_MATERIAL = "VencordSupportsWindowsMaterial",

    /* إضافات المجتمع — تُستورَد من مجلد على جهاز المستخدم ولا تغادره أبداً. */
    COMMUNITY_LIST = "EsharqCommunityList",
    COMMUNITY_PICK_AND_IMPORT = "EsharqCommunityPickAndImport",
    COMMUNITY_REMOVE = "EsharqCommunityRemove",
    COMMUNITY_SET_ENABLED = "EsharqCommunitySetEnabled",
    COMMUNITY_OPEN_FOLDER = "EsharqCommunityOpenFolder",
    COMMUNITY_READ_SOURCE = "EsharqCommunityReadSource",
    /** متزامن: يُقرأ قبل تمهيد ديسكورد كي تلحق الرقع. */
    COMMUNITY_GET_BUNDLE = "EsharqCommunityGetBundle",

    /* الرصد — جرد الوجهات الشبكية المسموح بها. */
    CSP_LIST_POLICIES = "EsharqCspListPolicies",

    /* ميزانيات الأداء — مقاييس عمليات ديسكورد. */
    PERF_APP_METRICS = "EsharqPerfAppMetrics",

    /* الخصوصية — جرد ما يُخزَّن على القرص (أحجام ومسارات لا محتوى). */
    DATA_INVENTORY = "EsharqDataInventory",
    DATA_OPEN_ROOT = "EsharqDataOpenRoot",

    /* منشئ الثيمات — ما يمسّ القرص وحده؛ التلوين كلّه في المُصيَّر. */
    THEME_PICK_BACKGROUND = "EsharqThemePickBackground",
    THEME_GET_BACKGROUND = "EsharqThemeGetBackground",
    THEME_CLEAR_BACKGROUND = "EsharqThemeClearBackground",
    THEME_SAVE_CSS = "EsharqThemeSaveCss",
    THEME_LIBRARY_LIST = "EsharqThemeLibraryList",
    THEME_LIBRARY_INSTALL = "EsharqThemeLibraryInstall",
    THEME_LIBRARY_OPEN = "EsharqThemeLibraryOpen",

    /* الاتّصال المشفّر — DNS عبر HTTPS، يُضبَط على مستوى التطبيق. */
    DNS_GET_STATE = "EsharqDnsGetState",
    DNS_SET = "EsharqDnsSet",
    DNS_TEST = "EsharqDnsTest",
    THEME_OPEN_FOLDER = "EsharqThemeOpenFolder",

    /* تنصيف الانهيار — جلسة بحثٍ ثنائيّ عبر إعادات التشغيل. */
    BISECT_START = "EsharqBisectStart",
    BISECT_ANSWER = "EsharqBisectAnswer",
    BISECT_CANCEL = "EsharqBisectCancel",
    /** متزامن: يُقرأ قبل بدء أي إضافة. */
    BISECT_GET = "EsharqBisectGet",
}
