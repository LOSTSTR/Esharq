/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
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

import { SettingsStore as SettingsStoreClass } from "@shared/SettingsStore";
import { Logger } from "@utils/Logger";
import { mergeDefaults } from "@utils/mergeDefaults";
import { DefinedSettings, OptionType, SettingsChecks, SettingsDefinition } from "@utils/types";
import { React, useEffect } from "@webpack/common";

import plugins from "~plugins";

const logger = new Logger("Settings");

export type ThemeActivationMode = "always" | "light" | "dark";

export interface SettingsPluginUiElement {
    enabled: boolean;
    // TODO
    /** not implemented for now */
    order?: number;
}
export type SettingsPluginUiElements = {
    /** id will be whatever id the element was registered with. Usually, but not always, the plugin name */
    [id: string]: SettingsPluginUiElement;
};

export interface Settings {
    autoUpdate: boolean;
    autoUpdateNotification: boolean;
    useQuickCss: boolean;
    eagerPatches: boolean;
    enabledThemes: string[];
    enabledThemeLinks: string[];
    enableOnlineThemes: boolean;
    pinnedThemes: string[];
    themeNames: Record<string, string>;
    themeActivationModes: Partial<Record<string, ThemeActivationMode>>;
    enableReactDevtools: boolean;
    themeLinks: string[];
    mainWindowFrameless: boolean;
    frameless: boolean;
    transparent: boolean;
    winCtrlQ: boolean;
    macosVibrancyStyle:
    | "content"
    | "fullscreen-ui"
    | "header"
    | "hud"
    | "menu"
    | "popover"
    | "selection"
    | "sidebar"
    | "titlebar"
    | "tooltip"
    | "under-page"
    | "window"
    | undefined;
    windowsMaterial: "none" | "mica" | "tabbed" | "acrylic";
    disableMinSize: boolean;
    winNativeTitleBar: boolean;
    hardwareVideoAcceleration: boolean;
    htmlFullscreenFix: boolean;
    plugins: {
        [plugin: string]: {
            enabled: boolean;
            isFavorite?: boolean;
            [setting: string]: any;
        };
    };

    uiElements: {
        messagePopoverButtons: SettingsPluginUiElements;
        chatBarButtons: SettingsPluginUiElements;
    },

    notifications: {
        timeout: number;
        position: "top-right" | "bottom-right";
        useNative: "always" | "never" | "not-focused";
        missed: boolean;
        logLimit: number;
    };

    cloud: {
        authenticated: boolean;
        url: string;
        settingsSync: boolean;
        settingsSyncVersion: number;
    };

    /**
     * تفضيلات إشراق التي لا تخصّ إضافةً بعينها — تسكن هنا لا داخل إضافة.
     * كانت تحت `plugins.DiscordArabicizer` حين كانت واجهتها هناك؛ ويُرحّلها
     * `esharqPrefs` مرّة واحدة.
     *
     * 🔴 **`migrated` ليست زينة**: `mergeDefaults` يكتب الافتراضيات في المخزن
     * عند الإقلاع، فقيم هذه المجموعة تصير «محدَّدة» قبل أن يقرأها أحد. ولذلك
     * لا يصلح غياب القيمة دليلاً على أن المستخدم لم يختر بعد — والعلامة هي
     * الدليل الوحيد الصادق. بلا هذا وقع الترحيل خطأً في أوّل تجربة حيّة:
     * قُرئت `false` بينما محفوظ المستخدم `true`، بلا خطأ يشتكي.
     */
    esharq: {
        /** هل نُقلت التفضيلات من مواضعها القديمة؟ تُكتب مرّة واحدة. */
        migrated: boolean;
        /** لغة أوصاف الإضافات وإعداداتها ولوحة إشراق — الأسماء تبقى إنجليزية. */
        pluginsArabic: boolean;
        /** مفتاح الخطّ العربي المختار (`tajawal` … `off`). */
        arabicFont: string;
        /**
         * إخفاء شارات إشراق **على هذا الجهاز وحده** — خريطة `"<نوع>:<موضع>"`.
         * الغياب يعني «ظاهرة». النطاق العامّ لا يُخزَّن هنا بل على الخادم،
         * لأنّ ما يراه الناس ليس شأن جهازٍ واحد.
         */
        badgeHidden: Record<string, boolean>;
    };

