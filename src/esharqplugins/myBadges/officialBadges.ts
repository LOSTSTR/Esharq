/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * كتالوج شارات ديسكورد الرسمية — اختيارٌ محلّيّ بحت.
 *
 * ── لماذا صورٌ لا أعلام ───────────────────────────────────────────────
 * الطريق «الطبيعيّ» لإظهار شارة نيترو أو بوست هو تعديل `publicFlags` أو
 * `premiumSince` على كائن المستخدم. **لا نفعل ذلك**: ديسكورد يحسب بهذه
 * الحقول الصلاحيات وترتيب الخوادم، وتعديلها يُعيد ترتيب الخوادم ويُخفي
 * قنوات. فنكتفي بحقن **صورة الشارة** عبر `BadgeAPI` — عرضٌ خالص لا يمسّ
 * حالة الحساب ولا يُرسل شيئاً إلى ديسكورد.
 *
 * ── الأيقونات ────────────────────────────────────────────────────────
 * روابط CDN الرسمية لديسكورد، **تحقّقتُ من كلّ رابطٍ منها (33/33) بأنّه
 * يُرجع 200** قبل إدراجه هنا. ولا يُحمَّل أيٌّ منها إلا إن اخترتَ شارته.
 */

import { DataStore } from "@api/index";
import { Logger } from "@utils/Logger";

const logger = new Logger("MyBadges:Official");
const STORE_KEY = "MyBadges_official";
const CDN = "https://cdn.discordapp.com/badge-icons";

export type OfficialGroup = "nitro" | "boost" | "flags" | "special";

export interface OfficialBadge {
    /** مُعرّف ثابت — هو ما يُحفظ، فلا تُغيّره بعد الإطلاق. */
    id: string;
    group: OfficialGroup;
    ar: string;
    en: string;
    icon: string;
}

const b = (id: string, group: OfficialGroup, ar: string, en: string, hash: string): OfficialBadge =>
    ({ id, group, ar, en, icon: `${CDN}/${hash}.png` });

export const OFFICIAL_BADGES: readonly OfficialBadge[] = [
    // ── Nitro: تسعة مستويات بحسب مدّة الاشتراك ──
    b("nitro", "nitro", "Nitro", "Nitro", "2ba85e8026a8614b640c2837bcdfe21b"),
    b("nitro-bronze", "nitro", "Nitro — برونزي (شهر)", "Nitro — Bronze (1 month)", "4f33c4a9c64ce221936bd256c356f91f"),
    b("nitro-silver", "nitro", "Nitro — فضّي (شهران)", "Nitro — Silver (2 months)", "4514fab914bdbfb4ad2fa23df76121a6"),
    b("nitro-gold", "nitro", "Nitro — ذهبيّ (٣ أشهر)", "Nitro — Gold (3 months)", "2895086c18d5531d499862e41d1155a6"),
    b("nitro-platinum", "nitro", "Nitro — بلاتينيّ (٦ أشهر)", "Nitro — Platinum (6 months)", "0334688279c8359120922938dcb1d6f8"),
    b("nitro-diamond", "nitro", "Nitro — ماسيّ (سنة)", "Nitro — Diamond (12 months)", "0d61871f72bb9a33a7ae568c1fb4f20a"),
    b("nitro-emerald", "nitro", "Nitro — زمرّديّ (سنتان)", "Nitro — Emerald (24 months)", "11e2d339068b55d3a506cff34d3780f3"),
    b("nitro-ruby", "nitro", "Nitro — ياقوتيّ (٣ سنوات)", "Nitro — Ruby (36 months)", "cd5e2cfd9d7f27a8cdcd3e8a8d5dc9f4"),
    b("nitro-opal", "nitro", "Nitro — أوبال (٦ سنوات)", "Nitro — Opal (72 months)", "5b154df19c53dce2af92c9b61e6be5e2"),

    // ── تعزيز الخادم: تسع مراتب ──
    b("boost-1", "boost", "تعزيز — شهر", "Boost — 1 month", "51040c70d4f20a921ad6674ff86fc95c"),
    b("boost-2", "boost", "تعزيز — شهران", "Boost — 2 months", "0e4080d1d333bc7ad29ef6528b6f2fb7"),
    b("boost-3", "boost", "تعزيز — ٣ أشهر", "Boost — 3 months", "72bed924410c304dbe3d00a6e593ff59"),
    b("boost-6", "boost", "تعزيز — ٦ أشهر", "Boost — 6 months", "df199d2050d3ed4ebf84d64ae83989f8"),
    b("boost-9", "boost", "تعزيز — ٩ أشهر", "Boost — 9 months", "996b3e870e8a22ce519b3a50e6bdd52f"),
    b("boost-12", "boost", "تعزيز — سنة", "Boost — 12 months", "991c9f39ee33d7537d9f408c3e53141e"),
    b("boost-15", "boost", "تعزيز — ١٥ شهراً", "Boost — 15 months", "cb3ae83c15e970e8f3d410bc62cb8b99"),
    b("boost-18", "boost", "تعزيز — ١٨ شهراً", "Boost — 18 months", "7142225d31238f6387d9f09efaa02759"),
    b("boost-24", "boost", "تعزيز — سنتان", "Boost — 24 months", "ec92202290b48d0879b7413d2dde3bab"),

    // ── شارات الأعلام الرسمية ──
    b("staff", "flags", "طاقم Discord", "Discord Staff", "5e74e9b61934fc1f67c65515d1f7e60d"),
    b("partner", "flags", "شريك Discord", "Discord Partner", "3f9748e53446a137a052f3454e2de41e"),
    b("hypesquad", "flags", "HypeSquad — الفعاليات", "HypeSquad Events", "bf01d1073931f921909045f3a39fd264"),
    b("bravery", "flags", "HypeSquad — الشجاعة", "HypeSquad Bravery", "8a88d63823d8a71cd5e390baa45efa02"),
    b("brilliance", "flags", "HypeSquad — التألّق", "HypeSquad Brilliance", "011940fd013da3f7fb926e4a1cd2e618"),
    b("balance", "flags", "HypeSquad — التوازن", "HypeSquad Balance", "3aa41de486fa12454c3761e8e223442e"),
    b("bughunter-1", "flags", "صائد العلل — المستوى الأول", "Bug Hunter — Level 1", "2717692c7dca7289b35297368a940dd0"),
    b("bughunter-2", "flags", "صائد العلل — المستوى الثاني", "Bug Hunter — Level 2", "848f79194d4be5ff5f81505cbd0ce1e6"),
    b("early-supporter", "flags", "داعم مبكّر", "Early Supporter", "7060786766c9c840eb3019e725d2b358"),
    b("mod-alumni", "flags", "مشرف سابق", "Moderator Alumni", "fee1624003e2fee35cb398e125dc479b"),
    b("dev-verified", "flags", "مطوّر بوتات موثّق", "Verified Bot Developer", "6df5892e0f35b051f8b61eace34f4967"),
    b("dev-active", "flags", "مطوّر نشط", "Active Developer", "6bdc42827a38498929a4920da12695d9"),
    b("old-username", "flags", "الاسم القديم", "Originally known as", "6de6d34650760ba5551a79732e98ed60"),

    // ── شارات خاصّة ──
    b("quest", "special", "أتمّ مهمّة", "Completed a Quest", "7d9ae358c8c5e118768335dbe68b4fb8"),
    b("orbs", "special", "Orbs — مبتدئ", "Orbs — Apprentice", "83d8a1eb09a8d64e59233eec5d4d5c2d")
];

