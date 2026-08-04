/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { GuildMemberStore, GuildStore, RestAPI, showToast, Toasts, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    showToast: {
        type: OptionType.BOOLEAN,
        description: t("عرض إشعار عند إزالة لقب مفروض", "Show a notification when a forced nickname is removed"),
        default: true,
    }
});

// Guard against re-entrancy: our own PATCH triggers GUILD_MEMBER_UPDATE again.
const resettingGuilds = new Set<string>();

// آخر لقب معروف لكل سيرفر. GUILD_MEMBER_UPDATE يُطلَق أيضاً عند تغيّر وسم السيرفر أو
// الرتب أو زينة الأفتار، وفي كل تلك الحالات يصل اللقب *الحالي* كما هو — فكانت الإضافة
// تظنّه لقباً مفروضاً جديداً وتُطلق PATCH بلا داعٍ. نقارن بالسابق فلا نتحرّك إلا عند تغيّر فعلي.
const knownNicks = new Map<string, string | null>();

async function resetNick(guildId: string, forcedNick: string) {
    if (resettingGuilds.has(guildId)) return;
    resettingGuilds.add(guildId);

    try {
        // Preferred: the "Edit Server Profile" endpoint (resets your OWN nick, no perms needed).
        try {
            await RestAPI.patch({ url: `/users/@me/guilds/${guildId}/profile`, body: { nick: null } });
            if (settings.store.showToast) showToast(t(`أُزيل اللقب المفروض «${forcedNick}»`, `Removed forced nickname "${forcedNick}"`), Toasts.Type.SUCCESS);
            return;
        } catch { /* fall through to the member endpoint */ }

        await RestAPI.patch({ url: `/guilds/${guildId}/members/@me`, body: { nick: "" } });
        if (settings.store.showToast) showToast(t(`أُزيل اللقب المفروض «${forcedNick}»`, `Removed forced nickname "${forcedNick}"`), Toasts.Type.SUCCESS);
    } catch (err: any) {
        console.warn(`[AntiNickname] Failed to reset nickname on ${guildId}:`, err);
        if (settings.store.showToast) showToast(t(`تعذّر إزالة اللقب (${err?.status ?? "?"})`, `Failed to reset nickname (${err?.status ?? "?"})`), Toasts.Type.FAILURE);
    } finally {
        setTimeout(() => resettingGuilds.delete(guildId), 2000);
    }
}

export default definePlugin({
    name: "AntiNickname",
    description: "Automatically resets any nickname forcefully assigned to you in a server (your own profile only).",
    authors: [{ name: t("مؤلف غير معروف", "Unknown"), id: 0n }],
    settings,

    flux: {
        GUILD_MEMBER_UPDATE({ guildId, user, nick }: { guildId: string; user: { id: string; }; nick?: string | null; }) {
            const me = UserStore.getCurrentUser();
            if (!me || user.id !== me.id) return;

            const currentNick = nick ?? null;
            const prevNick = knownNicks.get(guildId);
            knownNicks.set(guildId, currentNick);

            if (!currentNick) return;                                   // لا لقب أصلاً
            if (prevNick !== undefined && prevNick === currentNick) return; // لم يتغيّر — حدث آخر

            setTimeout(() => resetNick(guildId, currentNick), 300);
        }
    },

    start() {
        // لقطة أولية للألقاب الحالية، وإلا اعتُبر أوّل حدث في كل سيرفر «تغييراً».
        knownNicks.clear();
        const me = UserStore.getCurrentUser();
        if (!me) return;
        const guilds = GuildStore.getGuilds();
        if (!guilds) return;
        for (const guildId in guilds) {
            knownNicks.set(guildId, GuildMemberStore.getMember(guildId, me.id)?.nick ?? null);
        }
    },

    stop() {
        resettingGuilds.clear();
        knownNicks.clear();
    }
});