    /**
     * منشئ الثيمات — حالةٌ حرّة الشكل يقرؤها ويكتبها المنشئ وحده.
     *
     * تُكتب `unknown` عن قصد: شكلها يتوسّع مع كل مِقبض جديد، وتثبيته هنا
     * يعني تعديل ملفّ الإعدادات الأساسي مع كل إضافةٍ في صفحةٍ واحدة. والقارئ
     * الوحيد (`themeCreator/state.ts`) يُصحّح ما يقرأ ويملأ ناقصه.
     */
    themeCreator: unknown;

    ignoreResetWarning: boolean;
}

const DefaultSettings: Settings = {
    autoUpdate: true,
    autoUpdateNotification: true,
    useQuickCss: true,
    themeLinks: [],
    eagerPatches: false, // Eagerly patching no longer works due to module factories with the same id being able to have different sources now.
    enabledThemes: [],
    enabledThemeLinks: [],
    enableOnlineThemes: true,
    pinnedThemes: [],
    themeNames: {},
    themeActivationModes: {},
    enableReactDevtools: false,
    mainWindowFrameless: false,
    frameless: false,
    transparent: false,
    winCtrlQ: false,
    macosVibrancyStyle: undefined,
    windowsMaterial: "none",
    disableMinSize: false,
    winNativeTitleBar: false,
    hardwareVideoAcceleration: true,
    htmlFullscreenFix: true,
    plugins: {},

    uiElements: {
        chatBarButtons: {},
        messagePopoverButtons: {}
    },

    notifications: {
        timeout: 5000,
        position: "bottom-right",
        useNative: "not-focused",
        missed: true,
        logLimit: 50
    },

    cloud: {
        authenticated: false,
        url: "https://cloud.equicord.org/",
        settingsSync: false,
        settingsSyncVersion: 0
    },

    esharq: {
        migrated: false,
        pluginsArabic: false,
        arabicFont: "tajawal",
        badgeHidden: {}
    },

    themeCreator: null,

    ignoreResetWarning: false,
};

const settings = !IS_REPORTER ? VencordNative.settings.get() : {} as Settings;
mergeDefaults(settings, DefaultSettings);

export const SettingsStore = new SettingsStoreClass(settings, {
    readOnly: true,
    getDefaultValue({
        target,
        key,
        path
    }) {
        const v = target[key];
        if (!plugins) return v; // plugins not initialised yet. this means this path was reached by being called on the top level

        if (path === "plugins" && key in plugins)
            return target[key] = {
                enabled: IS_REPORTER || plugins[key].required || plugins[key].enabledByDefault || false
            };

        // Since the property is not set, check if this is a plugin's setting and if so, try to resolve
        // the default value.
        if (path.startsWith("plugins.")) {
            const plugin = path.slice("plugins.".length);
            if (plugin in plugins) {
                const setting = plugins[plugin].settings?.def[key];
                if (!setting) return v;

                if ("default" in setting)
                    // normal setting with a default value
                    return (target[key] = setting.default);

                if (setting.type === OptionType.SELECT) {
                    const def = setting.options.find(o => o.default);
                    if (def)
                        target[key] = def.value;
                    return def?.value;
                }
            }
        }
        return v;
    }
});

