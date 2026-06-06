/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
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

import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import { OptionType } from "@utils/types";

export const enum PronounsFormat {
    Lowercase = "LOWERCASE",
    Capitalized = "CAPITALIZED"
}

export const settings = definePluginSettings({
    pronounsFormat: {
        type: OptionType.SELECT,
        description: t("صيغة عرض الضمائر في الدردشة", "The format for displaying pronouns in chat"),
        options: [
            {
                label: t("أحرف صغيرة", "Lowercase"),
                value: PronounsFormat.Lowercase,
                default: true
            },
            {
                label: t("بأحرف كبيرة في البداية", "Capitalized"),
                value: PronounsFormat.Capitalized
            }
        ]
    },
    showSelf: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل أو تعطيل عرض الضمائر الخاصة بك", "Enable or disable showing your own pronouns"),
        default: true
    }
});