export const OFFICIAL_GROUPS: readonly { key: OfficialGroup; ar: string; en: string; }[] = [
    { key: "nitro", ar: "Nitro", en: "Nitro" },
    { key: "boost", ar: "التعزيز", en: "Boost" },
    { key: "flags", ar: "الأعلام", en: "Flags" },
    { key: "special", ar: "خاصّة", en: "Special" }
];

/** المُختار حالياً — مُعرّفات فقط، فحذف شارةٍ من الكتالوج لا يُفسد المحفوظ. */
let selected: string[] = [];
const listeners = new Set<() => void>();

function notify() {
    for (const fn of listeners) {
        try { fn(); } catch { /* مستمعٌ معطوب لا يُسقط البقيّة */ }
    }
}

/** يشترك في تغيّر الاختيار؛ يُعيد دالّة إلغاء الاشتراك. */
export function onOfficialChange(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export const isOfficialOn = (id: string): boolean => selected.includes(id);

/** الشارات المختارة **بترتيب الكتالوج** لا بترتيب النقر — فالعرض ثابت. */
export const selectedOfficialBadges = (): OfficialBadge[] =>
    OFFICIAL_BADGES.filter(badge => selected.includes(badge.id));

export function toggleOfficial(id: string): void {
    selected = selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id];
    notify();
    DataStore.set(STORE_KEY, selected).catch(e => logger.error("failed to save selection", e));
}

export function clearOfficial(): void {
    selected = [];
    notify();
    DataStore.set(STORE_KEY, selected).catch(e => logger.error("failed to clear selection", e));
}

/** يُقرأ مرّةً عند إقلاع الإضافة. الفشل يترك الاختيار فارغاً لا يُسقط الإضافة. */
export async function loadOfficialSelection(): Promise<void> {
    try {
        const saved = await DataStore.get(STORE_KEY);
        if (Array.isArray(saved)) selected = saved.filter(x => typeof x === "string");
    } catch (e) {
        logger.error("failed to load selection", e);
    }
    notify();
}
