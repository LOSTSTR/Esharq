/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotice } from "@api/Notices";
import { hasAnyVisibleSettings, isHiddenByBisect, isPluginEnabled, pluginRequiresRestart, startDependenciesRecursive, startPlugin, stopPlugin } from "@api/PluginManager";
import { Settings, useSettings } from "@api/Settings";
import { CogWheel, InfoIcon } from "@components/Icons";
import { AddonCard } from "@components/settings/AddonCard";
import { classNameFactory } from "@utils/css";
import { t } from "@utils/esharqI18n";
import { resolvePluginDescription } from "@utils/i18n";
import { Logger } from "@utils/Logger";
import { Plugin } from "@utils/types";
import { React, showToast, Toasts } from "@webpack/common";

import { PluginMeta } from "~plugins";

import { openPluginModal } from "./PluginModal";

const logger = new Logger("PluginCard");
const cl = classNameFactory("vc-plugins-");
interface PluginCardProps extends React.HTMLProps<HTMLDivElement> {
    plugin: Plugin;
    disabled?: boolean;
    onRestartNeeded(name: string, key: string): void;
    isNew?: boolean;
    onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
}

export const FORK_EXCLUSIVE_PLUGINS = new Set([
    "ArabicAutoUpdater",
    // 🔴 محرّك التعريب من إشراق، لكنه يسكن `src/plugins/_core/` **بالضرورة**:
    // يجب أن يُستورَد قبل تطبيق أي رقعة، فمكانه النواة لا `esharqplugins`.
    // ولذلك رآه المكوّن إضافةً من فينكورد فعلّق عليها شارتها — شارة خاطئة
    // على أخصّ ما بنيناه. والانتماء يُعلَن هنا حين لا يدلّ عليه المسار.
    "EsharqArabicLocale",
]);

const USERPLUGINS_ICON_URI = "data:image/png;base64,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";

