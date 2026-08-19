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

import { useSettings } from "@api/Settings";
import { authorizeCloud, deauthorizeCloud } from "@api/SettingsSync/cloudSetup";
import { deleteCloudSettings, eraseAllCloudData, getCloudSettings, putCloudSettings } from "@api/SettingsSync/cloudSync";
import { Button } from "@components/Button";
import { CheckedTextInput } from "@components/CheckedTextInput";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { CloudDownloadIcon, CloudUploadIcon, SkullIcon } from "@components/Icons";
import { Link } from "@components/Link";
import { Card, NoticeStrip } from "@components/settings/esharq/Card";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import { isArabicMode, t } from "@utils/esharqI18n";
import { localStorage } from "@utils/localStorage";
import { Margins } from "@utils/margins";
import { useForceUpdater } from "@utils/react";
import { findComponentByCodeLazy } from "@webpack";
import { Alerts, SearchableSelect, Select, useState } from "@webpack/common";

const ICON_STYLE: React.CSSProperties = { width: 20, height: 20, borderRadius: 4, verticalAlign: "middle" };

function EquicordIcon() {
    return <img src="https://equicord.org/assets/favicon.png" alt="Equicord" style={ICON_STYLE} />;
}

function VencordIcon() {
    return <img src="https://equicord.org/assets/icons/vencord/icon-light.png" alt="Vencord" style={ICON_STYLE} />;
}

const RefreshIcon = findComponentByCodeLazy("M4 12a8 8 0 0 1 14.93-4H15");
const TrashIcon = findComponentByCodeLazy("2.81h8.36a3");

function validateUrl(url: string) {
    try {
        new URL(url);
        return true;
    } catch {
        return "Invalid URL";
    }
}

const cloudBackendOptions = [
    { label: "Equicord Cloud", value: "https://cloud.equicord.org/" },
    { label: "Vencord Cloud", value: "https://api.vencord.dev/" }
];

