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
import { Card as PlainCard } from "@components/Card";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { HeadingSecondary } from "@components/Heading";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { Card, StatRow, StatusRow } from "@components/settings/esharq/Card";
import { UNIT } from "@components/settings/esharq/tokens";
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
            <PlainCard variant="brand">
                <HeadingSecondary>Equibop & Equicord</HeadingSecondary>
                <Paragraph>{t("Equibop و Equicord شيئان منفصلان. هذا المُحدِّث خاصّ بـ Equicord.", "Equibop and Equicord are two separate things. This updater is for Equicord.")}</Paragraph>
                <Paragraph className={Margins.top8}>
                    {t("تصلك نوافذ منفصلة لتحديثات Equibop، ويمكنك أيضاً تحديثه يدوياً بتثبيت ", "You receive separate popups for Equibop updates. You can also manually update by installing the ")}
                    <Link href="https://equibop.org/install">{t("أحدث إصدار", "latest version")}</Link>.
                </Paragraph>
            </PlainCard>

            {isEquibopOutdated && (
                <PlainCard variant="warning">
                    <HeadingSecondary>{t("إصدار Equibop قديم", "Equibop Outdated")}</HeadingSecondary>
                    <Flex flexDirection="column" gap="0.5em">
                        <Paragraph>{t("إصدارك من Equibop قديم!", "Your version of Equibop is outdated!")}</Paragraph>
                        <Button variant="link" onClick={() => VesktopNative.app.openUpdater()}>{t("افتح مُحدِّث Equibop", "Open Equibop Updater")}</Button>
                    </Flex>
                </PlainCard>
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

    const repoBroken = !repoPending && err !== undefined && err !== null;
    const repoName = repoPending || repoBroken ? repo : repo.split("/").slice(-2).join("/");

    return (
        <SettingsTab>
            <EquibopSection />

            <Card
                index={0}
                title={t("مُحدِّث إشراق", "Esharq Updater")}
                subtitle={t(
                    "يجلب إشراق تحديثاته من مستودعه ويُثبّتها عند طلبك، أو في الخلفية إن أذنت له.",
                    "Esharq pulls its updates from its repository and installs them on request, or in the background if you allow it."
                )}
                badge={isNewer
                    ? t("إصدار أحدث من المستودع", "Ahead of the repository")
                    : t("جاهز", "Ready")}
                badgeTone={isNewer ? "warn" : "ok"}
            />

            <Card
                index={1}
                title={t("حالة الإصدار", "Release status")}
                subtitle={t(
                    "الإصدار المُثبَّت ومن أين يأتي.",
                    "The installed release and where it comes from."
                )}
            >
                <StatRow items={[
                    { label: t("الإصدار الحالي", "Current version"), value: gitHash },
                    { label: t("المستودع", "Repository"), value: repoName },
                    {
                        label: t("التحديث التلقائي", "Auto update"),
                        value: settings.autoUpdate ? t("مُفعَّل", "On") : t("مُعطَّل", "Off")
                    }
                ]} />

                <div style={{ marginTop: UNIT * 2 }}>
                    <StatusRow
                        index={0}
                        title={t("مصدر التحديثات", "Update source")}
                        detail={repoBroken
                            ? t("تعذّر الجلب — راجع الكونسول", "Failed to retrieve — check the console")
                            : undefined}
                        state={repoPending
                            ? { text: t("جارٍ الفحص", "Checking"), tone: "idle" }
                            : repoBroken
                                ? { text: t("غير متاح", "Unavailable"), tone: "warn" }
                                : { text: t("متّصل", "Reachable"), tone: "ok" }}
                    />
                    <StatusRow
                        index={1}
                        title={t("الالتزام المُثبَّت", "Installed commit")}
                        state={{ text: gitHash, tone: "idle" }}
                    />
                </div>

                {!repoPending && !repoBroken && (
                    <Paragraph className={Margins.top16} color="text-subtle">
                        <Link href={repo}>{repoName}</Link>
                        {" "}(<HashLink hash={gitHash} repo={repo} disabled={repoPending} />)
                    </Paragraph>
                )}
            </Card>

            <Card
                index={2}
                title={t("أدوات التحكّم", "Update controls")}
                subtitle={t(
                    "افحص التحديثات وطبّقها. لا يُعاد تشغيل ديسكورد إلّا حين تطلب ذلك.",
                    "Check for updates and apply them. Discord restarts only when you ask it to."
                )}
            >
                {isNewer ? <Newer {...commonProps} /> : <Updatable {...commonProps} />}
            </Card>

            <Card
                index={3}
                title={t("تفضيلات التحديث", "Update preferences")}
                subtitle={t(
                    "تحكّم في كيفية تحديث إشراق نفسه.",
                    "Control how Esharq updates itself."
                )}
            >
                <FormSwitch
                    title={t("تحديث تلقائي", "Auto update")}
                    description={t(
                        "ينزّل إشراق التحديثات ويثبّتها في الخلفية بلا سؤال. وتظهر التغييرات بعد إعادة تشغيل ديسكورد.",
                        "Esharq downloads and installs updates in the background without asking. The changes appear after Discord restarts."
                    )}
                    value={settings.autoUpdate}
                    onChange={(v: boolean) => settings.autoUpdate = v}
                    hideBorder
                />
                <FormSwitch
                    value={settings.autoUpdateNotification}
                    onChange={(v: boolean) => settings.autoUpdateNotification = v}
                    title={t("إشعار عند اكتمال التحديث", "Notify when an update finishes")}
                    description={t(
                        "يصلك إشعار حين ينتهي تنزيل تحديث في الخلفية.",
                        "You get a notification when a background update finishes downloading."
                    )}
                    disabled={!settings.autoUpdate}
                    hideBorder
                />
            </Card>
        </SettingsTab>
    );
}

export default IS_UPDATER_DISABLED
    ? null
    : wrapTab(Updater, "Updater");
