/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { backpackListeners, BackpackedButtons, ChatBarButton, ChatBarButtonFactory, ChatBarButtonMap, ChatBarProps, notifyBackpackChange } from "@api/ChatButtons";
import { DataStore } from "@api/index";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin from "@utils/types";
import { ContextMenuApi, Menu, Popout, React, Tooltip, useEffect, useRef, useState } from "@webpack/common";
import { Logger } from "@utils/Logger";

const logger = new Logger("Backpack");

const STORE_KEY = "Backpack_packedButtons";

// ─── Persistence ──────────────────────────────────────────────────────────────

async function loadPacked(): Promise<string[]> {
    try { return (await DataStore.get<string[]>(STORE_KEY)) ?? []; }
    catch { return []; }
}

async function savePacked(ids: string[]) {
    try { await DataStore.set(STORE_KEY, ids); } catch (err) { logger.debug("Ignored error", err); }
}

async function packButton(id: string) {
    BackpackedButtons.add(id);
    notifyBackpackChange();
    await savePacked([...BackpackedButtons]);
}

async function unpackButton(id: string) {
    BackpackedButtons.delete(id);
    notifyBackpackChange();
    await savePacked([...BackpackedButtons]);
}

// ─── SVG Icons (Chevron Up = closed, Chevron Down = open) ──────────────────────

function ChevronUpIcon(props: Record<string, any>) {
    const { width = 20, height = 20, ...rest } = props;
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
            <path fill="currentColor" d="M3.3 15.7a1 1 0 0 0 1.4 0L12 8.42l7.3 7.3a1 1 0 0 0 1.4-1.42l-8-8a1 1 0 0 0-1.4 0l-8 8a1 1 0 0 0 0 1.42Z" />
        </svg>
    );
}

function ChevronDownIcon(props: Record<string, any>) {
    const { width = 20, height = 20, ...rest } = props;
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
            <path fill="currentColor" d="M5.3 9.3a1 1 0 0 1 1.4 0l5.3 5.29 5.3-5.3a1 1 0 1 1 1.4 1.42l-6 6a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1 0-1.42Z" />
        </svg>
    );
}

// ─── Backpack Popout (left-click) ─────────────────────────────────────────────
// Renders the actual components of the packed buttons — they work just like in the bar.

function useBackpack() {
    const [, forceUpdate] = useState(0);
    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        backpackListeners.add(listener);
        return () => { backpackListeners.delete(listener); };
    }, []);
    return {
        packed: Array.from(BackpackedButtons),
        available: Array.from(ChatBarButtonMap.keys()).filter(id => id !== "Backpack" && !BackpackedButtons.has(id))
    };
}

function BackpackPopout({ chatBarProps }: { chatBarProps: ChatBarProps; closePopout: () => void; }) {
    const { packed: packedIds } = useBackpack();
    const packed = packedIds
        .filter(id => ChatBarButtonMap.has(id))
        .map(id => ({ id, data: ChatBarButtonMap.get(id)! }));

    const popoutContainerRef = useRef<HTMLDivElement>(null);

    if (packed.length === 0) {
        return (
            <div className="backpack-popout-horizontal-empty">
                {t("انقر بالزر الأيمن لحزم الإضافات", "Right-click to pack plugins")}
            </div>
        );
    }

    return (
        <div className="backpack-popout-horizontal" ref={popoutContainerRef} style={{ overflow: "visible" }}>
            {packed.map(({ id, data }) => (
                <Tooltip text={id} key={id}>
                    {(tooltipProps: any) => (
                        <div
                            className="backpack-item-horizontal"
                            {...tooltipProps}
                            style={{ overflow: "visible" }}
                        >
                            <ErrorBoundary noop>
                                <data.render {...({ ...chatBarProps, isMainChat: true, isAnyChat: true, popoutContainer: popoutContainerRef.current } as any)} />
                            </ErrorBoundary>
                        </div>
                    )}
                </Tooltip>
            ))}
        </div>
    );
}

// ─── Context Menu (right-click) ────────────────────────────────────────────────

function BackpackContextMenu() {
    useBackpack();

    return (
        <Menu.Menu navId="backpack-context" onClose={ContextMenuApi.closeContextMenu}>
            <Menu.MenuGroup label={t("حزم الإضافات في الحقيبة", "Pack Plugins into Backpack")}>
                {Array.from(ChatBarButtonMap.keys())
                    .filter(id => id !== "Backpack")
                    .sort()
                    .map(id => {
                        const isPacked = BackpackedButtons.has(id);
                        return (
                            <Menu.MenuCheckboxItem
                                key={`bp-toggle-${id}`}
                                id={`bp-toggle-${id}`}
                                label={id}
                                checked={isPacked}
                                action={() => isPacked ? unpackButton(id) : packButton(id)}
                            />
                        );
                    })}
            </Menu.MenuGroup>
        </Menu.Menu>
    );
}

