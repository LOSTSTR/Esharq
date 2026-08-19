/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./VencordTab.css";

import { openNotificationLogModal } from "@api/Notifications/notificationLog";
import { useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { FormSwitch } from "@components/FormSwitch";
import { FolderIcon, GithubIcon, LogIcon, PaintbrushIcon, RestartIcon } from "@components/Icons";
import { Notice } from "@components/Notice";
import { openContributorModal, SettingsTab, wrapTab } from "@components/settings";
import { Card } from "@components/settings/esharq/Card";
import { ESHARQ_LOGO } from "@components/settings/esharqLogo";
import { QuickAction } from "@components/settings/QuickAction";
import { SpecialCard } from "@components/settings/SpecialCard";
import BadgeAPI from "@plugins/_api/badges";
import { gitRemote } from "@shared/vencordUserAgent";
import { IS_WINDOWS, VC_DONOR_ROLE_ID, VC_GUILD_ID } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import { Margins } from "@utils/margins";
import { isAnyPluginDev, isEsharqContributor } from "@utils/misc";
import { relaunch } from "@utils/native";
import { Alerts, GuildMemberStore, React, UserStore } from "@webpack/common";

import gitHash from "~git-hash";

import { DonateButtonComponent } from "./DonateButton";
import { MacOSVibrancySettings } from "./MacVibrancySettings";
import { NotificationSection } from "./NotificationSettings";
import { WindowsMaterialSettings } from "./WindowsMaterialSettings";

type KeysOfType<Object, Type> = {
    [K in keyof Object]: Object[K] extends Type ? K : never;
}[keyof Object];

function EquicordSettings() {
    const settings = useSettings();

    const user = UserStore?.getCurrentUser();

    const switches = [
        {
            key: "useQuickCss",
            title: t("تفعيل CSS المخصص", "Enable Custom CSS"),
            description: t(
                "تحميل CSS مخصص من محرر QuickCSS.",
                "Load custom CSS from the QuickCSS editor."
            ),
        },
        !IS_WEB && {
            key: "enableReactDevtools",
            title: t("تفعيل أدوات مطوري React", "Enable React DevTools"),
            description: t(
                "تفعيل امتداد أدوات مطوري React لتصحيح مكونات React في ديسكورد.",
                "Enable the React DevTools extension to debug React components in Discord."
            ),
            restartRequired: true,
        },
        (!IS_WEB && !IS_DISCORD_DESKTOP || !IS_WINDOWS) && {
            key: "mainWindowFrameless",
            title: t("تعطيل إطار النافذة الرئيسية", "Disable Main Window Frame"),
            description: t(
                "إزالة إطار النافذة الأصلي للحصول على مظهر أنظف. يمكنك تحريك النافذة بسحب منطقة شريط العنوان.",
                "Remove the native window frame for a cleaner look. You can move the window by dragging the title bar area."
            ),
            restartRequired: true,
        },
        !IS_WEB && (!IS_DISCORD_DESKTOP || !IS_WINDOWS
            ? {
                key: "frameless",
                title: t("تعطيل جميع إطارات النوافذ", "Disable All Window Frames"),
                description: t(
                    "إزالة إطار النافذة الأصلي للحصول على مظهر أنظف. يمكنك تحريك النافذة بسحب منطقة شريط العنوان.",
                    "Remove the native window frame for a cleaner look. You can move the window by dragging the title bar area."
                ),
                restartRequired: true,
            }
            : {
                key: "winNativeTitleBar",
                title: t(
                    "استخدام شريط العنوان الأصلي لويندوز بدلاً من شريط ديسكورد المخصص",
                    "Use Native Windows Title Bar Instead of Discord's Custom Bar"
                ),
                description: t(
                    "استبدال شريط عنوان ديسكورد المخصص بشريط عنوان ويندوز القياسي.",
                    "Replace Discord's custom title bar with the standard Windows title bar."
                ),
                restartRequired: true,
            }
        ),
        !IS_WEB && {
            key: "transparent",
            title: t("تفعيل شفافية النافذة", "Enable Window Transparency"),
            description: t(
                "جعل نافذة ديسكورد شفافة. يتطلب قالباً يدعم الشفافية وإلا لن يكون له أي أثر.",
                "Make the Discord window transparent. Requires a theme that supports transparency, otherwise it has no effect."
            ),
            restartRequired: true,
            warning: IS_WINDOWS
                ? t(
                    "سيوقف هذا إمكانية تغيير حجم النافذة ويمنعك من تثبيتها على حواف الشاشة.",
                    "This will prevent resizing the window and snapping it to screen edges."
                )
                : t(
                    "سيوقف هذا إمكانية تغيير حجم النافذة.",
                    "This will prevent resizing the window."
                ),
        },
        IS_DISCORD_DESKTOP && {
            key: "disableMinSize",
            title: t("تعطيل الحجم الأدنى للنافذة", "Disable Minimum Window Size"),
            description: t(
                "السماح بتصغير نافذة ديسكورد إلى أقل من حجمها الافتراضي الأدنى. مفيد لمديري النوافذ المبلطة والشاشات الصغيرة.",
                "Allow the Discord window to be resized below its default minimum size. Useful for tiling window managers and small screens."
            ),
            restartRequired: true,
        },
        !IS_WEB && IS_WINDOWS && {
            key: "winCtrlQ",
            title: t("تسجيل Ctrl+Q كاختصار لإغلاق ديسكورد", "Register Ctrl+Q as Discord Close Shortcut"),
            description: t(
                "إضافة Ctrl+Q كاختصار لوحة مفاتيح لإغلاق ديسكورد. يوفر بديلاً لـ Alt+F4 لإغلاق التطبيق بسرعة.",
                "Add Ctrl+Q as a keyboard shortcut to close Discord. Provides an alternative to Alt+F4 for quickly closing the app."
            ),
            restartRequired: true,
        },
        !IS_WEB && {
            key: "hardwareVideoAcceleration",
            title: t("تسريع الفيديو بالمعالج الرسومي", "Hardware Video Acceleration"),
            description: t(
                "يُفعّل فك وترميز الفيديو عبر GPU بدلاً من CPU، مما يُقلل استهلاك المعالج أثناء مكالمات الفيديو ومشاركة الشاشة وتشغيل مقاطع الفيديو المضمّنة. عطّله إذا واجهت مشاكل مع بطاقة رسومية قديمة.",
                "Offloads video decoding and encoding to the GPU instead of the CPU, reducing CPU usage during video calls, screen sharing, and embedded video playback. Disable if you experience issues with an older GPU."
            ),
            restartRequired: true,
        },
        !IS_WEB && {
            key: "htmlFullscreenFix",
            title: t("إصلاح الشاشة الكاملة لمقاطع HTML5", "HTML5 Fullscreen Fix"),
            description: t(
                "يمنع مقاطع فيديو HTML5 المضمّنة (كـ YouTube وTwitch) من جعل نافذة ديسكورد بأكملها تدخل وضع الشاشة الكاملة. بعد التفعيل يبقى الفيديو داخل نافذة ديسكورد فقط.",
                "Prevents embedded HTML5 videos (e.g. YouTube, Twitch clips) from forcing the entire Discord window into OS-level fullscreen. The video stays inside the Discord window instead."
            ),
            restartRequired: true,
        },
    ] satisfies Array<false | {
        key: KeysOfType<typeof settings, boolean>;
        title: string;
        description?: string;
        restartRequired?: boolean;
        warning?: string;
    }>;

    return (
        <SettingsTab>
            {/* بطاقة الرأس — نفس بنية صفحة المُحدِّث: عنوان ووصف وشارة حال.
                والشارة **بصمة الالتزام مقصوصة إلى سبعة**: الكاملة أربعون محرفاً
                تلتفّ على سطرين وتُفسد الصفّ، ولا يقرأ أحد ما بعد السابع منها. */}
            <Card
                index={0}
                title={t("نظرة عامة", "Overview")}
                subtitle={t(
                    "تحكّم في العميل ومظهره وإشعاراته من مكان واحد.",
                    "Manage the client, its appearance, and its notifications from one place."
                )}
                badge={gitHash.slice(0, 7)} badgeTone="info"
            />

            {(isEsharqDonor(user?.id) || isVencordDonor(user?.id)) ? (
                <SpecialCard
                    title={t("التبرعات", "Donations")}
                    subtitle={t("شكراً لتبرعك!", "Thank you for donating!")}
                    description={
                        isEsharqDonor(user?.id) && isVencordDonor(user?.id)
                            ? t(
                                "يرى جميع مستخدمي Vencord شارة متبرع Vencord، ويرى مستخدمو Esharq شارة متبرع Esharq. لتغيير شارتك في Vencord تواصل مع @vending.machine، ولشارة Esharq افتح تذكرة في سيرفر Esharq.",
                                "All Vencord users see a Vencord donor badge, and Esharq users see an Esharq donor badge. To change your Vencord badge contact @vending.machine, and for the Esharq badge open a ticket in the Esharq server."
                            )
                            : isVencordDonor(user?.id)
                                ? t(
                                    "يرى جميع مستخدمي Vencord شارتك! يمكنك إدارة مزاياك عبر مراسلة @vending.machine.",
                                    "All Vencord users can see your badge! You can manage your perks by messaging @vending.machine."
                                )
                                : t(
                                    "يرى جميع مستخدمي Esharq شارتك! يمكنك إدارة مزاياك عبر فتح تذكرة في سيرفر Esharq.",
                                    "All Esharq users can see your badge! You can manage your perks by opening a ticket in the Esharq server."
                                )
                    }
                    cardImage={ESHARQ_LOGO}
                    backgroundColor="#ED87A9"
                >
                    <DonateButtonComponent donated={true} />
                </SpecialCard>
            ) : (
                <SpecialCard
                    title={t("ادعم المشروع", "Support the Project")}
                    description={t(
                        "يسعدنا دعمك لتطوير Esharq من خلال التبرع!",
                        "Support Esharq development by donating!"
                    )}
                    cardImage={ESHARQ_LOGO}
                    backgroundColor="#c3a3ce"
                >
                    <DonateButtonComponent />
                </SpecialCard>
            )}
            {(isAnyPluginDev(user?.id) || isEsharqContributor(user?.id)) && (
                <SpecialCard
                    title={t("المساهمات", "Contributions")}
                    subtitle={t("شكراً لمساهمتك!", "Thank you for contributing!")}
                    description={t(
                        "بفضل مساهمتك في Esharq، حصلت على شارة مميزة!",
                        "As a contributor to Esharq, you earned a special badge!"
                    )}
                    cardImage={ESHARQ_LOGO}
                    backgroundColor="#EDCC87"
                >
                    <Button
                        variant="none"
                        size="medium"
                        type="button"
                        onClick={() => openContributorModal(user)}
                        className="vc-contrib-button"
                    >
                        <GithubIcon aria-hidden fill="currentColor" className={"vc-contrib-github"} />
                        {t("عرض مساهماتك", "View your contributions")}
                    </Button>
                </SpecialCard>
            )}

            <Card
                index={1}
                title={t("إجراءات سريعة", "Quick Actions")}
                subtitle={t(
                    "افتح الأدوات التي تستعملها أكثر من غيرها دون مغادرة هذه الصفحة.",
                    "Open the tools you use most without leaving this page."
                )}
            >
                {/* الأزرار على سطح البطاقة مباشرةً لا داخل بطاقة ثانية:
                    `QuickActionCard` يحمل خلفيته الخاصّة، فتركيبه هنا يُنتج
                    إطاراً داخل إطار — وهو ما يكسر وحدة الشكل مع بقيّة الصفحات. */}
                <div className="esharq-quick-actions">
                    <QuickAction
                        Icon={LogIcon}
                        text={t("سجل الإشعارات", "Notification Log")}
                        action={openNotificationLogModal}
                    />
                    <QuickAction
                        Icon={PaintbrushIcon}
                        text={t("تعديل QuickCSS", "Edit QuickCSS")}
                        action={() => VencordNative.quickCss.openEditor()}
                    />
                    {!IS_WEB && (
                        <QuickAction
                            Icon={RestartIcon}
                            text={t("إعادة تشغيل ديسكورد", "Restart Discord")}
                            action={relaunch}
                        />
                    )}
                    {!IS_WEB && (
                        <QuickAction
                            Icon={FolderIcon}
                            text={t("فتح مجلد الإعدادات", "Open Settings Folder")}
                            action={() => VencordNative.settings.openFolder()}
                        />
                    )}
                    <QuickAction
                        Icon={GithubIcon}
                        text={t("عرض الكود المصدري", "View Source Code")}
                        action={() =>
                            VencordNative.native.openExternal(
                                "https://github.com/" + gitRemote,
                            )
                        }
                    />
                </div>
            </Card>

            {/* 🔴 حُذف إشعاران كانا هنا، وكلاهما صار يكذب على القارئ:
                - «يمكنك تخصيص موضع قسم الإعدادات»: الخيار نفسه أُزيل حين صار
                  التصميم يضع أقسام إشراق تحت «تسجيل الخروج» دائماً.
                - «انتقلت خيارات التعريب إلى إضافة DiscordArabicizer»: انتقلت
                  بعدها إلى صفحة «الأدوات ← اللغة»، فصار الإشعار يدلّ على
                  مكان خطأ — وهو أسوأ من ألّا يدلّ على شيء.
                إشعار الانتقال يُحذف حين ينتهي معناه، وإلّا صار أثراً دائماً. */}
            <Card
                index={2}
                title={t("إعدادات العميل", "Client Settings")}
                subtitle={t(
                    "اضبط كيفية عمل Esharq مع ديسكورد. تؤثر هذه الإعدادات على مظهر وسلوك تطبيق ديسكورد.",
                    "Configure how Esharq works with Discord. These settings affect the appearance and behavior of the Discord app."
                )}
            >
                {switches.filter((s): s is Exclude<typeof s, false> => !!s).map(
                    s => (
                        <FormSwitch
                            key={s.key}
                            value={settings[s.key]}
                            onChange={v => {
                                settings[s.key] = v;

                                if (s.restartRequired) {
                                    Alerts.show({
                                        title: t("إعادة تشغيل مطلوبة", "Restart Required"),
                                        body: t(
                                            "يلزم إعادة تشغيل ديسكورد لتطبيق هذا التغيير",
                                            "A Discord restart is required to apply this change"
                                        ),
                                        confirmText: t("إعادة التشغيل الآن", "Restart Now"),
                                        cancelText: t("لاحقاً", "Later"),
                                        onConfirm: relaunch
                                    });
                                }
                            }}
                            title={s.title}
                            description={
                                s.warning ? (
                                    <>
                                        {s.description}
                                        <Notice.Warning className={Margins.top8} style={{ width: "100%" }}>
                                            {s.warning}
                                        </Notice.Warning>
                                    </>
                                ) : (
                                    s.description
                                )
                            }
                            hideBorder
                        />
                    ),
                )}
            </Card>

            {/* كلٌّ من هذه يحمل بطاقته بنفسه: شرط ظهوره عنده لا عندنا، ولو
                لُفّ من الخارج لظهرت بطاقة فارغة على كل نظام لا يدعمه. */}
            <MacOSVibrancySettings index={3} />
            <WindowsMaterialSettings index={3} />

            <NotificationSection index={4} />
        </SettingsTab>
    );
}

export default wrapTab(EquicordSettings, "Equicord Settings");

export function isEsharqDonor(userId: string): boolean {
    // Card depends only on Esharq's own donor list, so donating to Equicord doesn't trigger it.
    return !!BadgeAPI.EsharqDonorBadges[userId];
}

export function isVencordDonor(userId: string): boolean {
    const donorBadges = BadgeAPI.getDonorBadges(userId);
    return GuildMemberStore.getMember(VC_GUILD_ID, userId)?.roles.includes(VC_DONOR_ROLE_ID) || !!donorBadges;
}