export function PluginCard({ plugin, disabled, onRestartNeeded, onMouseEnter, onMouseLeave, isNew }: PluginCardProps) {
    // Subscribe so the card re-renders on language toggle (resolvePluginDescription
    // reads the mode but does not itself establish a React subscription).
    useSettings(["plugins.Settings.arabicMode"]);
    const displayDescription = resolvePluginDescription(plugin.name, plugin.description);

    const settings = Settings.plugins[plugin.name];
    const pluginMeta = PluginMeta[plugin.name];
    const folderName = pluginMeta?.folderName ?? "";
    const isEquicordPlugin = folderName.startsWith("src/equicordplugins/");
    const isVencordPlugin = folderName.startsWith("src/plugins/");
    const isUserPlugin = folderName.startsWith("src/userplugins/");
    // إضافات إشراق نفسها: تحمل الشارة كإضافات الفرع، ولا تُحسب «شخصية».
    const isEsharqPlugin = folderName.startsWith("src/esharqplugins/");
    const isModifiedPlugin = plugin.isModified ?? false;
    const isForkExclusive = FORK_EXCLUSIVE_PLUGINS.has(plugin.name);
    const isForkBranded = isForkExclusive || isUserPlugin || isEsharqPlugin;

    const isEnabled = () => isPluginEnabled(plugin.name);

    /**
     * 🔴 جلسة تنصيفٍ جارية تُخفي هذه الإضافة.
     *
     * وهذا كان يُنتج مفتاحاً **يكذب**: `isPluginEnabled` يُرجع `false` لأنّ
     * التنصيف يعلو على كل شيء، فالضغط يُسند `enabled = !false` أي `true` —
     * وهي `true` في الإعدادات أصلاً، فيقصر مخزن الإعدادات ولا يكتب ولا يُنبّه.
     * النتيجة: بطاقةٌ مُطفأة، وضغطةٌ لا تفعل شيئاً، ولا سطر يقول لماذا.
     * وحتى الإضافات الضرورية تُطفأ هكذا — قِسته.
     *
     * الآن يُعطَّل المفتاح ويُقال السبب في التلميح، فلا يظنّ صاحبه أنّ إشراق
     * تعطّل. وإنهاء الجلسة من صفحة «تنصيف الانهيار».
     */
    const hiddenByBisect = isHiddenByBisect(plugin.name);

    function toggleEnabled() {
        // لا يُلمَس شيء ما دامت الجلسة تُخفيها: الإعدادات على حالها، والعرض
        // وحده مُعطَّل — فكتابةٌ هنا تُفسد ما سيعود بعد انتهاء التنصيف.
        if (hiddenByBisect) return;

        const wasEnabled = isEnabled();

        // If we're enabling a plugin, make sure all deps are enabled recursively.
        if (!wasEnabled) {
            const { restartNeeded, failures } = startDependenciesRecursive(plugin);

            if (failures.length) {
                logger.error(`Failed to start dependencies for ${plugin.name}: ${failures.join(", ")}`);
                showNotice("Failed to start dependencies: " + failures.join(", "), "Close", () => null);
                return;
            }

            if (restartNeeded) {
                // If any dependencies have patches, don't start the plugin yet.
                settings.enabled = true;
                onRestartNeeded(plugin.name, "enabled");
                return;
            }
        }

        // if the plugin requires a restart, don't use stopPlugin/startPlugin. Wait for restart to apply changes.
        if (pluginRequiresRestart(plugin)) {
            settings.enabled = !wasEnabled;
            onRestartNeeded(plugin.name, "enabled");
            return;
        }

        // If the plugin is enabled, but hasn't been started, then we can just toggle it off.
        if (wasEnabled && !plugin.started) {
            settings.enabled = !wasEnabled;
            return;
        }

        const result = wasEnabled ? stopPlugin(plugin) : startPlugin(plugin);

        if (!result) {
            settings.enabled = false;

            const msg = `Error while ${wasEnabled ? "stopping" : "starting"} plugin ${plugin.name}`;
            showToast(msg, Toasts.Type.FAILURE, {
                position: Toasts.Position.BOTTOM,
            });

            return;
        }

        settings.enabled = !wasEnabled;
    }

    const pluginInfo = [
        {
            condition: isModifiedPlugin,
            src: "https://equicord.org/assets/icons/equicord/modified.png",
            alt: "Modified",
            title: "Modified Vencord Plugin"
        },
        {
            // 🔴 الاسم إنجليزي دائماً كأخواته («Equicord Plugin» و«Vencord
            // Plugin»): هذه أسماء مشاريع لا عبارات تُترجَم، وتعريب واحدة
            // منها وحدها يجعل الثلاثة تبدو ثلاثة أنظمة لا صفّاً واحداً.
            condition: isForkBranded,
            src: USERPLUGINS_ICON_URI,
            alt: "Esharq",
            title: "Esharq Plugin"
        },
        {
            condition: isEquicordPlugin,
            src: "https://equicord.org/assets/favicon.png",
            alt: "Equicord",
            title: "Equicord Plugin"
        },
        {
            condition: isVencordPlugin,
            src: "https://equicord.org/assets/icons/vencord/icon-light.png",
            alt: "Vencord",
            title: "Vencord Plugin"
        }
    ];

    const pluginDetails = pluginInfo.find(p => p.condition);

    const sourceBadge = pluginDetails ? (
        <img
            src={pluginDetails.src}
            alt={pluginDetails.alt}
            className={cl("source")}
        />
    ) : null;

    // 🔴 اسم المصدر يبقى على شارته — لا يُمحى بشرحٍ آخر.
    const tooltip = pluginDetails?.title || "Unknown Plugin";

    // والشرح يوضع على المفتاح نفسه، وهو ما يُحوّم عليه من يراه رمادياً.
    const toggleTooltip = hiddenByBisect
        ? t("مخفيّة مؤقّتاً بجلسة تنصيف انهيار. إعداداتك لم تتغيّر — تعود بعد إعادة تشغيل إشراق.",
            "Temporarily hidden by a crash-bisect session. Your settings are untouched — it returns after you restart Esharq.")
        : undefined;

    return (
        <AddonCard
            name={plugin.name}
            sourceBadge={sourceBadge}
            tooltip={tooltip}
            toggleTooltip={toggleTooltip}
            description={displayDescription}
            tags={plugin.tags}
            isNew={isNew}
            enabled={isEnabled()}
            setEnabled={toggleEnabled}
            disabled={disabled || hiddenByBisect}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            infoButton={
                <button
                    role="switch"
                    onClick={() => openPluginModal(plugin, onRestartNeeded)}
                    className={cl("info-button")}
                >
                    {hasAnyVisibleSettings(plugin)
                        ? <CogWheel className={cl("info-icon")} />
                        : <InfoIcon className={cl("info-icon")} />
                    }
                </button>
            } />
    );
}
