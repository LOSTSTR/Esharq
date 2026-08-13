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
import { CategoryFilter } from "@components/settings/esharq/CategoryFilter";
import { PluginsHeader } from "@components/settings/esharq/PluginsHeader";
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
import { Alerts, ConfirmModal, lodash, openModal, Parser, React, Select, TextInput, Toasts, Tooltip, useCallback, useMemo, useRef, useState } from "@webpack/common";
import { JSX } from "react";

import Plugins, { ExcludedPlugins, PluginMeta } from "~plugins";

import { FORK_EXCLUSIVE_PLUGINS, PluginCard } from "./PluginCard";
import { openWarningModal } from "./PluginModal";
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

/**
 * بطاقة «إعادة التشغيل» — **تظهر عند الحاجة فقط**.
 *
 * كانت تحمل أيضاً عنوان الصفحة وشرحها وزرّ التعطيل الشامل حين لا حاجة
 * لإعادة تشغيل، أي أنها كانت بطاقة تحذير في حال ورأس صفحة في حال أخرى.
 * انتقل ذلك كلّه إلى `PluginsHeader`، فبقي لها عملها الواحد: أن تقول إن
 * تغييراً لن يسري قبل إعادة التشغيل. وتحذير يظهر دائماً لا يُقرأ.
 */
function ReloadRequiredCard({ required }: { required: boolean; }) {
    if (!required) return null;

    return (
        <Card className={classes(cl("info-card"), "vc-warning-card")}>
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
        </Card>
    );
}

