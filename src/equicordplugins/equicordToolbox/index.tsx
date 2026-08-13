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

import "./styles.css";

import { HeaderBarButton } from "@api/HeaderBar";
import { definePluginSettings, migratePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { Popout, useRef, useState } from "@webpack/common";

import { renderPopout } from "./menu";

export const settings = definePluginSettings({
    showPluginMenu: {
        type: OptionType.BOOLEAN,
        default: true,
        get description() { return t("عرض قائمة الإضافات في صندوق الأدوات", "Show the plugin menu in the toolbox"); },
    }
});

/**
 * أيقونة صندوق الأدوات — **حرف E بهوية إشراق**.
 *
 * كانت شعار المشروع الأصل، فيرى مستخدم إشراق في شريطه علامة مشروع آخر.
 * والحرف يبقى مقروءاً عند 20 بكسل حيث تذوب التفاصيل، ويأخذ لونه من
 * `currentColor` فيتبع حالة الزرّ (عادي · مُمرَّر · مفتوح) بلا لون مثبَّت
 * يشذّ عن بقيّة أزرار الشريط.
 */
function Icon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" width={20} height={20} {...props}>
            <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
                d="M12 2.6 20.1 7.3v9.4L12 21.4 3.9 16.7V7.3Z"
            />
            <path
                fill="currentColor"
                d="M15.4 8.2H9.9c-1 0-1.6.5-1.6 1.4v4.8c0 .9.6 1.4 1.6 1.4h5.5v-1.7h-5.2v-1.3h4.6v-1.6H10.2V9.9h5.2Z"
            />
        </svg>
    );
}

function VencordPopoutButton() {
    const buttonRef = useRef(null);
    const [show, setShow] = useState(false);

    return (
        <Popout
            position="bottom"
            align="center"
            spacing={0}
            animation={Popout.Animation.NONE}
            shouldShow={show}
            onRequestClose={() => setShow(false)}
            targetElementRef={buttonRef}
            renderPopout={() => renderPopout(() => setShow(false))}
        >
            {(_, { isShown }) => (
                <HeaderBarButton
                    ref={buttonRef}
                    className="vc-toolbox-btn"
                    onClick={() => setShow(v => !v)}
                    tooltip={isShown ? null : t("صندوق أدوات إشراق", "Esharq toolbox")}
                    icon={Icon}
                    selected={isShown}
                />
            )}
        </Popout>
    );
}

migratePluginSettings("EquicordToolbox", "VencordToolbox");
export default definePlugin({
    name: "EquicordToolbox",
    description: "Adds a button next to the inbox button in the channel header with quick Esharq actions",
    tags: ["Voice", "Accessibility"],
    authors: [Devs.Ven, Devs.AutumnVN],
    dependencies: ["HeaderBarAPI"],
    settings,
    headerBarButton: {
        icon: Icon,
        render: VencordPopoutButton,
        priority: 1337
    }
});