if (!IS_REPORTER) {
    SettingsStore.addGlobalChangeListener((_, path) => {
        SettingsStore.plain.cloud.settingsSyncVersion = Date.now();
        // 🔴 **رميان مختلفان، ولا يكفي أحد المصيدين**:
        //
        // 1. رفضٌ غير متزامن (فشل IPC) — يُلتقط بـ`.catch`.
        // 2. رميٌ **متزامن**: `settings.set` يستدعي `JSON.stringify` قبل أن
        //    يُرسل، وهي ترمي فوراً على **مرجعٍ دائريّ** تضعه إضافة. وهنا
        //    المكيدة: `Promise.resolve(f())` يُقيّم `f()` **قبل** أن يلفّه،
        //    فالرمي المتزامن يفلت من `.catch` كأنّه غير موجود — قِسته في node:
        //    «أفلت من catch وانتشر». ثمّ لا يلتقطه أحد بعده، لأنّ `SettingsStore`
        //    ينادي المستمعين عاريةً بلا try — فينتشر إلى **موضع الإسناد نفسه**،
        //    أي أنّ كلّ كتابة إعدادٍ في الجلسة ترمي في وجه من كتبها.
        //
        // فالمصيدان معاً: `try` للمتزامن، و`.catch` لغير المتزامن.
        scanSettingsOnce();
        try {
            Promise.resolve(VencordNative.settings.set(JSON.stringify(SettingsStore.plain), path))
                .catch(e => reportSettingsSaveFailure(e, path));
        } catch (e) {
            reportSettingsSaveFailure(e, path);
        }
    });
}

/**
 * يمشي في شجرة الإعدادات بحثاً عن قيمٍ **لا يمثّلها JSON** — دالّة أو رمز.
 *
 * 🔴 لماذا يلزم بعد الإصلاح: الجسر صار يُرسل نصّاً، فمثل هذه القيمة لم تعد
 * تُوقف الحفظ — لكنّها **تُحذَف صامتةً**، وهي دليلٌ على إضافةٍ تكتب في
 * إعداداتها ما لا يُحفَظ. تسميتُها تُنهي البحث بدل التخمين بين 489 إضافة.
 *
 * يُمشى مرّة واحدة في الجلسة بعد أوّل حفظ — لا مع كلّ تبديل.
 */
function findUnserialisable(node: any, at = "", seen = new Set<object>(), out: string[] = []): string[] {
    if (out.length >= 10 || node === null) return out;
    const type = typeof node;
    if (type === "function" || type === "symbol") { out.push(`${at} (${type})`); return out; }
    if (type !== "object") return out;
    // 🔴 الدائريّ **مسارٌ** لا مجموعة: قيمةٌ يُشار إليها من فرعين مختلفين
    // ليست دورةً — و`mergeDefaults` يُسند المصفوفات الافتراضية **بالمرجع**
    // (`obj[key] ??= v`)، فمجموعةٌ مشتركة عبر الإخوة كانت تُبلّغ عن دورةٍ
    // وهمية في تقرير الدعم وتُرسل من يقرؤه في طريقٍ مسدود.
    if (seen.has(node)) { out.push(`${at} (مرجع دائريّ)`); return out; }
    seen.add(node);
    for (const key of Object.keys(node)) {
        try {
            findUnserialisable(node[key], at ? `${at}.${key}` : key, seen, out);
        } catch { /* واصفٌ يرمي عند القراءة — يُتخطّى */ }
    }
    seen.delete(node);
    return out;
}

/**
 * مسارات القيم التي لا يحفظها JSON في الإعدادات — للتشخيص.
 *
 * 🔴 تُصدَّر كي تدخل **حزمة الدعم مباشرةً**: الفحص الداخليّ لا يعمل إلّا عند
 * أوّل تبديل، ومن يُنشئ تقريراً بلا أن يُبدّل شيئاً كان يُرسل تقريراً صامتاً
 * عن أهمّ سؤال. الآن يُحسَب عند بناء التقرير فيصل دائماً.
 */
export function getUnserialisableSettingPaths(): string[] {
    try {
        return findUnserialisable(SettingsStore.plain);
    } catch {
        return [];
    }
}

let scannedOnce = false;

function scanSettingsOnce() {
    if (scannedOnce) return;
    scannedOnce = true;
    try {
        const bad = findUnserialisable(SettingsStore.plain);
        if (bad.length === 0) return;
        console.warn("[Esharq] قيمٌ في الإعدادات لا يحفظها JSON:", bad);
        (window as any).VencordNative?.settings?.reportSaveFailure?.(
            `قيمٌ لا تُحفَظ في الإعدادات: ${bad.join(" · ")}`
        );
    } catch { /* الفحص تشخيصيّ محض — لا يُعطّل شيئاً */ }
}