const enum SearchStatus {
    ALL,
    FAVORITES,
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

            openModal(props => (
                <ConfirmModal
                    {...props}
                    title={t("إعادة تشغيل مطلوبة", "Restart required")}
                    confirmText={t("إعادة التشغيل الآن", "Restart now")}
                    cancelText={t("لاحقاً!", "Later!")}
                    variant="primary"
                    onConfirm={() => location.reload()}
                >
                    <>
                        <p>{t("الإضافات التالية تحتاج إعادة تشغيل:", "The following plugins require a restart:")}</p>
                        <div>
                            {displayed.map((s, i) => (
                                <React.Fragment key={i}>
                                    {i > 0 && t("، ", ", ")}
                                    {Parser.parse("`" + s + "`")}
                                </React.Fragment>
                            ))}
                            {remainingCount > 0 && <span> {t(`و${remainingCount} أخرى`, `and ${remainingCount} more`)}</span>}
                        </div>
                    </>
                </ConfirmModal>
            ));
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

    const sortedPlugins = useMemo(() =>
        Object.values(Plugins).sort((a, b) => a.name.localeCompare(b.name)),
        []
    )
        .toSorted((a, b) => Number(settings.plugins[b.name]?.isFavorite ?? false) - Number(settings.plugins[a.name]?.isFavorite ?? false));

    const hasUserPlugins = useMemo(() => !IS_STANDALONE && Object.values(PluginMeta).some(m => m.userPlugin), []);

    const [searchValue, setSearchValue] = useState({ value: "", tags: [] as PluginTag[], status: SearchStatus.ALL });

    const search = searchValue.value.toLowerCase();
    const onSearch = (query: string) => setSearchValue(prev => ({ ...prev, value: query }));

    const pluginFilter = useCallback((plugin: typeof Plugins[keyof typeof Plugins], newPluginsSet: Set<string> | null) => {
        const { status, tags } = searchValue;

        switch (status) {
            case SearchStatus.FAVORITES:
                if (!settings.plugins[plugin.name]?.isFavorite) return false;
                break;
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
                if (!FORK_EXCLUSIVE_PLUGINS.has(plugin.name)
                    && !PluginMeta[plugin.name].folderName.startsWith("src/userplugins/")
                    && !PluginMeta[plugin.name].folderName.startsWith("src/esharqplugins/")) return false;
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
            plugin.searchTerms?.some(t => t.toLowerCase().includes(search)) ||
            // بالمؤلّف أيضاً: مع 458 إضافة يصير «ما الذي كتبه فلان؟» سؤالاً
            // حقيقياً، وكان جوابه قبل ذلك فتح البطاقات واحدة واحدة.
            plugin.authors?.some(author => author.name.toLowerCase().includes(search))
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

    /**
     * إعادة الضبط الافتراضي — **إلى ما تُشحن به إشراق، لا إلى الفراغ**.
     *
     * «عطّل الكل» يترك المستخدم بعميل خامد؛ وهذا يُعيده إلى نقطة معروفة:
     * ما كان مُفعَّلاً يوم ثبّت.
     *
     * 🔴 **لا يمسّ إعدادات الإضافات نفسها**: يُعيد ما هو مُفعَّل فقط. محو
     * ما ضبطه المستخدم داخل كل إضافة خسارة لا رجعة فيها، ولم يطلبها من
     * ضغط زرّاً اسمه «الضبط الافتراضي».
     *
     * ويُطلَب التأكيد صراحةً: فعل يُغيّر عشرات الإضافات دفعة واحدة لا يقع
     * بنقرة واحدة.
     */
    function restoreDefaultConfiguration() {
        const changed = Object.keys(Plugins).filter(name => {
            const wanted = Boolean(Plugins[name].required || Plugins[name].enabledByDefault);
            return isPluginEnabled(name) !== wanted;
        });

        if (changed.length === 0) {
            Toasts.show({
                message: t("إعداداتك مطابقة للافتراضي أصلاً.", "Your setup already matches the defaults."),
                type: Toasts.Type.MESSAGE,
                id: Toasts.genId(),
                options: { position: Toasts.Position.BOTTOM }
            });
            return;
        }

        Alerts.show({
            title: t("إعادة الضبط الافتراضي", "Restore default configuration"),
            body: (
                <>
                    <p style={{ textAlign: "center" }}>
                        {t(`سيتغيّر تفعيل ${changed.length} إضافة لتعود إلى ما تُشحن به إشراق.`,
                            `${changed.length} plugins will change state to match what Esharq ships with.`)}
                    </p>
                    <p style={{ textAlign: "center" }}>
                        {t("إعداداتك داخل كل إضافة تبقى كما هي.", "Your settings inside each plugin are left untouched.")}
                    </p>
                </>
            ),
            confirmText: t("أعِد الضبط", "Restore"),
            cancelText: t("إلغاء", "Cancel"),
            onConfirm: () => {
                for (const name of changed) {
                    settings.plugins[name].enabled = Boolean(Plugins[name].required || Plugins[name].enabledByDefault);
                    changes.handleChange(name);
                }
                Alerts.show({
                    title: t("إعادة تشغيل مطلوبة", "Restart required"),
                    body: <p style={{ textAlign: "center" }}>
                        {t("يسري التغيير بعد إعادة التشغيل.", "The change applies after a restart.")}
                    </p>,
                    confirmText: t("إعادة التشغيل الآن", "Restart now"),
                    cancelText: t("لاحقاً", "Later"),
                    onConfirm: () => location.reload()
                });
            }
        });
    }

    const { totalStockPlugins, totalUserPlugins, totalEsharqPlugins, enabledStockPlugins, enabledUserPlugins, enabledPlugins } = useMemo(() => {
        const isApiPlugin = (plugin: string) => plugin.endsWith("API") || Plugins[plugin].required;

        const totalPlugins = Object.keys(Plugins).filter(p => !isApiPlugin(p));
        const enabledPlugins = Object.keys(Plugins).filter(p => isPluginEnabled(p) && !isApiPlugin(p));

        // إضافات إشراق: تُعرف بمجلدها لا باسمها — نفس مصدر شارة الفرع.
        const totalEsharqPlugins = totalPlugins.filter(p =>
            PluginMeta[p].folderName?.startsWith("src/esharqplugins/") && !Plugins[p].hidden).length;

        const totalStockPlugins = totalPlugins.filter(p => !PluginMeta[p].userPlugin && !Plugins[p].hidden).length;
        const totalUserPlugins = totalPlugins.filter(p => PluginMeta[p].userPlugin).length;
        const enabledStockPlugins = enabledPlugins.filter(p => !PluginMeta[p].userPlugin).length;
        const enabledUserPlugins = enabledPlugins.filter(p => PluginMeta[p].userPlugin).length;
        return { totalStockPlugins, totalUserPlugins, totalEsharqPlugins, enabledStockPlugins, enabledUserPlugins, enabledPlugins };
    }, [settings.plugins]);

    /** كم إضافة في كل فئة — يُحسب مرّة، فاللوحة تعرضه بلا مرور جديد. */
    const categoryCounts = useMemo(() => {
        const out: Record<string, number> = {};
        for (const name in Plugins) {
            for (const tag of Plugins[name].tags ?? []) out[tag] = (out[tag] ?? 0) + 1;
        }
        return out;
    }, []);

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
            <ReloadRequiredCard required={changes.hasChanges} />

            <PluginsHeader
                total={totalStockPlugins + totalUserPlugins}
                enabled={enabledStockPlugins + enabledUserPlugins}
                esharq={totalEsharqPlugins}
                userPlugins={totalUserPlugins}
                onDisableAll={() => openWarningModal(null, undefined, false, enabledPlugins.length, resetCheckAndDo)}
                onRestoreDefaults={restoreDefaultConfiguration}
            />

            <div className={cl("ui-elements")}>
                <UIElementsButton />
            </div>

            <div className={classes(Margins.top20, Margins.bottom8)}
                style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <HeadingTertiary>{t("الفلاتر", "Filters")}</HeadingTertiary>
                {/* 🔴 عدّاد النتيجة: بدونه لا يعرف من ضيّق البحث إن كان الترشيح
                    وقع أصلاً أم أن ما يراه هو كل شيء. */}
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {t(`${plugins.length} ظاهرة من ${totalStockPlugins + totalUserPlugins}`,
                        `${plugins.length} shown of ${totalStockPlugins + totalUserPlugins}`)}
                </span>
            </div>

            <ErrorBoundary noop>
                {/* الغلاف `label` كي يفتح النقرُ على الأيقونة الحقلَ ويُركّزه —
                    وإلّا صارت مساحة الأيقونة ميتة في الحالة المطويّة. */}
                <label className="esharq-search">
                    <svg className="esharq-search-icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="currentColor" d="M21.707 20.293 16.314 14.9a8.019 8.019 0 1 0-1.414 1.414l5.393 5.393a1 1 0 0 0 1.414-1.414ZM10 16a6 6 0 1 1 6-6 6.007 6.007 0 0 1-6 6Z" />
                    </svg>
                    <TextInput
                        inputClassName={cl("filter-control")}
                        placeholder={t("ابحث بالاسم أو الوصف أو المؤلّف…", "Search by name, description or author…")}
                        value={searchValue.value}
                        onChange={onSearch}
                    />
                </label>
            </ErrorBoundary>

            <ErrorBoundary noop>
                <div className={classes(Margins.bottom20, Margins.top8, cl("filter-controls"))}>
                    <Select
                        options={[
                            { label: t("عرض الكل", "Show All"), value: SearchStatus.ALL, default: true },
                            { label: t("عرض المفضّلة", "Show Favorites"), value: SearchStatus.FAVORITES },
                            { label: t("عرض المفعَّلة", "Show Enabled"), value: SearchStatus.ENABLED },
                            { label: t("عرض المعطَّلة", "Show Disabled"), value: SearchStatus.DISABLED },
                            { label: t("عرض Esharq", "Show Esharq"), value: SearchStatus.ESHARQ },
                            { label: t("عرض Equicord", "Show Equicord"), value: SearchStatus.EQUICORD },
                            { label: t("عرض Vencord", "Show Vencord"), value: SearchStatus.VENCORD },
                            { label: t("عرض الجديدة", "Show New"), value: SearchStatus.NEW },
                            hasUserPlugins && { label: t("عرض الإضافات الشخصية", "Show UserPlugins"), value: SearchStatus.USER_PLUGINS },
                            { label: t("عرض إضافات API", "Show API Plugins"), value: SearchStatus.API_PLUGINS },
                        ].filter(isTruthy)}
                        serialize={String}
                        select={status => setSearchValue(prev => ({ ...prev, status }))}
                        isSelected={v => v === searchValue.status}
                        closeOnSelect={true}
                        placeholder={t("المصدر والحالة", "Source and state")}
                    />
                    <CategoryFilter
                        categories={PluginTags}
                        counts={categoryCounts}
                        selected={searchValue.tags}
                        onChange={tags => setSearchValue(prev => ({ ...prev, tags: tags as PluginTag[] }))}
                        label={tag => tag}
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
