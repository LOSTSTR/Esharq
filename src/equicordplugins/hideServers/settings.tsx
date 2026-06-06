/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import { OptionType } from "@utils/types";
import { Button, useStateFromStores } from "@webpack/common";

import { addIndicator, removeIndicator } from ".";
import { HiddenServersMenu } from "./components/HiddenServersMenu";
import { HiddenServersStore } from "./HiddenServersStore";

export default definePluginSettings({
    showIndicator: {
        type: OptionType.BOOLEAN,
        description: t("يعرض قائمة لإظهار السيرفرات المخفية في أسفل القائمة", "Show a button to display hidden servers at the bottom of the list"),
        default: true,
        onChange: val => {
            if (val) {
                addIndicator();
            } else {
                removeIndicator();
            }
        }
    },
    guildsList: {
        type: OptionType.COMPONENT,
        description: t("إزالة السيرفرات المخفية", "Remove hidden servers"),
        component: () => {
            const detail = useStateFromStores([HiddenServersStore], () => HiddenServersStore.hiddenGuildsDetail());
            return <HiddenServersMenu guilds={detail} />;
        }
    },
    resetHidden: {
        type: OptionType.COMPONENT,
        description: t("إزالة جميع السيرفرات المخفية من القائمة", "Remove all hidden servers from the list"),
        component: () => (
            <div>
                <Button
                    size={Button.Sizes.SMALL}
                    color={Button.Colors.RED}
                    onClick={() => HiddenServersStore.clearHidden()}
                >{t("إعادة ضبط الخوادم المخفية", "Reset Hidden Servers")}</Button>
            </div>
        ),
    },
});
