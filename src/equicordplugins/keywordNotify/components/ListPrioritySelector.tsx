/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { t } from "@utils/esharqI18n";
import { Select } from "@webpack/common";

import { ListType } from "..";

export function ListPrioritySelector({ listType, setListPriority }: { listType: ListType; setListPriority: (v: ListType) => void; }) {
    return (
        <Select
            options={[
                { label: t("القائمة البيضاء", "Whitelist"), value: ListType.Whitelist },
                { label: t("القائمة السوداء", "Blacklist"), value: ListType.BlackList }
            ]}
            placeholder={t("اختر نوع القائمة", "Select a list type")}
            isSelected={v => v === listType}
            closeOnSelect={true}
            select={setListPriority}
            serialize={v => v}
        />
    );
}
