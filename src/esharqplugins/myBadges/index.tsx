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

import { applyIdentity, isFakeProfileOn, loadIdentity, restoreIdentity } from "./localIdentity";
import { loadOfficialSelection, selectedOfficialBadges } from "./officialBadges";

const cl = classNameFactory("vc-mybadges-");
const logger = new Logger("MyBadges");
const STORE_KEY = "MyBadges_badges";
const SIZE_MIGRATED_KEY = "MyBadges_sizeMigrated";

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

// 🔴 «مطابق» ليس رقماً، وهذا بيت القصيد: تُترك الشارة بلا نمطٍ مضمَّن فترث
// صنف ديسكورد `badge__…` ومقاسَه. قِيس على عميل حيّ في ملفٍّ واحد: شارة
// ديسكورد الأصلية 20×20 وشاراتُنا 22×22، والصنف واحدٌ في الاثنتين — فحذفُ
// النمط وحده يُطابقها. والرقم المثبَّت يشيخ متى غيّر ديسكورد مقاسه، والوراثة
// لا تشيخ.
const MATCH_DISCORD = "match";

/** مقاس شارة ديسكورد كما قِيس على عميل حيّ. للمعاينة وحدها، لا للحقن. */
const DISCORD_BADGE_PX = 20;

const SIZES = [
    { value: MATCH_DISCORD, label: t("مطابق لديسكورد", "Match Discord") },
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
    // المعاينة ترسم بالمقاس الفعليّ، و«مطابق» يعني مقاس ديسكورد المقيس.
    const size = Number(settings.store.badgeSize) || DISCORD_BADGE_PX;

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
        description: "How big your badges are drawn. Match Discord keeps them exactly the size Discord draws its own, which is what you want unless you deliberately want to stand out.",
        options: SIZES.map(s => ({
            label: s.label,
            value: s.value,
            default: s.value === MATCH_DISCORD
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
    description: "Customise how your own profile looks to you: pick Discord's official badges or add your own, and set a local display name, username and account creation date. Everything is stored on your device and drawn only by your client — nothing is sent to Discord and nobody else sees it.",
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
        shouldShow: ({ userId }) => userId === UserStore.getCurrentUser()?.id
            && (badges.length > 0 || (isFakeProfileOn() && selectedOfficialBadges().length > 0)),
        // Read live, because _getBadges takes the position from THIS entry rather
        // than from the ones getBadges returns.
        get position() {
            return settings.store.atStart ? BadgePosition.START : BadgePosition.END;
        },
        getBadges: () => {
            const raw = String(settings.store.badgeSize);
            const size = Number(raw);
            // بلا نمطٍ أصلاً ⇒ يرث مقاس ديسكورد. وأيّ رقم يفرض مقاسه بدله.
            const props = raw === MATCH_DISCORD
                ? { className: cl("badge") }
                : { className: cl("badge"), style: { width: size, height: size, objectFit: "contain" } as const };

            // الرسمية أوّلاً لتجاور شارات ديسكورد نفسها، ثمّ المخصّصة.
            // المفتاح الرئيسيّ مُطفأ ⇒ لا شارات رسمية، وتبقى المخصّصة كما هي.
            const official = (isFakeProfileOn() ? selectedOfficialBadges() : []).map((badge): ProfileBadge => ({
                id: `vc-mybadges-official-${badge.id}`,
                key: badge.id,
                description: t(badge.ar, badge.en),
                iconSrc: badge.icon,
                props
            }));

            return [...official, ...badges.map((badge): ProfileBadge => ({
                id: `vc-mybadges-${badge.id}`,
                key: badge.name,
                description: badge.name,
                iconSrc: badge.src,
                props
            }))];
        }
    }],

    async start() {
        // ترحيلٌ لمرّة واحدة: «22» كانت الافتراضيّ القديم، وقامت على ادّعاءٍ
        // خاطئ بأنّ شارات ديسكورد 22px — والقياس الحيّ يقول 20. فمن بقي على
        // القيمة القديمة يُنقل إلى الوراثة، ومن اختار مقاساً آخر لا يُمسّ.
        try {
            if (!await DataStore.get(SIZE_MIGRATED_KEY)) {
                if (String(settings.store.badgeSize) === "22") settings.store.badgeSize = MATCH_DISCORD;
                await DataStore.set(SIZE_MIGRATED_KEY, true);
            }
        } catch (e) {
            logger.error("failed to migrate badge size", e);
        }

        try {
            const saved = await DataStore.get(STORE_KEY);
            if (Array.isArray(saved)) {
                badges = saved.filter(b => typeof b?.src === "string" && typeof b?.id === "string");
            }
        } catch (e) {
            logger.error("failed to load saved badges", e);
        }
        await loadOfficialSelection();
        await loadIdentity();
        applyIdentity();
        notifyChanged();
    },

    stop() {
        // الرجوع بالهويّة إلى حقيقتها قبل الخروج — وإلّا بقي الاسم المزيّف.
        restoreIdentity();
        listeners.clear();
    }
});