/**
 * إبلاغٌ عن فشل حفظ الإعدادات من جانب الواجهة.
 *
 * الجسر يُرسل نصّاً الآن فلا يفشل الاستنساخ، ولم يبقَ إلّا ما يُفشل
 * `JSON.stringify` نفسه: **مرجعٌ دائريّ** تضعه إضافةٌ في إعداداتها. نادرٌ،
 * لكنّه لو وقع لأوقف الحفظ كلّه — فلا يُترَك صامتاً.
 */
function reportSettingsSaveFailure(e: any, path?: string) {
    const message = String(e?.message ?? e);
    console.error("[Esharq] تعذّر حفظ الإعدادات", path ? `(عند ${path})` : "", e);
    try {
        (window as any).VencordNative?.settings?.reportSaveFailure?.(
            `${message}${path ? ` — عند «${path}»` : ""}`
        );
    } catch { /* واجهةٌ أقدم — يبقى في المِعراض */ }
}

/**
 * Same as {@link Settings} but unproxied. You should treat this as readonly,
 * as modifying properties on this will not save to disk or call settings
 * listeners.
 * WARNING: default values specified in plugin.settings will not be ensured here. In other words,
 * settings for which you specified a default value may be uninitialised. If you need proper
 * handling for default values, use {@link Settings}
 */
export const PlainSettings = settings;
/**
 * A smart settings object. Altering props automagically saves
 * the updated settings to disk.
 * This recursively proxies objects. If you need the object non proxied, use {@link PlainSettings}
 */
export const Settings = SettingsStore.store;

/**
 * Settings hook for React components. Returns a smart settings
 * object that automagically triggers a rerender if any properties
 * are altered
 * @param paths An optional list of paths to whitelist for rerenders
 * @returns Settings
 */
// TODO: Representing paths as essentially "string[].join('.')" wont allow dots in paths, change to "paths?: string[][]" later
export function useSettings(paths?: UseSettings<Settings>[]) {
    const [, forceUpdate] = React.useReducer(() => ({}), {});

    useEffect(() => {
        if (paths) {
            paths.forEach(p => {
                if (p.endsWith(".*")) {
                    SettingsStore.addPrefixChangeListener(p.slice(0, -2), forceUpdate);
                } else {
                    SettingsStore.addChangeListener(p, forceUpdate);
                }
            });

            return () => paths.forEach(p => {
                if (p.endsWith(".*")) {
                    SettingsStore.removePrefixChangeListener(p.slice(0, -2), forceUpdate);
                } else {
                    SettingsStore.removeChangeListener(p, forceUpdate);
                }
            });
        } else {
            SettingsStore.addGlobalChangeListener(forceUpdate);
            return () => SettingsStore.removeGlobalChangeListener(forceUpdate);
        }
    }, [paths]);

    return SettingsStore.store;
}

export function migratePluginSettings(name: string, ...oldNames: string[]) {
    const { plugins } = SettingsStore.plain;
    if (name in plugins) return;

    for (const oldName of oldNames) {
        if (oldName in plugins) {
            logger.info(`Migrating settings from old name ${oldName} to ${name}`);
            plugins[name] = plugins[oldName];
            delete plugins[oldName];
            SettingsStore.markAsChanged();
            break;
        }
    }
}

export function migratePluginSetting(pluginName: string, newSetting: string, oldSetting: string) {
    const settings = SettingsStore.plain.plugins[pluginName];
    if (!settings) return;

    if (!Object.hasOwn(settings, oldSetting) || Object.hasOwn(settings, newSetting)) return;

    logger.info(`Migrating plugin setting from ${oldSetting} to ${newSetting} on ${pluginName}`);
    settings[newSetting] = settings[oldSetting];
    delete settings[oldSetting];
    SettingsStore.markAsChanged();
}

