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

import { useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { Divider } from "@components/Divider";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { Heading, HeadingSecondary } from "@components/Heading";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import { t } from "@utils/esharqI18n";
import { Margins } from "@utils/margins";
import { useAwaiter } from "@utils/react";
import { getRepo, isNewer, UpdateLogger } from "@utils/updater";
import { React } from "@webpack/common";

import gitHash from "~git-hash";

import { HashLink, Newer, Updatable } from "./Components";

interface CommonProps {
    repo: string;
    repoPending: boolean;
}

function EquibopSection() {
    if (!IS_EQUIBOP) return null;

    const [isEquibopOutdated] = useAwaiter<boolean>(VesktopNative.app.isOutdated, { fallbackValue: false });

    return (
        <Flex className={Margins.bottom20} flexDirection="column" gap="1em">
            <Card variant="brand">
                <HeadingSecondary>Equibop & Equicord</HeadingSecondary>
                <Paragraph>{t("Equibop و Equicord شيئان منفصلان. هذا المُحدِّث خاصّ بـ Equicord.", "Equibop and Equicord are two separate things. This updater is for Equicord.")}</Paragraph>
                <Paragraph className={Margins.top8}>
                    {t("تصلك نوافذ منفصلة لتحديثات Equibop، ويمكنك أيضاً تحديثه يدوياً بتثبيت ", "You receive separate popups for Equibop updates. You can also manually update by installing the ")}
                    <Link href="https://equibop.org/install">{t("أحدث إصدار", "latest version")}</Link>.
                </Paragraph>
            </Card>

            {isEquibopOutdated && (
                <Card variant="warning">
                    <HeadingSecondary>{t("إصدار Equibop قديم", "Equibop Outdated")}</HeadingSecondary>
                    <Flex flexDirection="column" gap="0.5em">
                        <Paragraph>{t("إصدارك من Equibop قديم!", "Your version of Equibop is outdated!")}</Paragraph>
                        <Button variant="link" onClick={() => VesktopNative.app.openUpdater()}>{t("افتح مُحدِّث Equibop", "Open Equibop Updater")}</Button>
                    </Flex>
                </Card>
            )}
        </Flex>
    );
}

function Updater() {
    const settings = useSettings(["autoUpdate", "autoUpdateNotification", "plugins.Settings.arabicMode"]);

    const [repo, err, repoPending] = useAwaiter(getRepo, { fallbackValue: t("جارٍ التحميل…", "Loading...") });

    React.useEffect(() => {
        if (err)
            UpdateLogger.error("Failed to retrieve repo", err);
    }, [err]);

    const commonProps: CommonProps = {
        repo,
        repoPending
    };

    return (
        <SettingsTab>
            <EquibopSection />
            <Heading className={Margins.top16}>{t("تفضيلات التحديث", "Update Preferences")}</Heading>
            <Paragraph className={Margins.bottom20}>
                {t("تحكم في كيفية تحديث Esharq تلقائياً.", "Control how Esharq updates automatically.")}
            </Paragraph>

            <FormSwitch
                title={t("تحديث تلقائي", "Auto Update")}
                description={t("عند التفعيل، يقوم Esharq بتنزيل التحديثات وتثبيتها في الخلفية دون طلب تأكيد. ستحتاج إلى إعادة تشغيل ديسكورد لتطبيق التغييرات.", "When enabled, Esharq will download and install updates in the background without prompting. A Discord restart is required to apply changes.")}
                value={settings.autoUpdate}
                onChange={(v: boolean) => settings.autoUpdate = v}
                hideBorder
            />
            <FormSwitch
                value={settings.autoUpdateNotification}
                onChange={(v: boolean) => settings.autoUpdateNotification = v}
                title={t("إشعار عند اكتمال التحديث التلقائي", "Notify on Auto-Update Completion")}
                description={t("تلقّ إشعاراً عندما ينتهي Esharq من تنزيل تحديث في الخلفية", "Receive a notification when Esharq finishes downloading an update in the background")}
                disabled={!settings.autoUpdate}
                hideBorder
            />

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>{t("المستودع", "Repository")}</Heading>
            <Paragraph className={Margins.bottom8}>
                {t("هذا هو مستودع GitHub الذي يسحب Esharq منه التحديثات.", "This is the GitHub repository Esharq pulls updates from.")}
            </Paragraph>
            <Paragraph color="text-subtle">
                {repoPending
                    ? repo
                    : err
                        ? t("تعذّر الجلب — راجع الكونسول", "Failed to retrieve - check console")
                        : (
                            <Link href={repo}>
                                {repo.split("/").slice(-2).join("/")}
                            </Link>
                        )
                }
                {" "}(<HashLink hash={gitHash} repo={repo} disabled={repoPending} />)
            </Paragraph>

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>Updates</Heading>
            {isNewer ? <Newer {...commonProps} /> : <Updatable {...commonProps} />}
        </SettingsTab>
    );
}

export default IS_UPDATER_DISABLED
    ? null
    : wrapTab(Updater, "Updater");
