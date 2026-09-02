/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { copyToClipboard } from "@utils/clipboard";
import { t } from "@utils/esharqI18n";
import { Alerts, Button, FluxDispatcher, Menu, showToast, Toasts } from "@webpack/common";

import { settings } from "../settings";
import { Gif } from "../types";
import { addToCollection, cache_collections, deleteCollection, getGifById, getItemCollectionNameFromId, removeFromCollection } from "../utils/collectionManager";
import { getGif } from "../utils/getGif";
import { stripPrefix } from "../utils/misc";
import { uuidv4 } from "../utils/uuidv4";
import { openCollectionInfoModal, openCreateCollectionModal, openGifInfoModal, openMoveToCollectionModal, openRenameCollectionModal } from "./modals";

function dispatchRefresh(collectionName: string) {
    FluxDispatcher.dispatch({ type: "GIF_PICKER_QUERY", query: "" });
    FluxDispatcher.dispatch({ type: "GIF_PICKER_QUERY", query: collectionName });
}

function AddToCollectionMenu(gif: Gif) {
    return (
        <Menu.MenuItem label={t("إضافة إلى المجموعة", "Add To Collection")} key="add-to-collection" id="add-to-collection">
            {cache_collections.length > 0 && cache_collections.map(col => (
                <Menu.MenuItem
                    key={col.name}
                    id={col.name}
                    label={stripPrefix(col.name)}
                    action={() => addToCollection(col.name, gif)}
                />
            ))}
            {cache_collections.length > 0 && <Menu.MenuSeparator key="separator" />}
            <Menu.MenuItem
                key="create-collection"
                id="create-collection"
                label={t("إنشاء مجموعة", "Create Collection")}
                action={() => openCreateCollectionModal(gif)}
            />
        </Menu.MenuItem>
    );
}

export const addCollectionContextMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    if (!props) return;
    const { message, itemSrc, itemHref, target } = props;
    const gif = getGif(message, itemSrc ?? itemHref, target);
    if (!gif) return;

    const group = findGroupChildrenByChildId("open-native-link", children) ?? findGroupChildrenByChildId("copy-link", children);
    if (!group || group.some(child => child?.props?.id === "add-to-collection")) return;

    if (settings.store.showCopyImageLink) {
        group.push(
            <Menu.MenuItem
                label={t("نسخ رابط الصورة", "Copy Image Link")}
                key="copy-image-link"
                id="copy-image-link"
                action={() => {
                    copyToClipboard(gif.url);
                    showToast(t("تمّ نسخ رابط الصورة إلى الحافظة", "Image link copied to clipboard"), Toasts.Type.SUCCESS);
                }}
            />
        );
    }

    group.push(AddToCollectionMenu(gif));
};

export function RemoveItemContextMenuItems({ type, nameOrId }: { type: "collection" | "gif"; nameOrId: string; }) {
    return (
        <Menu.MenuGroup key={`remove-item-${nameOrId}`}>
            {type === "collection" && (
                <>
                    <Menu.MenuItem
                        key="collection-information"
                        id="collection-information"
                        label={t("معلومات المجموعة", "Collection Information")}
                        action={() => {
                            const collection = cache_collections.find(c => c.name === nameOrId);
                            if (collection) openCollectionInfoModal(collection);
                        }}
                    />
                    <Menu.MenuSeparator key="collection-sep-1" />
                    <Menu.MenuItem
                        key="rename-collection"
                        id="rename-collection"
                        label={t("إعادة تسمية", "Rename")}
                        action={() => openRenameCollectionModal(nameOrId)}
                    />
                </>
            )}
            {type === "gif" && (
                <>
                    <Menu.MenuItem
                        key="gif-information"
                        id="gif-information"
                        label={t("معلومات", "Information")}
                        action={() => {
                            const gif = getGifById(nameOrId);
                            if (gif) openGifInfoModal(gif);
                        }}
                    />
                    <Menu.MenuSeparator key="gif-sep-1" />
                    <Menu.MenuItem
                        key="copy-url"
                        id="copy-url"
                        label={t("نسخ الرابط", "Copy URL")}
                        action={() => {
                            const gif = getGifById(nameOrId);
                            if (!gif) return;
                            copyToClipboard(gif.url);
                            showToast(t("تمّ نسخ الرابط إلى الحافظة", "URL copied to clipboard"), Toasts.Type.SUCCESS);
                        }}
                    />
                    <Menu.MenuItem
                        key="move-to-collection"
                        id="move-to-collection"
                        label={t("نقل إلى المجموعة", "Move To Collection")}
                        action={() => openMoveToCollectionModal(nameOrId)}
                    />
                    <Menu.MenuSeparator key="gif-sep-2" />
                </>
            )}
            <Menu.MenuItem
                key="delete-collection"
                id="delete-collection"
                label={type === "collection" ? "Delete Collection" : "Remove"}
                action={() => {
                    const doDelete = async () => {
                        if (type === "collection") {
                            deleteCollection(nameOrId);
                            FluxDispatcher.dispatch({ type: "GIF_PICKER_QUERY", query: "" });
                        } else {
                            const collectionName = getItemCollectionNameFromId(nameOrId);
                            await removeFromCollection(nameOrId);
                            if (collectionName) dispatchRefresh(collectionName);
                        }
                    };

                    if (settings.store.stopWarnings) {
                        doDelete();
                        return;
                    }

                    Alerts.show({
                        title: t("هل أنت متأكد؟", "Are you sure?"),
                        body: t(`هل تريد حقاً ${type === "collection" ? "حذف هذه المجموعة" : "إزالة هذا العنصر"}؟`, `Do you really want to ${type === "collection" ? "delete this collection" : "remove this item"}?`),
                        confirmText: type === "collection" ? t("حذف", "Delete") : t("إزالة", "Remove"),
                        confirmColor: Button.Colors.RED,
                        cancelText: t("لا عليك", "Nevermind"),
                        onConfirm: doDelete,
                    });
                }}
            />
        </Menu.MenuGroup>
    );
}

export function GifPickerContextMenu({ gif }: { gif: Gif; }) {
    return (
        <Menu.Menu
            navId="gif-collection-id"
            onClose={() => FluxDispatcher.dispatch({ type: "CONTEXT_MENU_CLOSE" })}
            aria-label="Gif Collections"
        >
            {settings.store.showCopyImageLink && (
                <Menu.MenuItem
                    label={t("نسخ رابط الصورة", "Copy Image Link")}
                    key="copy-image-link"
                    id="copy-image-link"
                    action={() => {
                        copyToClipboard(gif.url);
                        showToast(t("تمّ نسخ رابط الصورة إلى الحافظة", "Image link copied to clipboard"), Toasts.Type.SUCCESS);
                    }}
                />
            )}
            {AddToCollectionMenu(gif)}
        </Menu.Menu>
    );
}

export function getGifPickerContextMenuItems(src: string, url: string, height: number, width: number) {
    const gif: Gif = { id: uuidv4(settings.store.itemPrefix), src, url, height, width };
    return (
        <Menu.MenuGroup key="gif-collections-group">
            {settings.store.showCopyImageLink && (
                <Menu.MenuItem
                    label="Copy Image Link"
                    key="copy-image-link"
                    id="copy-image-link"
                    action={() => {
                        copyToClipboard(url);
                        showToast("Image link copied to clipboard", Toasts.Type.SUCCESS);
                    }}
                />
            )}
            {AddToCollectionMenu(gif)}
        </Menu.MenuGroup>
    );
}
