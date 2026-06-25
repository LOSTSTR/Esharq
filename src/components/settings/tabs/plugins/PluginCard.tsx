/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotice } from "@api/Notices";
import { hasAnyVisibleSettings, isPluginEnabled, pluginRequiresRestart, startDependenciesRecursive, startPlugin, stopPlugin } from "@api/PluginManager";
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

const FORK_EXCLUSIVE_PLUGINS = new Set([
    "ArabicAutoUpdater",
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
    const isModifiedPlugin = plugin.isModified ?? false;
    const isForkExclusive = FORK_EXCLUSIVE_PLUGINS.has(plugin.name);
    const isForkBranded = isForkExclusive || isUserPlugin;

    const isEnabled = () => isPluginEnabled(plugin.name);

    function toggleEnabled() {
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
            condition: isForkBranded,
            src: USERPLUGINS_ICON_URI,
            alt: t("اشراق", "Esharq"),
            title: t("حصري لاشراق", "Esharq Exclusive")
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

    const tooltip = pluginDetails?.title || "Unknown Plugin";

    return (
        <AddonCard
            name={plugin.name}
            sourceBadge={sourceBadge}
            tooltip={tooltip}
            description={displayDescription}
            isNew={isNew}
            enabled={isEnabled()}
            setEnabled={toggleEnabled}
            disabled={disabled}
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