function CloudTab() {
    const settings = useSettings(["cloud.authenticated", "cloud.url", "cloud.settingsSync", "plugins.Settings.arabicMode"]);
    const [inputKey, setInputKey] = useState(0);
    const forceUpdate = useForceUpdater();

    const { cloud } = settings;
    const isAuthenticated = cloud.authenticated;
    const syncEnabled = isAuthenticated && cloud.settingsSync;

    const syncDirectionOptions = [
        { label: t("مزامنة ثنائية الاتجاه (التغييرات تسير في كلا الاتجاهين)", "Two-way sync (changes flow in both directions)"), value: "both" },
        { label: t("هذا الجهاز هو المصدر (رفع فقط)", "This device is the source (upload only)"), value: "push" },
        { label: t("السحابة هي المصدر (تنزيل فقط)", "Cloud is the source (download only)"), value: "pull" },
        { label: t("بلا مزامنة تلقائية (مزامنة يدوية عبر الأزرار أدناه فقط)", "No auto-sync (manual sync via buttons below only)"), value: "manual" }
    ];

    async function changeUrl(url: string) {
        cloud.url = url;
        cloud.authenticated = false;

        await deauthorizeCloud();
        await authorizeCloud();

        setInputKey(prev => prev + 1);
    }

    return (
        <SettingsTab>
            <Card
                index={0}
                title={t("المزامنة السحابية", "Cloud sync")}
                subtitle={t(
                    "زامن إعداداتك عبر أجهزتك، واختر الخادم الذي تُحفَظ عليه.",
                    "Sync your settings across your devices, and choose the server they live on."
                )}
                badge={isAuthenticated ? t("متّصل", "Connected") : t("غير متّصل", "Not connected")}
                badgeTone={isAuthenticated ? "ok" : "danger"}
            />

            <Card
                index={1}
                title={t("تكامل السحابة", "Cloud integration")}
                subtitle={t("يتيح تكامل سحابة Equicord مزامنة إعداداتك عبر أجهزة متعددة", "Equicord Cloud integration allows you to sync your settings across multiple devices")}
            >
                <NoticeStrip>
                    {isArabicMode()
                        ? <>نستخدم خادمنا الخاص <Link href="https://github.com/Equicord/Equicloud">Equicloud</Link> بمزايا محسّنة. اطلع على <Link href="https://equicord.org/cloud/policy">سياسة الخصوصية</Link> لمعرفة ما نخزّنه وكيف نستخدم بياناتك. Equicloud مرخص بترخيص BSD 3.0، يمكنك استضافته بنفسك إن أردت.</>
                        : <>We use our own <Link href="https://github.com/Equicord/Equicloud">Equicloud</Link> server with enhanced features. See our <Link href="https://equicord.org/cloud/policy">Privacy Policy</Link> to learn what we store and how we use your data. Equicloud is licensed under BSD 3.0 — you can self-host it if you wish.</>
                    }
                </NoticeStrip>

                <FormSwitch
                    title={t("تفعيل تكامل السحابة", "Enable cloud integration")}
                    description={t("الاتصال بالسحابة لمزامنة الإعدادات.", "Connect to the cloud to sync settings.")}
                    value={isAuthenticated}
                    onChange={v => {
                        if (v)
                            authorizeCloud();
                        else
                            cloud.authenticated = v;
                    }}
                    hideBorder
                />
            </Card>

            <Card
                index={2}
                title={t("الخادم السحابي", "Cloud backend")}
                subtitle={t("اختر الخادم السحابي المراد استخدامه لحفظ إعداداتك.", "Choose the cloud backend to use for storing your settings.")}
            >
            <div className={Margins.bottom8}>
                <SearchableSelect
                    options={cloudBackendOptions}
                    value={cloudBackendOptions.find(o => o.value === cloud.url)?.value}
                    onChange={v => changeUrl(v)}
                    closeOnSelect={true}
                    renderOptionPrefix={o => o?.value?.includes("equicord") ? <EquicordIcon /> : <VencordIcon />}
                />
            </div>

            <Flex gap="8px" alignItems="center">
                <div style={{ flex: 1 }}>
                    <CheckedTextInput
                        key={`backendUrl-${inputKey}`}
                        initialValue={cloud.url}
                        onChange={async v => {
                            cloud.url = v;
                            cloud.authenticated = false;
                            await deauthorizeCloud();
                        }}
                        validate={validateUrl}
                    />
                </div>
                <Button
                    disabled={!isAuthenticated}
                    onClick={async () => {
                        cloud.authenticated = false;
                        await deauthorizeCloud();
                        await authorizeCloud();
                    }}
                >
                    <Flex gap="8px" alignItems="center">
                        <RefreshIcon color="currentColor" />
                        {t("إعادة التفويض", "Re-authorize")}
                    </Flex>
                </Button>
            </Flex>
            </Card>

            <Card
                index={3}
                title={t("مزامنة الإعدادات", "Settings sync")}
                subtitle={t("زامن إعدادات Equicord مع السحابة. يتيح ذلك الحفاظ على اتساق إعداداتك عبر أجهزة متعددة دون الحاجة إلى تصدير واستيراد يدوي.", "Sync your Equicord settings with the cloud. This keeps your settings consistent across multiple devices without the need for manual export and import.")}
                badge={cloud.settingsSync ? t("مُفعَّلة", "On") : t("مُعطَّلة", "Off")}
                badgeTone={cloud.settingsSync ? "ok" : "danger"}
            >
                <FormSwitch
                    title={t("تفعيل مزامنة الإعدادات", "Enable settings sync")}
                    description={t("عند التفعيل، يمكن مزامنة إعداداتك مع السحابة وإليها. استخدم الأزرار أدناه للمزامنة اليدوية.", "When enabled, your settings can be synced to and from the cloud. Use the buttons below for manual sync.")}
                    value={cloud.settingsSync}
                    onChange={v => { cloud.settingsSync = v; }}
                    disabled={!isAuthenticated}
                    hideBorder
                />
            </Card>

            <Card
                index={4}
                title={t("قواعد المزامنة لهذا الجهاز", "Sync rules for this device")}
                subtitle={t("يتحكم هذا الإعداد في كيفية انتقال الإعدادات بين هذا الجهاز والسحابة. يمكنك السماح بتدفق التغييرات في كلا الاتجاهين، أو اختيار مصدر رئيسي واحد.", "This setting controls how settings flow between this device and the cloud. You can allow changes to flow in both directions, or choose a single primary source.")}
            >
            <Select
                options={syncDirectionOptions}
                isSelected={v => v === (localStorage.Vencord_cloudSyncDirection ?? "both")}
                select={v => {
                    localStorage.Vencord_cloudSyncDirection = v;
                    forceUpdate();
                }}
                serialize={v => v}
                isDisabled={!syncEnabled}
            />

            <Flex gap="8px" className={Margins.top16}>
                <Button
                    style={{ flex: 1 }}
                    disabled={!syncEnabled}
                    onClick={() => putCloudSettings(true)}
                >
                    <Flex gap="8px" alignItems="center">
                        <CloudUploadIcon />
                        {t("رفع إلى السحابة", "Upload to Cloud")}
                    </Flex>
                </Button>
                <Button
                    style={{ flex: 1 }}
                    disabled={!syncEnabled}
                    onClick={() => getCloudSettings(true, true)}
                >
                    <Flex gap="8px" alignItems="center">
                        <CloudDownloadIcon />
                        {t("تنزيل من السحابة", "Download from Cloud")}
                    </Flex>
                </Button>
            </Flex>

            {!isAuthenticated && (
                <div className={Margins.top16}>
                    <NoticeStrip tone="danger">
                        {t("فعّل تكامل السحابة أعلاه لاستخدام ميزات مزامنة الإعدادات.", "Enable cloud integration above to use the settings sync features.")}
                    </NoticeStrip>
                </div>
            )}
            </Card>

            {/* 🔴 «منطقة الخطر» تُفصَل ببطاقتها وشريط تحذير أحمر: الفعلان هنا
                لا رجعة فيهما، فلا يجوز أن يبدوا كبقيّة الأزرار. */}
            <Card
                index={5}
                title={t("منطقة الخطر", "Danger zone")}
                subtitle={t("احذف جميع بياناتك من السحابة نهائياً. لا يمكن التراجع عن هذا الإجراء وسيُزيل جميع الإعدادات المزامَنة وأي بيانات أخرى مخزّنة على الخادم السحابي.", "Permanently delete all your data from the cloud. This action cannot be undone and will remove all synced settings and any other data stored on the cloud server.")}
            >
            <Flex gap="8px">
                <Button
                    variant="dangerPrimary"
                    size="medium"
                    disabled={!syncEnabled}
                    onClick={() => deleteCloudSettings()}
                >
                    <Flex gap="8px" alignItems="center">
                        <TrashIcon color="currentColor" />
                        {t("حذف إعدادات السحابة", "Delete Cloud Settings")}
                    </Flex>
                </Button>
                <Button
                    variant="dangerSecondary"
                    size="medium"
                    disabled={!isAuthenticated}
                    onClick={() => Alerts.show({
                        title: t("حذف حساب السحابة", "Delete Cloud Account"),
                        body: t("هل أنت متأكد أنك تريد حذف حسابك السحابي وجميع البيانات المرتبطة به نهائياً؟ لا يمكن التراجع عن هذا الإجراء.", "Are you sure you want to permanently delete your cloud account and all associated data? This action cannot be undone."),
                        onConfirm: eraseAllCloudData,
                        confirmText: t("حذف الحساب", "Delete Account"),
                        confirmColor: "vc-cloud-erase-data-danger-btn",
                        cancelText: t("إلغاء", "Cancel")
                    })}
                >
                    <Flex gap="8px" alignItems="center">
                        <SkullIcon />
                        {t("حذف حساب السحابة", "Delete Cloud Account")}
                    </Flex>
                </Button>
            </Flex>
            </Card>
        </SettingsTab>
    );
}

export default wrapTab(CloudTab, "Cloud");
