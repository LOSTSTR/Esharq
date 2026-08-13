/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { GuildStore, PermissionStore, React, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    warning: {
        type: OptionType.COMPONENT,
        component: AboutWarning
    },
    fakeOwner: {
        type: OptionType.BOOLEAN,
        default: false,
        description: t(
            "تزييف مِلكية كل السيرفرات (تصبح مالكها في نظر العميل) — يفتح خيارات المالك لكنّه الأكثر إثارة للشبهة. مُطفأ افتراضياً.",
            "Also fake ownership of every server (the client sees you as owner) — unlocks owner-only options but is the most suspicious part. Off by default."
        )
    }
});

// ── reversible prototype override ────────────────────────────────────────────
// The raw script mutated PermissionStore's prototype irreversibly; we save every
// original method first so stop() restores Discord exactly as it was.
const savedProto = new Map<string, any>();
const savedOwners = new Map<string, string>();
let guildListener: (() => void) | null = null;

function overrideProto(obj: any, field: string, value: any) {
    const proto = Object.getPrototypeOf(obj);
    if (!savedProto.has(field)) savedProto.set(field, proto[field]);
    proto[field] = value;
}

function restoreProto(obj: any) {
    const proto = Object.getPrototypeOf(obj);
    for (const [field, orig] of savedProto) proto[field] = orig;
    savedProto.clear();
}

function applyFakeOwner() {
    const me = UserStore.getCurrentUser()?.id;
    if (!me) return;
    for (const g of (GuildStore as any).getGuildsArray()) {
        if (!savedOwners.has(g.id)) savedOwners.set(g.id, g.ownerId);
        g.ownerId = me;
    }
}

function restoreOwners() {
    for (const g of (GuildStore as any).getGuildsArray()) {
        if (savedOwners.has(g.id)) g.ownerId = savedOwners.get(g.id);
    }
    savedOwners.clear();
}

function spoofPermissions() {
    const P = PermissionStore as any;

    // build an all-true props object from a real props shape
    let permProps: Record<string, any> = {};
    try {
        permProps = Object.fromEntries(
            Object.keys(P.getGuildPermissionProps({ id: "0" })).map(k => [k, true])
        );
    } catch { /* آمن — نتخطّى قالب الخصائص إن فشل */ }

    // every permission bitmask → all bits set
    for (const f of ["getGuildPermissions", "getChannelPermissions", "computePermissions", "computeBasicPermissions"])
        overrideProto(P, f, () => ~0n);

    if (Object.keys(permProps).length)
        overrideProto(P, "getGuildPermissionProps", (guild: any) => ({ ...permProps, guild }));

    // every boolean check → true
    for (const f of ["can", "canAccessGuildSettings", "canAccessMemberSafetyPage", "canBasicChannel", "canImpersonateRole", "canManageUser", "canWithPartialContext", "isRoleHigher"])
        overrideProto(P, f, () => true);

    P.emitChange();
}

function AboutWarning() {
    return (
        <div style={{
            border: "1px solid #ed4245", borderRadius: 8, padding: "12px 14px", marginBottom: 12,
            background: "rgba(237, 66, 69, 0.1)", color: "var(--text-normal, #dbdee1)", fontSize: 13, lineHeight: 1.6
        }}>
            ⚠️ {t(
                "تحذير: هذه صلاحيات وهميّة في العميل فقط — لا تمنحك أي سلطة حقيقية. الخادم يفرض صلاحياتك الفعلية، فأيّ إجراء (طرد/حظر/تعديل) تضغطه سيُرفَض (403). قد تُفتَح أزرار وقوائم لا تعمل، وقد تظهر أخطاء واجهة لأنّ ديسكورد يستدعي فحوص الصلاحيات في كل مكان. تتداخل مع FakePerm/ShowHiddenThings (تعيد كتابة الفحوص نفسها). استخدمها على مسؤوليتك.",
                "Warning: these are client-side fake permissions only — they grant NO real power. The server enforces your actual permissions, so any action you click (kick/ban/edit) will be rejected (403). Buttons and menus that don't work may appear, and UI glitches are possible because Discord calls permission checks everywhere. Overlaps with FakePerm/ShowHiddenThings (they rewrite the same checks). Use at your own risk."
            )}
        </div>
    );
}

export default definePlugin({
    name: "FakeAdmin",
    description: "Client-side only: makes Discord's UI think you have every permission (and optionally that you own every server), unlocking hidden channels and admin/owner menus. No real power — the server still enforces your actual permissions.",
    authors: [{ name: "NKrN2", id: 349020193701363712n }],
    settings,

    start() {
        spoofPermissions();

        if (settings.store.fakeOwner) {
            guildListener = () => applyFakeOwner();
            (GuildStore as any).addChangeListener(guildListener);
            applyFakeOwner();
            (GuildStore as any).emitChange();
        }
    },

    stop() {
        // restore everything we touched, exactly
        restoreProto(PermissionStore);
        (PermissionStore as any).emitChange();

        if (guildListener) {
            (GuildStore as any).removeChangeListener(guildListener);
            guildListener = null;
        }
        restoreOwners();
        (GuildStore as any).emitChange();
    }
});
