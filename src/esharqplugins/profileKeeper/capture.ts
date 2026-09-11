/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { OverridePremiumTypeStore, UserProfileStore, UserStore } from "@webpack/common";

import { LookSnapshot } from "./types";

/**
 * قراءةُ شكلك الحاليّ من متاجر ديسكورد.
 *
 * 🔴 **`premiumTypeActual` لا `premiumType`.** الثانية يكتبها `NoNitroUpsell`
 * و`FakeNitro` محلّياً، فمن قرأها ظنّ الاشتراك قائماً وهو منتهٍ — فلا يلتقط
 * شيئاً ولا يستعيد شيئاً. والأولى هي ما يقرأه FakeNitro نفسه للحكم الحقيقيّ
 * (`src/plugins/fakeNitro/index.tsx:433`).
 */
export function realTier(): number {
    try {
        return OverridePremiumTypeStore.getState().premiumTypeActual ?? 0;
    } catch {
        return 0;
    }
}

/** هل الاشتراك قائمٌ فعلاً في هذه اللحظة؟ */
export const hasRealNitro = (): boolean => realTier() > 0;

/**
 * تلتقط ما هو معروضٌ الآن، أو تُرجع `null` إن لم يكن ثمّة ما يُلتقط.
 *
 * ⚠️ تُقرأ الحقول من مصدرين لأنّ ديسكورد يوزّعها كذلك: الخلفية والألوان
 * والمؤثّر على **الملفّ**، والإطار واللوحة على **سجلّ المستخدم**. وقد تكون
 * صفحة الملفّ غير مجلوبةٍ بعد، فيرجع نصفُ اللقطة — ولذلك يُدمج مع المحفوظ
 * بدل أن يستبدله.
 */
export function captureNow(): Partial<LookSnapshot> | null {
    const me = UserStore.getCurrentUser();
    if (!me) return null;

    const profile = UserProfileStore.getUserProfile(me.id) as Record<string, any> | undefined;
    const user = me as unknown as Record<string, any>;

    const decoration = user.avatarDecorationData;
    const plate = user.collectibles?.nameplate;

    const out: Partial<LookSnapshot> = { at: Date.now(), tier: realTier() };

    // كلّ حقلٍ يُكتب **فقط إن كانت له قيمة**: الغياب يعني «لم يُقرأ بعد» لا
    // «أُزيل»، والفرق بينهما هو الفرق بين لقطةٍ صحيحة ولقطةٍ تمحو نفسها.
    if (profile) {
        if (profile.banner) out.banner = profile.banner;
        if (typeof profile.accentColor === "number") out.accentColor = profile.accentColor;
        if (Array.isArray(profile.themeColors) && profile.themeColors.length === 2)
            out.themeColors = [profile.themeColors[0], profile.themeColors[1]];
        if (profile.profileEffect) out.profileEffect = profile.profileEffect;
        if (profile.profileEffectId) out.profileEffectId = profile.profileEffectId;
        if (Array.isArray(profile.collectibles) && profile.collectibles.length > 0)
            out.collectibles = profile.collectibles;
    }

    if (user.avatar) out.avatar = user.avatar;
    if (decoration?.asset && decoration?.skuId)
        out.avatarDecoration = { asset: decoration.asset, skuId: decoration.skuId };
    if (plate?.asset && plate?.skuId) {
        out.nameplate = {
            asset: plate.asset,
            skuId: plate.skuId,
            label: plate.label,
            palette: typeof plate.palette === "string" ? plate.palette : undefined,
            type: plate.type ?? 2
        };
    }

    // لا شيء غير الطابع الزمنيّ ⇒ لا لقطة.
    return Object.keys(out).length > 2 ? out : null;
}
