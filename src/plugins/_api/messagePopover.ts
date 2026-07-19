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

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "MessagePopoverAPI",
    description: "API to add buttons to message popovers",
    authors: [Devs.KingFish, Devs.Ven, Devs.Nuckyz],
    patches: [
        {
            find: "#{intl::MESSAGE_UTILITIES_A11Y_LABEL}",
            replacement: {
                // Discord now wraps the react button in `<flag>?<Fragment>:null,` instead of
                // emitting it inline, so the old anchor never matched and every plugin that
                // adds a hover button silently rendered nothing. Anchor instead on the
                // avatar element that carries the message, run to the close of the react
                // button fragment, and insert just before the reply-other button.
                match: /\(0,\i\.jsx\)\(\i,\{channel:\i,message:(\i)\}\).{0,200}?\]\}\):null,(?=\i&&!\i\?\(0,\i\.jsx\)\((\i\.\i),\{label:)/,
                replace: (m, message, ButtonComponent) =>
                    `${m}Vencord.Api.MessagePopover._buildPopoverElements(${ButtonComponent},${message}),`
            }
        }
    ]
});