export function migratePluginToSettings(deleteOldSettings: boolean, newName: string, oldName: string, ...settingNames: string[]) {
    const { plugins } = SettingsStore.plain;
    const newPlugin = plugins[newName];
    const oldPlugin = plugins[oldName];

    if (newPlugin && oldPlugin?.enabled) {
        for (const settingName of settingNames) {
            logger.info(`Migrating plugin to setting from old name ${oldName} to ${newName} as ${settingName}`);
            newPlugin[settingName] = true;
        }

        newPlugin.enabled = true;
        if (deleteOldSettings) delete plugins[oldName];
        SettingsStore.markAsChanged();
    }
}

export function migrateSettingToPlugin(newName: string, oldName: string, settingName: string) {
    const { plugins } = SettingsStore.plain;
    const newPlugin = plugins[newName];
    const oldPlugin = plugins[oldName];

    if (newPlugin && oldPlugin?.enabled && oldPlugin?.[settingName]) {
        logger.info(`Migrating setting ${settingName} from ${oldName} to seperate plugin ${newName}`);
        delete oldPlugin[settingName];
        newPlugin.enabled = true;
        SettingsStore.markAsChanged();
    }
}

export function migrateSettingsFromPlugin(newPlugin: string, oldPlugin: string, ...settings: string[]) {
    const { plugins } = SettingsStore.plain;
    const oldSettings = plugins[oldPlugin];
    const newSettings = plugins[newPlugin];
    if (!oldSettings || !newSettings) return;

    for (const setting of settings) {
        if (!Object.hasOwn(oldSettings, setting)) continue;
        if (Object.hasOwn(newSettings, setting)) continue;

        logger.info(`Migrating plugin setting "${setting}" from ${oldPlugin} to ${newPlugin}`);

        newSettings[setting] = oldSettings[setting];
        delete oldSettings[setting];
    }

    SettingsStore.markAsChanged();
}

export function migrateOldSettingToNewPlugin(newPlugin: string, newSetting: string, oldPlugin: string, oldSetting: string) {
    const { plugins } = SettingsStore.plain;
    const oldSettings = plugins[oldPlugin];
    const newSettings = plugins[newPlugin];
    if (!oldSettings || !newSettings) return;

    if (!Object.hasOwn(oldSettings, oldSetting) || Object.hasOwn(newSettings, newSetting)) return;

    logger.info(`Migrating plugin setting "${oldSetting}" from ${oldPlugin} to "${newSetting}" on ${newPlugin}`);

    newSettings[newSetting] = oldSettings[oldSetting];
    delete oldSettings[oldSetting];
    SettingsStore.markAsChanged();
}

export function definePluginSettings<
    Def extends SettingsDefinition,
    Checks extends SettingsChecks<Def>,
    PrivateSettings extends object = {}
>(def: Def, checks?: Checks) {
    if (checks) {
        for (const [name, check] of Object.entries(checks)) {
            Object.assign(def[name], check);
        }
    }

    const definedSettings: DefinedSettings<Def, PrivateSettings> = {
        get store() {
            if (!definedSettings.pluginName) throw new Error("Cannot access settings before plugin is initialized");
            return Settings.plugins[definedSettings.pluginName] as any;
        },
        get plain() {
            if (!definedSettings.pluginName) throw new Error("Cannot access settings before plugin is initialized");
            return PlainSettings.plugins[definedSettings.pluginName] as any;
        },
        use: settings => useSettings((
            settings
                ? settings.map(name => `plugins.${definedSettings.pluginName}.${name}`)
                : [`plugins.${definedSettings.pluginName}.*`]
        ) as UseSettings<Settings>[]).plugins[definedSettings.pluginName] as any,
        def,
        pluginName: "",

        withPrivateSettings<T extends object>() {
            return this as DefinedSettings<Def, T>;
        }
    };

    return definedSettings;
}

type UseSettings<T extends object> = ResolveUseSettings<T>[keyof T];

type ResolveUseSettings<T extends object> = {
    [Key in keyof T]:
    Key extends string
    ? T[Key] extends Record<string, unknown>
    // @ts-expect-error "Type instantiation is excessively deep and possibly infinite"
    ? `${Key}.*` | (ResolveUseSettings<T[Key]> extends Record<string, string> ? `${Key}.${ResolveUseSettings<T[Key]>[keyof T[Key]]}` : never)
    : Key
    : never;
};
