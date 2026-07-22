/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./VencordTab.css";

import { openNotificationLogModal } from "@api/Notifications/notificationLog";
import { plugins } from "@api/PluginManager";
import { Settings, useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { FolderIcon, GithubIcon, LogIcon, PaintbrushIcon, RestartIcon } from "@components/Icons";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { openContributorModal, openPluginModal, SettingsTab, wrapTab } from "@components/settings";
import { ESHARQ_LOGO } from "@components/settings/esharqLogo";
import { QuickAction, QuickActionCard } from "@components/settings/QuickAction";
import { SpecialCard } from "@components/settings/SpecialCard";
import BadgeAPI from "@plugins/_api/badges";
import { gitRemote } from "@shared/vencordUserAgent";
import { IS_WINDOWS, VC_DONOR_ROLE_ID, VC_GUILD_ID } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { applyArabicFont } from "@utils/esharqFont";
import { t } from "@utils/esharqI18n";
import { Margins } from "@utils/margins";
import { isAnyPluginDev, isEsharqContributor } from "@utils/misc";
import { relaunch } from "@utils/native";
import { Alerts, GuildMemberStore, React, UserStore } from "@webpack/common";

import { DonateButtonComponent } from "./DonateButton";
import { MacOSVibrancySettings } from "./MacVibrancySettings";
import { NotificationSection } from "./NotificationSettings";
import { WindowsMaterialSettings } from "./WindowsMaterialSettings";

const cl = classNameFactory("vc-vencord-tab-");

type KeysOfType<Object, Type> = {
    [K in keyof Object]: Object[K] extends Type ? K : never;
}[keyof Object];

function EquicordSettings() {
    const settings = useSettings();
    useSettings(["plugins.Settings.arabicMode", "plugins.Settings.arabicFont"]);

    const arabicMode: boolean = (Settings.plugins as any)?.Settings?.arabicMode ?? false;
    const arabicFont: boolean = (Settings.plugins as any)?.Settings?.arabicFont ?? true;

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

            <Heading className={Margins.top16}>{t("إجراءات سريعة", "Quick Actions")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {t(
                    "إجراءات شائعة الاستخدام. توفر هذه الاختصارات وصولاً سريعاً للميزات الأكثر استخداماً دون التنقل عبر القوائم.",
                    "Common actions. These shortcuts provide quick access to the most used features without navigating through menus."
                )}
            </Paragraph>

            <QuickActionCard>
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
            </QuickActionCard>

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>{t("إعدادات العميل", "Client Settings")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {t(
                    "اضبط كيفية عمل Esharq مع ديسكورد. تؤثر هذه الإعدادات على مظهر وسلوك تطبيق ديسكورد.",
                    "Configure how Esharq works with Discord. These settings affect the appearance and behavior of the Discord app."
                )}
            </Paragraph>
            <Notice.Info className={Margins.bottom20} style={{ width: "100%" }}>
                {t(
                    "يمكنك تخصيص موضع قسم الإعدادات هذا في قائمة إعدادات ديسكورد عبر ",
                    "You can customize the position of this settings section in Discord settings via "
                )}
                <a
                    role="button"
                    onClick={() => openPluginModal(plugins.Settings)}
                    style={{ cursor: "pointer", color: "var(--text-link)" }}
                >
                    {t("إضافة الإعدادات", "the Settings plugin")}
                </a>.
            </Notice.Info>

            <FormSwitch
                value={arabicMode}
                onChange={v => {
                    (Settings.plugins as any).Settings.arabicMode = v;
                    // اللغة مُجمّدة حتى إعادة التشغيل، فنُظهر التنبيه فوراً. نصّ t() يأتي باللغة
                    // الحالية للجلسة (المُجمّدة): إنجليزي إن كان العميل إنجليزياً وفعّلنا العربية، والعكس.
                    Alerts.show({
                        title: t("إعادة تشغيل مطلوبة", "Restart Required"),
                        body: t(
                            "يلزم إعادة تشغيل ديسكورد لتطبيق تغيير اللغة.",
                            "A Discord restart is required to apply the language change."
                        ),
                        confirmText: t("إعادة التشغيل الآن", "Restart Now"),
                        cancelText: t("لاحقاً", "Later"),
                        onConfirm: relaunch
                    });
                }}
                title="وضع اللغة العربية / Arabic Mode"
                description={t(
                    "تفعيل أسماء ووصف الإضافات وإعدادات Esharq باللغة العربية.",
                    "Enable Arabic names, descriptions, and settings for plugins and the Esharq panel."
                )}
                hideBorder
            />

            <FormSwitch
                value={arabicFont}
                onChange={v => {
                    (Settings.plugins as any).Settings.arabicFont = v;
                    applyArabicFont(v);
                }}
                title={t("خطّ التعريب العربي (Tajawal)", "Arabic Font (Tajawal)")}
                description={t(
                    "توحيد خطّ كل النصّ العربي (واجهة ديسكورد وواجهة Esharq والإضافات). مفعّل افتراضياً — عطّله للإبقاء على خطّ ديسكورد. يمسّ المحارف العربية فقط دون اللاتيني والأكواد.",
                    "Unify the font of all Arabic text (Discord UI, the Esharq panel, and plugins). On by default — disable to keep Discord's font. Only Arabic glyphs are affected; Latin and code stay untouched."
                )}
                hideBorder
            />

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

            <MacOSVibrancySettings />
            <WindowsMaterialSettings />

            <NotificationSection />
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
