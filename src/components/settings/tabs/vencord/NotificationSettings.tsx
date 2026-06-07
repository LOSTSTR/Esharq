/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openNotificationLogModal } from "@api/Notifications/notificationLog";
import { useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { ErrorCard } from "@components/ErrorCard";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { t } from "@utils/esharqI18n";
import { Margins } from "@utils/margins";
import { identity } from "@utils/misc";
import { Modal, openModal, Select, Slider } from "@webpack/common";

export function NotificationSection() {
    const { plugins: { Settings: { arabicMode } } } = useSettings(["plugins.Settings.arabicMode"]);
    void arabicMode;
    return (
        <section className={Margins.top16}>
            <Heading>{t("الإشعارات", "Notifications")}</Heading>
            <Paragraph className={Margins.bottom8}>
                {t(
                    "إعدادات الإشعارات الصادرة من Esharq. لا تشمل إشعارات Discord العادية (الرسائل وغيرها)",
                    "Settings for Esharq notifications. This does not include regular Discord notifications (messages, etc.)"
                )}
            </Paragraph>
            <Flex>
                <Button onClick={openNotificationSettingsModal}>
                    {t("إعدادات الإشعارات", "Notification Settings")}
                </Button>
                <Button onClick={openNotificationLogModal}>
                    {t("عرض سجل الإشعارات", "View Notification Log")}
                </Button>
            </Flex>
        </section>
    );
}

export function openNotificationSettingsModal() {
    openModal(props => (
        <Modal
            {...props}
            size="lg"
            title={t("إعدادات الإشعارات", "Notification Settings")}
        >
            <NotificationSettings />
        </Modal>
    ));
}

function NotificationSettings() {
    const settings = useSettings(["notifications.*", "plugins.Settings.arabicMode"]).notifications;

    return (
        <>
            <Heading tag="h5">{t("أسلوب الإشعارات", "Notification Style")}</Heading>
            {settings.useNative !== "never" && Notification?.permission === "denied" && (
                <ErrorCard style={{ padding: "1em" }} className={Margins.bottom8}>
                    <Heading>{t("تم رفض إذن إشعارات سطح المكتب", "Desktop Notification Permission Denied")}</Heading>
                    <Paragraph>{t("لقد رفضت إذن الإشعارات، لذا لن تعمل إشعارات سطح المكتب!", "You have denied notification permission, so desktop notifications will not work!")}</Paragraph>
                </ErrorCard>
            )}
            <Paragraph className={Margins.bottom8}>
                {t(
                    "قد تعرض بعض الإضافات إشعارات. تأتي هذه الإشعارات بنوعين:",
                    "Some plugins may show notifications. These come in two types:"
                )}
                <ul>
                    <li><strong>{t("إشعارات اشراق", "Esharq Notifications")}</strong>: {t("إشعارات داخل التطبيق", "in-app notifications")}</li>
                    <li><strong>{t("إشعارات سطح المكتب", "Desktop Notifications")}</strong>: {t("إشعارات سطح المكتب الأصلية (مثل إشعارات الإشارات)", "native desktop notifications (e.g. mention pings)")}</li>
                </ul>
            </Paragraph>
            <Select
                placeholder={t("أسلوب الإشعارات", "Notification Style")}
                options={[
                    { label: t("استخدام إشعارات سطح المكتب فقط عند عدم التركيز على Discord", "Only use desktop notifications when not focused"), value: "not-focused", default: true },
                    { label: t("استخدام إشعارات سطح المكتب دائماً", "Always use desktop notifications"), value: "always" },
                    { label: t("استخدام إشعارات Esharq دائماً", "Always use Esharq notifications"), value: "never" },
                ] satisfies Array<{ value: typeof settings["useNative"]; } & Record<string, any>>}
                closeOnSelect={true}
                select={v => settings.useNative = v}
                isSelected={v => v === settings.useNative}
                serialize={identity}
            />

            <Heading className={Margins.top16 + " " + Margins.bottom8}>{t("موضع الإشعارات", "Notification Position")}</Heading>
            <Select
                isDisabled={settings.useNative === "always"}
                placeholder={t("موضع الإشعارات", "Notification Position")}
                options={[
                    { label: t("أسفل اليمين", "Bottom Right"), value: "bottom-right", default: true },
                    { label: t("أعلى اليمين", "Top Right"), value: "top-right" },
                ] satisfies Array<{ value: typeof settings["position"]; } & Record<string, any>>}
                select={v => settings.position = v}
                isSelected={v => v === settings.position}
                serialize={identity}
            />

            <Heading className={Margins.top16 + " " + Margins.bottom8}>{t("عدد الإشعارات الفائتة", "Missed Notification Count")}</Heading>
            <FormSwitch
                title={t("عند العودة إلى Discord، ستظهر إشعار بعدد الإشعارات التي فاتتك", "When returning to Discord, show a notification with the number of notifications you missed")}
                value={settings.missed}
                onChange={(v: boolean) => settings.missed = v}
            />

            <Heading className={Margins.top16 + " " + Margins.bottom8}>{t("مهلة الإشعار", "Notification Timeout")}</Heading>
            <Paragraph className={Margins.bottom16}>{t("اضبط على 0 ثانية لعدم الإغلاق التلقائي أبداً", "Set to 0 seconds to never auto-dismiss")}</Paragraph>
            <Slider
                disabled={settings.useNative === "always"}
                markers={[0, 1000, 2500, 5000, 10_000, 20_000]}
                minValue={0}
                maxValue={20_000}
                initialValue={settings.timeout}
                onValueChange={v => settings.timeout = v}
                onValueRender={v => (v / 1000).toFixed(2) + "s"}
                onMarkerRender={v => (v / 1000) + "s"}
                stickToMarkers={false}
            />

            <Heading className={Margins.top16 + " " + Margins.bottom8}>{t("حد سجل الإشعارات", "Notification Log Limit")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {t(
                    "عدد الإشعارات التي يتم حفظها في السجل قبل حذف القديمة. اضبط على",
                    "The number of notifications to keep in the log before old ones are removed. Set to"
                )} <code>0</code> {t("لتعطيل السجل و", "to disable the log and")} <code>∞</code> {t("لعدم الحذف التلقائي أبداً", "to never auto-remove")}
            </Paragraph>
            <Slider
                markers={[0, 25, 50, 75, 100, 200]}
                minValue={0}
                maxValue={200}
                stickToMarkers={true}
                initialValue={settings.logLimit}
                onValueChange={v => settings.logLimit = v}
                onValueRender={v => v === 200 ? "∞" : v}
                onMarkerRender={v => v === 200 ? "∞" : v}
            />
        </>
    );
}
