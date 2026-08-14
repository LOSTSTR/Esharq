/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { FormSwitch } from "@components/FormSwitch";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { Card, NoticeStrip } from "@components/settings/esharq/Card";
import { classNameFactory } from "@utils/css";
import { t } from "@utils/esharqI18n";
import { Margins } from "@utils/margins";
import { useAwaiter } from "@utils/react";
import { React, TextInput } from "@webpack/common";

const cl = classNameFactory("vc-settings-theme-");

export function Validator({ link, onValidate }: { link: string; onValidate: (valid: boolean) => void; }) {
    const [res, err, pending] = useAwaiter(() => fetch(link).then(res => {
        if (res.status > 300) throw `${res.status} ${res.statusText}`;
        const contentType = res.headers.get("Content-Type");
        if (!contentType?.startsWith("text/css") && !contentType?.startsWith("text/plain")) {
            onValidate(false);
            throw t("ليس ملف CSS. تذكّر استخدام الرابط الخام (raw)!", "Not a CSS file. Remember to use the raw link!");
        }

        onValidate(true);
        return "Okay!";
    }));

    const text = pending
        ? t("جارٍ الفحص...", "Checking...")
        : err
            ? `${t("خطأ", "Error")}: ${err instanceof Error ? err.message : String(err)}`
            : t("صالح!", "Valid!");

    return <Paragraph style={{
        color: pending ? "var(--text-muted)" : err ? "var(--text-feedback-critical)" : "var(--status-positive)"
    }}>{text}</Paragraph>;
}

export interface OnlineThemesSectionProps {
    enableOnlineThemes: boolean;
    setEnableOnlineThemes: (value: boolean) => void;
    currentThemeLink: string;
    setCurrentThemeLink: (value: string) => void;
    themeLinkValid: boolean;
    setThemeLinkValid: (value: boolean) => void;
    addThemeLink: (link: string) => void;
    index?: number;
}

export function OnlineThemesSection({
    enableOnlineThemes,
    setEnableOnlineThemes,
    currentThemeLink,
    setCurrentThemeLink,
    themeLinkValid,
    setThemeLinkValid,
    addThemeLink,
    index = 0
}: OnlineThemesSectionProps) {
    return (
        <Card
            index={index}
            title={t("القوالب عبر الإنترنت", "Online themes")}
            subtitle={t(
                "حمّل القوالب مباشرةً من روابط بدل الملفات المحليّة. القوالب عبر الإنترنت تُحدَّث تلقائياً عند تغيّر مصدرها، فتبقى لديك أحدث نسخة دون تنزيل يدوي.",
                "Load themes directly from URLs instead of local files. Online themes auto-update when the source changes, so you always have the latest version without manual downloads."
            )}
            badge={enableOnlineThemes ? t("مُفعَّلة", "On") : t("مُعطَّلة", "Off")}
        >
            <FormSwitch
                title={t("تفعيل القوالب عبر الإنترنت", "Enable online themes")}
                description={t(
                    "تشغيل أو إيقاف تحميل القوالب عبر الإنترنت. عند الإيقاف تُعطَّل كل القوالب عبر الإنترنت ولن تتمكّن من إضافة قوالب جديدة.",
                    "Toggle online theme loading. When disabled, all online themes will be turned off and you won't be able to add new ones."
                )}
                value={enableOnlineThemes}
                onChange={setEnableOnlineThemes}
                hideBorder
            />

            {/* الجملة مقسّمة حول رابطين، فلا يمكن أن تكون نصاً واحداً: نُعرّب كل جزء على حدة
                ونُبقي الاسمين العَلَمين (BetterDiscord Themes / GitHub) كما هما. */}
            <NoticeStrip>
                {t("تبحث عن قوالب؟ جرّب ", "Looking for themes? Check out ")}
                <Link href="https://betterdiscord.app/themes">BetterDiscord Themes</Link>
                {t(" أو ابحث في ", " or search on ")}
                <Link href="https://github.com/search?q=discord+theme">GitHub</Link>
                {t(
                    ". عند التنزيل من BetterDiscord، اضغط \"Download\" وضَع ملف ‎.theme.css في مجلد القوالب لديك.",
                    ". When downloading from BetterDiscord, click \"Download\" and place the .theme.css file into your themes folder."
                )}
            </NoticeStrip>

            <div className={cl("link-row")}>
                <TextInput
                    placeholder="https://example.com/theme.css"
                    value={currentThemeLink}
                    onChange={setCurrentThemeLink}
                    disabled={!enableOnlineThemes}
                />
                <Button onClick={() => addThemeLink(currentThemeLink)} disabled={!themeLinkValid || !enableOnlineThemes}>
                    {t("إضافة", "Add")}
                </Button>
            </div>
            {currentThemeLink && (
                <div className={Margins.top8}>
                    <Validator link={currentThemeLink} onValidate={setThemeLinkValid} />
                </div>
            )}
        </Card>
    );
}
