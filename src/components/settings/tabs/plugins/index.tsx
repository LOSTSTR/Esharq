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

import "./styles.css";

import * as DataStore from "@api/DataStore";
import { isPluginEnabled, stopPlugin } from "@api/PluginManager";
import { useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { Divider } from "@components/Divider";
import ErrorBoundary from "@components/ErrorBoundary";
import { HeadingTertiary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab } from "@components/settings";
import { debounce } from "@shared/debounce";
import { ChangeList } from "@utils/ChangeList";
import { classNameFactory } from "@utils/css";
import { t } from "@utils/esharqI18n";
import { isTruthy } from "@utils/guards";
import { Logger } from "@utils/Logger";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { useAwaiter, useCleanupEffect, useIntersection } from "@utils/react";
import { PluginTag, PluginTags } from "@utils/types";
import { Alerts, lodash, Parser, React, SearchableSelect, Select, TextInput, Toasts, Tooltip, useCallback, useMemo, useRef, useState } from "@webpack/common";
import { JSX } from "react";

import Plugins, { ExcludedPlugins, PluginMeta } from "~plugins";

import { FORK_EXCLUSIVE_PLUGINS, PluginCard } from "./PluginCard";
import { openWarningModal } from "./PluginModal";
import { StockPluginsCard, UserPluginsCard } from "./PluginStatCards";
import { UIElementsButton } from "./UIElements";

export const cl = classNameFactory("vc-plugins-");
export const logger = new Logger("PluginSettings", "#a6d189");

function showErrorToast(message: string) {
    Toasts.show({
        message,
        type: Toasts.Type.FAILURE,
        id: Toasts.genId(),
        options: {
            position: Toasts.Position.BOTTOM
        }
    });
}

function ReloadRequiredCard({ required, enabledPlugins, openWarningModal, resetCheckAndDo }) {
    return (
        <Card className={classes(cl("info-card"), required && "vc-warning-card")}>
            {required ? (
                <>
                    <HeadingTertiary>{t("إعادة تشغيل مطلوبة!", "Restart Required!")}</HeadingTertiary>
                    <Paragraph className={cl("dep-text")}>
                        {t(
                            "أعد التشغيل الآن لتطبيق الإضافات الجديدة وإعداداتها",
                            "Restart now to apply the new plugins and their settings"
                        )}
                    </Paragraph>
                    <Button variant="primary" className={cl("restart-button")} onClick={() => location.reload()}>
                        {t("إعادة التشغيل", "Restart")}
                    </Button>
                </>
            ) : (
                <>
                    <HeadingTertiary>{t("إدارة الإضافات", "Manage Plugins")}</HeadingTertiary>
                    <Paragraph>{t(
                        "اضغط على أيقونة الإعدادات أو المعلومات للاطلاع على تفاصيل الإضافة",
                        "Click the settings or info icon to see plugin details"
                    )}</Paragraph>
                    <Paragraph>{t(
                        "الإضافات ذات أيقونة التروس تحتوي على إعدادات قابلة للتخصيص!",
                        "Plugins with a gear icon have configurable settings!"
                    )}</Paragraph>
                </>
            )}
            {enabledPlugins.length > 0 && !required && (
                <Button
                    variant="secondary"
                    size="small"
                    className={"vc-plugins-disable-warning vc-modal-align-reset"}
                    onClick={() => {
                        return openWarningModal(null, undefined, false, enabledPlugins.length, resetCheckAndDo);
                    }}
                >
                    {t("تعطيل كل الإضافات", "Disable All Plugins")}
                </Button>
            )}
        </Card>
    );
}

const enum SearchStatus {
    ALL,
    ENABLED,
    DISABLED,
    EQUICORD,
    VENCORD,
    NEW,
    USER_PLUGINS,
    API_PLUGINS,
    ESHARQ
}

export const ExcludedReasons: Record<"web" | "discordDesktop" | "vesktop" | "equibop" | "desktop" | "dev", string> = {
    desktop: t("تطبيق Discord Desktop أو Vesktop/Equibop", "Discord Desktop or Vesktop/Equibop"),
    discordDesktop: t("تطبيق Discord Desktop", "Discord Desktop"),
    vesktop: t("تطبيقات Vesktop/Equibop", "Vesktop/Equibop"),
    equibop: t("تطبيقات Vesktop/Equibop", "Vesktop/Equibop"),
    web: t("تطبيقات Vesktop/Equibop ومتصفح Discord", "Vesktop/Equibop and Discord web"),
    dev: t("إصدار المطورين من اشراق", "Esharq dev build")
};

function ExcludedPluginsList({ search }: { search: string; }) {
    const matchingExcludedPlugins = search
        ? Object.entries(ExcludedPlugins)
            .filter(([name]) => name.toLowerCase().includes(search))
        : [];

    return (
        <Paragraph className={Margins.top16}>
            {matchingExcludedPlugins.length
                ? <>
                    <Paragraph>{t("هل تبحث عن:", "Are you looking for:")}</Paragraph>
                    <ul>
                        {matchingExcludedPlugins.map(([name, reason]) => (
                            <li key={name}>
                                <b>{name}</b>: {t("متاحة فقط على", "only available on")} {ExcludedReasons[reason]}
                            </li>
                        ))}
                    </ul>
                </>
                : t("لا توجد إضافات تطابق معايير البحث.", "No plugins match your search criteria.")
            }
        </Paragraph>
    );
}

export default function PluginSettings() {
    const settings = useSettings();
    useSettings(["plugins.Settings.arabicMode"]);

    const changeRef = useRef<ChangeList<string>>(null);
    const changes = changeRef.current ??= new ChangeList<string>();

    useCleanupEffect(() => {
        return () => {
            if (!changes.hasChanges) return;

            const allChanges = [...changes.getChanges()];
            const pluginNames = [...new Set(allChanges.map(s => s.split(":")[0]))];
            const maxDisplay = 15;
            const displayed = pluginNames.slice(0, maxDisplay);
            const remainingCount = pluginNames.length - displayed.length;

            Alerts.show({
                title: t("إعادة تشغيل مطلوبة", "Restart Required"),
                body: (
                    <div>
                        {displayed.map((s, i) => (
                            <span key={i}>
                                {i > 0 && "، "}
                                {Parser.parse("`" + s + "`")}
                            </span>
                        ))}
                        {remainingCount > 0 && <span> {t(`و${remainingCount} أخرى`, `and ${remainingCount} more`)}</span>}
                    </div>
                ),
                confirmText: t("إعادة التشغيل الآن", "Restart Now"),
                cancelText: t("لاحقاً!", "Later!"),
                onConfirm: () => location.reload()
            });
        };
    }, []);

    const depMap = useMemo(() => {
        const o = {} as Record<string, string[]>;
        for (const plugin in Plugins) {
            const deps = Plugins[plugin].dependencies;
            if (deps) {
                for (const dep of deps) {
                    o[dep] ??= [];
                    o[dep].push(plugin);
                }
            }
        }
        return o;
    }, []);

    const sortedPlugins = useMemo(() => Object.values(Plugins)
        .sort((a, b) => a.name.localeCompare(b.name)), []);

    const hasUserPlugins = useMemo(() => !IS_STANDALONE && Object.values(PluginMeta).some(m => m.userPlugin), []);

    const [searchValue, setSearchValue] = useState({ value: "", tags: [] as PluginTag[], status: SearchStatus.ALL });

    const search = searchValue.value.toLowerCase();
    const onSearch = (query: string) => setSearchValue(prev => ({ ...prev, value: query }));

    const pluginFilter = useCallback((plugin: typeof Plugins[keyof typeof Plugins], newPluginsSet: Set<string> | null) => {
        const { status, tags } = searchValue;

        switch (status) {
            case SearchStatus.DISABLED:
                if (isPluginEnabled(plugin.name)) return false;
                break;
            case SearchStatus.ENABLED:
                if (!isPluginEnabled(plugin.name)) return false;
                break;
            case SearchStatus.EQUICORD:
                if (!PluginMeta[plugin.name].folderName.startsWith("src/equicordplugins/")) return false;
                // Esharq-branded plugins live here too but belong under "Show Esharq", not Equicord.
                if (FORK_EXCLUSIVE_PLUGINS.has(plugin.name)) return false;
                break;
            case SearchStatus.ESHARQ:
                // Esharq-branded plugins only — same predicate that shows the EA badge
                // in PluginCard (isForkBranded = fork-exclusive OR userplugin).
                if (!FORK_EXCLUSIVE_PLUGINS.has(plugin.name) && !PluginMeta[plugin.name].folderName.startsWith("src/userplugins/")) return false;
                break;
            case SearchStatus.VENCORD:
                if (!PluginMeta[plugin.name].folderName.startsWith("src/plugins/")) return false;
                break;
            case SearchStatus.NEW:
                if (!newPluginsSet?.has(plugin.name)) return false;
                break;
            case SearchStatus.USER_PLUGINS:
                if (!PluginMeta[plugin.name]?.userPlugin) return false;
                break;
            case SearchStatus.API_PLUGINS:
                if (!plugin.name.endsWith("API")) return false;
                break;
        }

        if (tags.length && tags.some(t => !plugin.tags?.includes(t))) return false;

        if (!search.length) return true;

        return (
            plugin.name.toLowerCase().includes(search.replace(/\s+/g, "")) ||
            plugin.name.match(/[A-Z]/g)?.join("").toLowerCase().includes(search) ||
            plugin.description.toLowerCase().includes(search) ||
            plugin.searchTerms?.some(t => t.toLowerCase().includes(search))
        );
    }, [searchValue, search]);

    const [newPluginsSet] = useAwaiter(() => DataStore.get("Vencord_existingPlugins").then((cachedPlugins: Record<string, number> | undefined) => {
        const now = Date.now() / 1000;
        const existingTimestamps: Record<string, number> = {};
        const sortedPluginNames = Object.values(sortedPlugins).map(plugin => plugin.name);

        const newPlugins: string[] = [];
        for (const { name: p } of sortedPlugins) {
            const time = existingTimestamps[p] = cachedPlugins?.[p] ?? now;
            if ((time + 60 * 60 * 24 * 2) > now) {
                newPlugins.push(p);
            }
        }
        DataStore.set("Vencord_existingPlugins", existingTimestamps);

        return lodash.isEqual(newPlugins, sortedPluginNames) ? null : new Set(newPlugins);
    }));

    const handleRestartNeeded = useCallback((name: string, key: string) => changes.handleChange(`${name}:${key}`), [changes]);

    const { plugins, requiredPlugins } = useMemo(() => {
        const plugins = [] as JSX.Element[];
        const requiredPlugins = [] as JSX.Element[];

        const showApi = searchValue.status === SearchStatus.API_PLUGINS;
        for (const p of sortedPlugins) {
            if (p.hidden || (!p.settings?.def && p.name.endsWith("API") && !showApi))
                continue;

            if (!pluginFilter(p, newPluginsSet)) continue;

            const isRequired = p.required || p.isDependency || depMap[p.name]?.some(d => settings.plugins[d].enabled);

            if (isRequired) {
                const tooltipText = p.required || !depMap[p.name]
                    ? t("هذه الإضافة ضرورية لعمل Esharq.", "This plugin is required for Esharq to function.")
                    : <PluginDependencyList deps={depMap[p.name]?.filter(d => settings.plugins[d].enabled)} />;

                requiredPlugins.push(
                    <Tooltip text={tooltipText} key={p.name}>
                        {({ onMouseLeave, onMouseEnter }) => (
                            <PluginCard
                                onMouseLeave={onMouseLeave}
                                onMouseEnter={onMouseEnter}
                                onRestartNeeded={handleRestartNeeded}
                                disabled={true}
                                plugin={p}
                            />
                        )}
                    </Tooltip>
                );
            } else {
                plugins.push(
                    <PluginCard
                        onRestartNeeded={handleRestartNeeded}
                        disabled={false}
                        plugin={p}
                        isNew={newPluginsSet?.has(p.name)}
                        key={p.name}
                    />
                );
            }
        }
        return { plugins, requiredPlugins };
    }, [sortedPlugins, searchValue, newPluginsSet, depMap, settings.plugins, pluginFilter, handleRestartNeeded]);

    function resetCheckAndDo() {
        let restartNeeded = false;

        for (const plugin of enabledPlugins) {
            const pluginSettings = settings.plugins[plugin];

            if (Plugins[plugin].patches?.length) {
                pluginSettings.enabled = false;
                changes.handleChange(plugin);
                restartNeeded = true;
                continue;
            }

            const result = stopPlugin(Plugins[plugin]);

            if (!result) {
                logger.error(`Error while stopping plugin ${plugin}`);
                showErrorToast(`Error while stopping plugin ${plugin}`);
                continue;
            }

            pluginSettings.enabled = false;
        }

        if (restartNeeded) {
            Alerts.show({
                title: t("إعادة تشغيل مطلوبة", "Restart Required"),
                body: (
                    <>
                        <p style={{ textAlign: "center" }}>{t("بعض الإضافات تستلزم إعادة تشغيل لتعطيلها كلياً.", "Some plugins require a restart to be fully disabled.")}</p>
                        <p style={{ textAlign: "center" }}>{t("هل تريد إعادة التشغيل الآن؟", "Do you want to restart now?")}</p>
                    </>
                ),
                confirmText: t("إعادة التشغيل الآن", "Restart Now"),
                cancelText: t("لاحقاً", "Later"),
                onConfirm: () => location.reload()
            });
        }
    }

    const { totalStockPlugins, totalUserPlugins, enabledStockPlugins, enabledUserPlugins, enabledPlugins } = useMemo(() => {
        const isApiPlugin = (plugin: string) => plugin.endsWith("API") || Plugins[plugin].required;

        const totalPlugins = Object.keys(Plugins).filter(p => !isApiPlugin(p));
        const enabledPlugins = Object.keys(Plugins).filter(p => isPluginEnabled(p) && !isApiPlugin(p));

        const totalStockPlugins = totalPlugins.filter(p => !PluginMeta[p].userPlugin && !Plugins[p].hidden).length;
        const totalUserPlugins = totalPlugins.filter(p => PluginMeta[p].userPlugin).length;
        const enabledStockPlugins = enabledPlugins.filter(p => !PluginMeta[p].userPlugin).length;
        const enabledUserPlugins = enabledPlugins.filter(p => PluginMeta[p].userPlugin).length;
        return { totalStockPlugins, totalUserPlugins, enabledStockPlugins, enabledUserPlugins, enabledPlugins };
    }, [settings.plugins]);

    const pluginsToLoad = Math.min(36, plugins.length);
    const [visibleCount, setVisibleCount] = React.useState(pluginsToLoad);
    const loadMore = React.useCallback(() => {
        setVisibleCount(v => Math.min(v + pluginsToLoad, plugins.length));
    }, [plugins.length]);

    const dLoadMore = useMemo(() => debounce(loadMore, 100), [loadMore]);

    const [sentinelRef, isSentinelVisible] = useIntersection();
    React.useEffect(() => {
        if (isSentinelVisible && visibleCount < plugins.length) {
            dLoadMore();
        }
    }, [isSentinelVisible, visibleCount, plugins.length, dLoadMore]);

    const visiblePlugins = plugins.slice(0, visibleCount);

    return (
        <SettingsTab>
            <ReloadRequiredCard required={changes.hasChanges} enabledPlugins={enabledPlugins} openWarningModal={openWarningModal} resetCheckAndDo={resetCheckAndDo} />

            <div className={cl("stats-container")}>
                <StockPluginsCard
                    totalStockPlugins={totalStockPlugins}
                    enabledStockPlugins={enabledStockPlugins}
                />
                <UserPluginsCard
                    totalUserPlugins={totalUserPlugins}
                    enabledUserPlugins={enabledUserPlugins}
                />
            </div>

            <div className={cl("ui-elements")}>
                <UIElementsButton />
            </div>

            <HeadingTertiary className={classes(Margins.top20, Margins.bottom8)}>
                {t("الفلاتر", "Filters")}
            </HeadingTertiary>

            <ErrorBoundary noop>
                <TextInput
                    inputClassName={cl("filter-control")}
                    placeholder={t("ابحث عن إضافة...", "Search for a plugin...")}
                    value={searchValue.value}
                    onChange={onSearch}
                    autoFocus
                />
            </ErrorBoundary>

            <ErrorBoundary noop>
                <div className={classes(Margins.bottom20, Margins.top8, cl("filter-controls"))}>
                    <Select
                        options={[
                            { label: t("عرض الكل", "Show All"), value: SearchStatus.ALL, default: true },
                            { label: t("عرض المفعَّلة", "Show Enabled"), value: SearchStatus.ENABLED },
                            { label: t("عرض المعطَّلة", "Show Disabled"), value: SearchStatus.DISABLED },
                            { label: t("عرض اشراق", "Show Esharq"), value: SearchStatus.ESHARQ },
                            { label: t("عرض Equicord", "Show Equicord"), value: SearchStatus.EQUICORD },
                            { label: t("عرض Vencord", "Show Vencord"), value: SearchStatus.VENCORD },
                            { label: t("عرض الجديدة", "Show New"), value: SearchStatus.NEW },
                            hasUserPlugins && { label: t("عرض الإضافات الشخصية", "Show User Plugins"), value: SearchStatus.USER_PLUGINS },
                            { label: t("عرض إضافات API", "Show API Plugins"), value: SearchStatus.API_PLUGINS },
                        ].filter(isTruthy)}
                        serialize={String}
                        select={status => setSearchValue(prev => ({ ...prev, status }))}
                        isSelected={v => v === searchValue.status}
                        closeOnSelect={true}
                        placeholder={t("تصفية حسب النوع", "Filter by type")}
                    />
                    <SearchableSelect
                        options={PluginTags.map(tag => ({ label: tag, value: tag }))}
                        value={searchValue.tags}
                        onChange={tags => setSearchValue(prev => ({ ...prev, tags }))}
                        closeOnSelect={false}
                        placeholder={t("تصفية حسب الوسوم", "Filter by tags")}
                        multi
                    />
                </div>
            </ErrorBoundary>

            <HeadingTertiary className={Margins.top20}>{t("الإضافات", "Plugins")}</HeadingTertiary>

            {plugins.length || requiredPlugins.length
                ? (
                    <>
                        <div className={cl("grid")}>
                            {visiblePlugins.length
                                ? visiblePlugins
                                : <Paragraph>{t("لا توجد إضافات تطابق معايير البحث.", "No plugins match your search criteria.")}</Paragraph>
                            }
                        </div>
                        {visibleCount < plugins.length && (
                            <div ref={sentinelRef} style={{ height: 32 }} />
                        )}
                    </>
                )
                : <ExcludedPluginsList search={search} />
            }

            <Divider className={Margins.top20} />

            <HeadingTertiary className={classes(Margins.top20, Margins.bottom8)}>
                {t("الإضافات المطلوبة", "Required Plugins")}
            </HeadingTertiary>

            <div className={cl("grid")}>
                {requiredPlugins.length
                    ? requiredPlugins
                    : <Paragraph>{t("لا توجد إضافات تطابق معايير البحث.", "No plugins match your search criteria.")}</Paragraph>
                }
            </div>
        </SettingsTab >
    );
}

export function PluginDependencyList({ deps }: { deps: string[]; }) {
    return (
        <>
            <Paragraph>{t("هذه الإضافة مطلوبة من قِبَل:", "This plugin is required by:")}</Paragraph>
            {deps.map((dep: string) => <Paragraph key={dep} className={cl("dep-text")}>{dep}</Paragraph>)}
        </>
    );
}
