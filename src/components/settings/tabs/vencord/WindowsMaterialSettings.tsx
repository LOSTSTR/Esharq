/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Card } from "@components/settings/esharq/Card";
import { IS_WINDOWS } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import { Select } from "@webpack/common";

export function WindowsMaterialSettings({ index = 0 }: { index?: number; }) {
    const settings = useSettings(["windowsMaterial"]);

    if (!IS_WINDOWS || IS_WEB || !VencordNative.native.supportsWindowsMaterial()) return null;

    return (
        <ErrorBoundary noop>
            <Card
                index={index}
                title={t("مواد الخلفية", "Background Material")}
                subtitle={t("تأثيرات الخلفية الشفافة لويندوز. يتطلب قالباً يدعم الشفافية وإلا لن يكون له أثر. تستلزم إعادة تشغيل ديسكورد بعد تغيير هذا الإعداد.", "Windows transparent background effects. You need a theme that supports transparency or this will do nothing. A restart is required after changing this setting.")}
                badge={t("يتطلّب إعادة تشغيل", "Restart required")} badgeTone="warn"
            >
                <Select
                    placeholder={t("لا شيء", "None")}
                    options={[
                        {
                            label: t("لا شيء", "None"),
                            value: "none",
                            default: true
                        },
                        {
                            label: t("Mica (يدمج قالب النظام وخلفية سطح المكتب في الخلفية)", "Mica (incorporates system theme + desktop wallpaper to paint the background)"),
                            value: "mica"
                        },
                        {
                            label: t("Tabbed (نوع من Mica مع تلوين خلفية أقوى)", "Tabbed (variant of Mica with stronger background tinting)"),
                            value: "tabbed"
                        },
                        {
                            label: t("Acrylic (يضبب النافذة خلف ديسكورد لخلفية شبه شفافة)", "Acrylic (blurs the window behind Vesktop for a translucent background)"),
                            value: "acrylic"
                        }
                    ]}
                    closeOnSelect={true}
                    select={v => (settings.windowsMaterial = v)}
                    isSelected={v => v === settings.windowsMaterial}
                    serialize={s => s}
                />
            </Card>
        </ErrorBoundary>
    );
}
