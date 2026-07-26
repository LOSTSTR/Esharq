/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { BadgePosition, ProfileBadge } from "@api/Badges";
import { DataStore } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { isArabicMode, t } from "@utils/esharqI18n";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { chooseFile } from "@utils/web";
import { Button, showToast, Text, TextInput, Toasts, useEffect, UserStore, useState } from "@webpack/common";

const cl = classNameFactory("vc-mybadges-");
const logger = new Logger("MyBadges");
const STORE_KEY = "MyBadges_badges";

/** Anything bigger is a waste for a badge and bloats the local database. */
const MAX_BYTES = 2 * 1024 * 1024;

interface LocalBadge {
    id: string;
    name: string;
    src: string;
}

let badges: LocalBadge[] = [];
const listeners = new Set<() => void>();

function notifyChanged() {
    for (const listener of listeners) listener();
}

async function save() {
    try {
        await DataStore.set(STORE_KEY, badges);
    } catch (e) {
        logger.error("failed to save badges", e);
        showToast(t("تعذّر حفظ الشارة.", "Couldn't save the badge."), Toasts.Type.FAILURE);
    }
    notifyChanged();
}

function addBadge(name: string, src: string) {
    badges = [...badges, { id: `${Date.now()}`, name: name.trim() || t("شارتي", "My badge"), src }];
    void save();
}

function removeBadge(id: string) {
    badges = badges.filter(badge => badge.id !== id);
    void save();
}

function useBadges(): LocalBadge[] {
    const [, forceUpdate] = useState(0);
    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        listeners.add(listener);
        return () => void listeners.delete(listener);
    }, []);
    return badges;
}

