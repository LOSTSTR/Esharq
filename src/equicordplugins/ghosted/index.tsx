/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { findGroupChildrenByChildId } from "@api/ContextMenu";
import { addServerListElement, removeServerListElement, ServerListRenderPosition } from "@api/ServerList";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Devs, EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { Channel } from "@vencord/discord-types";
import { Menu, openModal,Tooltip, useEffect, useState } from "@webpack/common";

import { Boo, clearChannelFromGhost, getBooCount, getGhostedChannels, onBooCountChange } from "./Boo";
import { getChannelDisplayName, GhostedUsersModal } from "./GhostedUsersModal";
import { IconGhost } from "./IconGhost";

export const cl = classNameFactory("vc-boo-");

export const settings = definePluginSettings({
    showIndicator: {
        type: OptionType.BOOLEAN,
        description: "Show ghost counter above the server list",
        default: true,
        restartNeeded: false
    },
    showDmIcons: {
        type: OptionType.BOOLEAN,
        description: "Show ghost icons next to individual DMs",
        default: true,
        restartNeeded: false
    },
    ignoreGroupDms: {
        type: OptionType.BOOLEAN,
        description: "Exclude all group DMs from ghosting",
        default: false
    },
    exemptedChannels: {
        type: OptionType.STRING,
        description: "Comma-separated list of channel IDs exempt from ghosting (right-click a DM channel to copy its ID)",
        default: "",
        restartNeeded: false
    },
    ignoreBots: {
        type: OptionType.BOOLEAN,
        description: "Ignore DMs from bots",
        default: true,
        restartNeeded: false
    },
    maxInactiveTimeMs: {
        type: OptionType.SELECT,
        description: "Only ghost DMs active within this timeframe",
        options: [
            { label: t("بلا حد", "No limit"), value: 0, default: true },
            { label: t("ساعة واحدة", "1 hour"), value: 60 * 60 * 1000 },
            { label: t("يوم واحد", "1 day"), value: 24 * 60 * 60 * 1000 },
            { label: t("أسبوع واحد", "1 week"), value: 7 * 24 * 60 * 60 * 1000 },
            { label: t("شهر واحد", "1 month"), value: 30 * 24 * 60 * 60 * 1000 },
        ],
        restartNeeded: false
    }
});

function BooIndicator() {
    const [count, setCount] = useState(getBooCount());
    const [showJumpscare, setShowJumpscare] = useState(false);

    useEffect(() => {
        const unsubscribe = onBooCountChange(newCount => {
            setCount(newCount);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    if (!settings.store.showIndicator && !showJumpscare) return null;

    const handleClick = () => {
        const ghostedChannels = getGhostedChannels();
        openModal(modalProps => (
            <ErrorBoundary>
                <GhostedUsersModal
                    modalProps={modalProps}
                    ghostedChannels={ghostedChannels}
                    onClearGhost={clearChannelFromGhost}
                />
            </ErrorBoundary>
        ));
    };

    const getTooltipText = () => {
        const ghostedChannels = getGhostedChannels();
        if (ghostedChannels.length === 0) {
            return t("لا مستخدمين متجاهَلين", "No Ghosted Users");
        }
        if (ghostedChannels.length <= 5) {
            return ghostedChannels
                .map(id => getChannelDisplayName(id))
                .join(", ");
        }
        return `${ghostedChannels.length} Ghosted Users`;
    };

    return (
        <>
            {settings.store.showIndicator && getGhostedChannels().length > 0 && (
                <div id={cl("container")}>
                    <Tooltip text={getTooltipText()} position="right">
                        {({ onMouseEnter, onMouseLeave }) => (
                            <div
                                id={cl("container")}
                                className={cl("clickable")}
                                onMouseEnter={onMouseEnter}
                                onMouseLeave={onMouseLeave}
                                onClick={handleClick}
                            >
                                {count} <IconGhost fill="currentColor" />
                            </div>
                        )}
                    </Tooltip>
                </div>
            )}
        </>
    );
}

function makeContextItem(props) {
    return <Menu.MenuItem
        id="ec-ghosted-clear"
        key="ec-ghosted-clear"
        label={t("إلغاء التجاهل", "unghost")}
        action={() => {
            clearChannelFromGhost(props.channel.id);
        }}
    />;
}

export default definePlugin({
    name: "Ghosted",
    description: "Shows a ghost if you haven't replied to their DMs",
    tags: ["Chat", "Utility"],
    authors: [EquicordDevs.vei, Devs.sadan, EquicordDevs.justjxke, EquicordDevs.iamme],
    settings,
    dependencies: ["AudioPlayerAPI", "ServerListAPI"],
    contextMenus: {
        "gdm-context": (menuItems, props) => {
            const group = findGroupChildrenByChildId("leave", menuItems, true);
            group?.unshift(makeContextItem(props));
        },
        "user-context": (menuItems, props) => {
            const group = findGroupChildrenByChildId("close-dm", menuItems);
            group?.push(makeContextItem(props));
        }
    },

    patches: [
        {
            find: "PrivateChannel.renderAvatar",
            replacement: {
                match: /\]:\i\|\|\i.{0,50}children:\[/,
                replace: "$&$self.renderBoo(arguments[0]),"
            }
        },
    ],

    renderBoo(props: { channel: Channel; }) {
        return (
            <ErrorBoundary noop>
                <Boo {...props} />
            </ErrorBoundary>
        );
    },

    renderIndicator() {
        return (
            <ErrorBoundary noop>
                <BooIndicator />
            </ErrorBoundary>
        );
    },

    start() {
        addServerListElement(ServerListRenderPosition.Above, this.renderIndicator);
    },

    stop() {
        removeServerListElement(ServerListRenderPosition.Above, this.renderIndicator);
    },
});
