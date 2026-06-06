/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { TextButton } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { t } from "@utils/esharqI18n";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { OptionType } from "@utils/types";
import { SettingsRouter } from "@webpack/common";

import DecorPlugin from ".";
import DecorSection from "./ui/components/DecorSection";

export const settings = definePluginSettings({
    changeDecoration: {
        type: OptionType.COMPONENT,
        component({ closePluginSettings }) {
            if (!DecorPlugin.started) return <Paragraph>{t("فعّل Decor وأعد تشغيل العميل لتغيير زينة صورتك الرمزية.", "Enable Decor and restart your client to change your avatar decoration.")}</Paragraph>;

            return <div>
                <DecorSection hideTitle hideDivider noMargin />
                <Paragraph className={classes(Margins.top8, Margins.bottom8)}>
                    You can also access Decor decorations from the <TextButton
                        variant="link"
                        onClick={async () => {
                            closePluginSettings();
                            SettingsRouter.openUserSettings("profile_panel");
                        }}
                    >{t("الملفات الشخصية", "Profiles")}</TextButton> page.
                </Paragraph>
            </div>;
        }
    },
    baseUrl: {
        type: OptionType.STRING,
        hidden: true,
        description: t("رابط Decor API", "Decor API URL"),
        default: "https://decor.fieryflames.dev"
    },
    agreedToGuidelines: {
        type: OptionType.BOOLEAN,
        description: t("موافق على الإرشادات", "Agreed to the guidelines"),
        hidden: true,
        default: false
    }
});