// ─── Chat Bar Button ──────────────────────────────────────────────────────────

const BackpackChatBarButton: ChatBarButtonFactory = props => {
    const { isMainChat, ...chatBarProps } = props;
    const [isOpen, setIsOpen] = useState(false);
    const [count, setCount] = useState(BackpackedButtons.size);
    const popoutRef = useRef<HTMLDivElement>(null);
    // Counts popups/modals opened ABOVE the backpack, so we don't auto-close over them.
    const overlayCount = useRef(0);

    // Discord renders its modals/popups in special containers outside the popout. Watch the
    // direct children of document.body (where Discord inserts its portals) to detect overlays.
    useEffect(() => {
        if (!isOpen) {
            overlayCount.current = 0;
            return;
        }

        const bodyChildrenAtOpen = new Set(Array.from(document.body.children));

        function looksLikeOverlay(node: HTMLElement): boolean {
            if (!bodyChildrenAtOpen.has(node)) return true;
            const cls = node.className?.toString() ?? "";
            return ["layerContainer", "focusLock", "backdrop", "modal"].some(p => cls.includes(p));
        }

        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                for (const node of Array.from(m.addedNodes)) {
                    if (node instanceof HTMLElement && looksLikeOverlay(node)) {
                        overlayCount.current++;
                    }
                }
                for (const node of Array.from(m.removedNodes)) {
                    if (node instanceof HTMLElement && looksLikeOverlay(node)) {
                        overlayCount.current = Math.max(0, overlayCount.current - 1);
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: false });

        return () => {
            observer.disconnect();
            overlayCount.current = 0;
        };
    }, [isOpen]);

    useEffect(() => {
        const listener = () => {
            const actualCount = Array.from(BackpackedButtons).filter(id => ChatBarButtonMap.has(id)).length;
            setCount(actualCount);
        };
        backpackListeners.add(listener);
        listener(); // set correct count on mount
        return () => { backpackListeners.delete(listener); };
    }, []);

    if (!isMainChat) return null;

    return (
        <Popout
            targetElementRef={popoutRef}
            renderPopout={() => <BackpackPopout chatBarProps={chatBarProps as any as ChatBarProps} closePopout={() => setIsOpen(false)} />}
            shouldShow={isOpen}
            onRequestClose={() => {
                // Don't close if a popup/modal was opened by a backpack plugin.
                if (overlayCount.current > 0) return;
                setIsOpen(false);
            }}
            position="top"
            align="right"
            spacing={8}
        >
            {(_, { isShown: _isShown }) => (
                <ChatBarButton
                    tooltip={t(`الحقيبة${count > 0 ? ` (${count})` : ""}`, `Backpack${count > 0 ? ` (${count})` : ""}`)}
                    onClick={() => setIsOpen(v => !v)}
                    onContextMenu={(e: React.MouseEvent) => {
                        e.preventDefault();
                        ContextMenuApi.openContextMenu(e, (props: any) => (
                            <ErrorBoundary noop>
                                <BackpackContextMenu {...props} />
                            </ErrorBoundary>
                        ));
                    }}
                >
                    <div ref={popoutRef as any} style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        {isOpen ? <ChevronDownIcon /> : <ChevronUpIcon />}
                        {count > 0 && <div className="backpack-badge">{count}</div>}
                    </div>
                </ChatBarButton>
            )}
        </Popout>
    );
};

// ─── Plugin Definition ────────────────────────────────────────────────────────

export default definePlugin({
    name: "Backpack",
    description: "Organize chat bar buttons into a backpack. Left-click to use packed buttons, right-click to pack/unpack buttons.",
    authors: [EquicordDevs.nobody],
    dependencies: ["ChatInputButtonAPI"],

    chatBarButton: {
        icon: ChevronUpIcon,
        render: BackpackChatBarButton,
    },

    async start() {
        const packed = await loadPacked();
        for (const id of packed) BackpackedButtons.add(id);
        notifyBackpackChange();
    },

    stop() {
        BackpackedButtons.clear();
        notifyBackpackChange();
    },
});
