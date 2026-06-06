/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { Divider } from "@components/Divider";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { t } from "@utils/esharqI18n";
import { OptionType } from "@utils/types";
import { Alerts, Button, useState } from "@webpack/common";

import { DATA_COLLECTION_NAME, getCollections, refreshCacheCollection } from "./utils/collectionManager";
import { cl } from "./utils/misc";
import { downloadCollections, uploadGifCollections } from "./utils/settingsUtils";

export const SortingOptions = {
    NAME: 1,
    CREATION_DATE: 2,
    MODIFIED_DATE: 3,
} as const;

export const settings = definePluginSettings({
    itemPrefix: {
        description: t("البادئة لعناصر GIF.", "Prefix for GIF items."),
        type: OptionType.STRING,
        default: "gc-item:",
        restartNeeded: true,
    },
    collectionPrefix: {
        description: t("البادئة للمجموعات.", "Prefix for collections."),
        type: OptionType.STRING,
        default: "gc:",
        restartNeeded: true,
    },
    onlyShowCollections: {
        description: t("عرض المجموعات فقط في منتقي GIF.", "Only show collections in the GIF picker."),
        type: OptionType.BOOLEAN,
        default: false,
        restartNeeded: true,
    },
    stopWarnings: {
        description: t("تخطي مربعات تأكيد الحذف.", "Skip delete confirmation dialogs."),
        type: OptionType.BOOLEAN,
        default: false,
    },
    showCopyImageLink: {
        description: t("إظهار خيار نسخ رابط الصورة في قوائم السياق.", "Show copy image link option in context menus."),
        type: OptionType.BOOLEAN,
        default: false,
    },
    preventDuplicates: {
        description: t("منع إضافة نفس GIF إلى المجموعة أكثر من مرة.", "Prevent adding the same GIF to a collection more than once."),
        type: OptionType.BOOLEAN,
        default: false,
    },
    defaultEmptyCollectionImage: {
        description: t("الصورة المعروضة عندما تكون المجموعة فارغة.", "Image shown when a collection is empty."),
        type: OptionType.STRING,
        default: "https://c.tenor.com/YEG33HsLEaIAAAAC/parksandrec-oops.gif",
    },
    collectionsSortType: {
        description: t("نوع الترتيب للمجموعات.", "Sort type for collections."),
        type: OptionType.NUMBER,
        default: SortingOptions.NAME,
        hidden: true,
    },
    collectionsSortOrder: {
        description: t("ترتيب الفرز للمجموعات.", "Sort order for collections."),
        type: OptionType.STRING,
        default: "asc",
        hidden: true,
    },
    collectionsSort: {
        type: OptionType.COMPONENT,
        description: t("تحديد طريقة ترتيب المجموعات.", "Choose how to sort collections."),
        component: SortSettingsComponent,
    },
    importGifs: {
        type: OptionType.COMPONENT,
        description: t("استيراد المجموعات.", "Import collections."),
        component: () =>
            <Button onClick={async () =>
                (await getCollections()).length ? Alerts.show({
                    title: t("هل أنت متأكد؟", "Are you sure?"),
                    body: t("استيراد المجموعات سيستبدل مجموعاتك الحالية.", "Importing collections will overwrite your current collections."),
                    confirmText: t("استيراد", "Import"),
                    confirmColor: Button.Colors.RED,
                    cancelText: t("لا عليك", "Nevermind"),
                    onConfirm: () => uploadGifCollections(),
                }) : uploadGifCollections()}>
                {t("استيراد المجموعات", "Import Collections")}
            </Button>,
    },
    exportGifs: {
        type: OptionType.COMPONENT,
        description: t("تصدير المجموعات.", "Export collections."),
        component: () =>
            <Button onClick={downloadCollections}>
                {t("تصدير المجموعات", "Export Collections")}
            </Button>,
    },
    resetCollections: {
        type: OptionType.COMPONENT,
        description: t("إعادة تعيين المجموعات.", "Reset collections."),
        component: () =>
            <Button onClick={() =>
                Alerts.show({
                    title: t("هل أنت متأكد؟", "Are you sure?"),
                    body: t("إعادة تعيين المجموعات ستزيل جميع مجموعاتك.", "Resetting collections will remove all your collections."),
                    confirmText: t("إعادة تعيين", "Reset"),
                    confirmColor: Button.Colors.RED,
                    cancelText: t("لا عليك", "Nevermind"),
                    onConfirm: async () => {
                        await DataStore.set(DATA_COLLECTION_NAME, []);
                        refreshCacheCollection();
                    },
                })}>
                Reset Collections
            </Button>,
    },
});

function RadioOption({ name, value, checked, onChange, label }: { name: string; value: string | number; checked: boolean; onChange: () => void; label: string; }) {
    return (
        <div className={cl("sort-option")}>
            <label className={cl("sort-label")}>
                <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className={cl("sort-input")} />
                {label}
            </label>
        </div>
    );
}

function SortSettingsComponent() {
    const [sortType, setSortType] = useState(settings.store.collectionsSortType ?? SortingOptions.NAME);
    const [sortOrder, setSortOrder] = useState(settings.store.collectionsSortOrder ?? "asc");

    const handleSortType = (value: number) => {
        setSortType(value);
        settings.store.collectionsSortType = value;
    };

    const handleSortOrder = (value: string) => {
        setSortOrder(value);
        settings.store.collectionsSortOrder = value;
    };

    return (
        <div className={cl("sort-container")}>
            <Heading className={cl("sort-title")}>Sort Collections</Heading>
            <Divider className={cl("sort-divider")} />
            <Paragraph className={cl("sort-description")}>Choose a sorting criteria for your collections</Paragraph>
            <Divider className={cl("sort-divider")} />
            <div className={cl("sort-section")}>
                <Paragraph className={cl("sort-section-title")}>Sort By</Paragraph>
                <RadioOption name="sortType" value={SortingOptions.NAME} checked={sortType === SortingOptions.NAME} onChange={() => handleSortType(SortingOptions.NAME)} label={t("الاسم", "Name")} />
                <RadioOption name="sortType" value={SortingOptions.CREATION_DATE} checked={sortType === SortingOptions.CREATION_DATE} onChange={() => handleSortType(SortingOptions.CREATION_DATE)} label={t("تاريخ الإنشاء", "Creation Date")} />
                <RadioOption name="sortType" value={SortingOptions.MODIFIED_DATE} checked={sortType === SortingOptions.MODIFIED_DATE} onChange={() => handleSortType(SortingOptions.MODIFIED_DATE)} label={t("تاريخ التعديل", "Modified Date")} />
            </div>
            <Divider className={cl("sort-divider")} />
            <div className={cl("sort-section")}>
                <Paragraph className={cl("sort-section-title")}>Order</Paragraph>
                <RadioOption name="sortOrder" value="asc" checked={sortOrder === "asc"} onChange={() => handleSortOrder("asc")} label={t("تصاعدي", "Ascending")} />
                <RadioOption name="sortOrder" value="desc" checked={sortOrder === "desc"} onChange={() => handleSortOrder("desc")} label={t("تنازلي", "Descending")} />
            </div>
        </div>
    );
}