/** Read a picked image into a data URI so it lives on THIS device only. */
function readAsDataUri(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

async function pickFromDevice() {
    const file = await chooseFile("image/*");
    if (!file) return;

    if (file.size > MAX_BYTES) {
        showToast(
            t("الصورة كبيرة جداً (الحد 2 ميجابايت).", "That image is too large (2 MB limit)."),
            Toasts.Type.FAILURE
        );
        return;
    }

    try {
        addBadge(file.name.replace(/\.[^.]+$/, ""), await readAsDataUri(file));
        showToast(t("تمت إضافة الشارة.", "Badge added."), Toasts.Type.SUCCESS);
    } catch (e) {
        logger.error("failed to read the picked image", e);
        showToast(t("تعذّر قراءة الصورة.", "Couldn't read that image."), Toasts.Type.FAILURE);
    }
}

const SIZES = [
    { value: "16", label: "16px" },
    { value: "22", label: "22px" },
    { value: "28", label: "28px" },
    { value: "36", label: "36px" },
    { value: "48", label: "48px" }
] as const;

function BadgeManager() {
    const list = useBadges();
    const [url, setUrl] = useState("");
    const [name, setName] = useState("");
    const size = Number(settings.store.badgeSize);

    function addFromUrl() {
        const trimmed = url.trim();
        if (!/^https:\/\/\S+$/i.test(trimmed)) {
            showToast(
                t("أدخل رابطاً مباشراً يبدأ بـ https://", "Enter a direct link starting with https://"),
                Toasts.Type.FAILURE
            );
            return;
        }
        addBadge(name, trimmed);
        setUrl("");
        setName("");
        showToast(t("تمت إضافة الشارة.", "Badge added."), Toasts.Type.SUCCESS);
    }

    return (
        <div className={cl("root")} dir={isArabicMode() ? "rtl" : "ltr"}>
            <div className={cl("note")}>
                {t(
                    "هذه الشارات محلية تماماً: تُخزَّن على جهازك ولا تُرسَل إلى ديسكورد، فلا يراها أحد غيرك.",
                    "These badges are fully local: stored on your device and never sent to Discord, so nobody else can see them."
                )}
            </div>

            <Text variant="text-sm/semibold" className={cl("label")}>
                {t("إضافة شارة", "Add a badge")}
            </Text>

            <div className={cl("add")}>
                <TextInput
                    value={name}
                    onChange={setName}
                    placeholder={t("اسم الشارة (يظهر عند مرور المؤشر)", "Badge name (shown on hover)")}
                />
                <div className={cl("row")}>
                    <TextInput
                        value={url}
                        onChange={setUrl}
                        placeholder={t("رابط مباشر للصورة https://...", "Direct image link https://...")}
                    />
                    <Button color={Button.Colors.BRAND} onClick={addFromUrl}>
                        {t("من رابط", "From link")}
                    </Button>
                    <Button color={Button.Colors.PRIMARY} onClick={() => void pickFromDevice()}>
                        {t("من جهازي", "From device")}
                    </Button>
                </div>
            </div>

            <Text variant="text-sm/semibold" className={cl("label")}>
                {t(`شاراتي (${list.length})`, `My badges (${list.length})`)}
            </Text>

            {list.length === 0 ? (
                <div className={cl("empty")}>
                    {t("لا توجد شارات بعد.", "No badges yet.")}
                </div>
            ) : (
                <div className={cl("list")}>
                    {list.map(badge => (
                        <div className={cl("item")} key={badge.id}>
                            <img
                                className={cl("preview")}
                                src={badge.src}
                                alt=""
                                style={{ width: size, height: size }}
                            />
                            <span className={cl("name")}>{badge.name}</span>
                            <Button
                                size={Button.Sizes.SMALL}
                                color={Button.Colors.RED}
                                onClick={() => removeBadge(badge.id)}
                            >
                                {t("حذف", "Remove")}
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const settings = definePluginSettings({
    badgeSize: {
        type: OptionType.SELECT,
        description: "How big your badges are drawn. Discord's own badges are 22px, so pick that to blend in, or a larger value to stand out.",
        options: SIZES.map(s => ({
            label: s.label,
            value: s.value,
            default: s.value === "22"
        }))
    },
    atStart: {
        type: OptionType.BOOLEAN,
        description: "Place your badges before Discord's own badges instead of after them.",
        default: false
    },
    manager: {
        type: OptionType.COMPONENT,
        description: "",
        component: BadgeManager
    }
});

export default definePlugin({
    name: "MyBadges",
    description: "Put any badge you like on your own profile, from a file on your device or a direct link. The badges are stored locally and drawn only by your client, so nobody else can see them. You choose the size.",
    authors: [EquicordDevs.LOSTSTR],
    tags: ["Appearance", "Customisation", "Privacy"],
    enabledByDefault: false,
    dependencies: ["BadgeAPI"],
    settings,

    // Must be the PLURAL field: PluginManager only ever calls addProfileBadge for
    // `userProfileBadges` (the singular one merely pulls in the BadgeAPI dep).
    // One registered entry expands into the whole local list through getBadges,
    // so adding or removing a badge never needs a re-register.
    userProfileBadges: [{
        id: "vc-mybadges",
        key: "MyBadges",
        description: t("شارة محلية", "Local badge"),
        // Yours and yours only: never drawn on anyone else's profile.
        shouldShow: ({ userId }) => userId === UserStore.getCurrentUser()?.id && badges.length > 0,
        // Read live, because _getBadges takes the position from THIS entry rather
        // than from the ones getBadges returns.
        get position() {
            return settings.store.atStart ? BadgePosition.START : BadgePosition.END;
        },
        getBadges: () => {
            const size = Number(settings.store.badgeSize);

            return badges.map((badge): ProfileBadge => ({
                id: `vc-mybadges-${badge.id}`,
                key: badge.name,
                description: badge.name,
                iconSrc: badge.src,
                props: {
                    className: cl("badge"),
                    style: { width: size, height: size, objectFit: "contain" }
                }
            }));
        }
    }],

    async start() {
        try {
            const saved = await DataStore.get(STORE_KEY);
            if (Array.isArray(saved)) {
                badges = saved.filter(b => typeof b?.src === "string" && typeof b?.id === "string");
            }
        } catch (e) {
            logger.error("failed to load saved badges", e);
        }
        notifyChanged();
    },

    stop() {
        listeners.clear();
    }
});
