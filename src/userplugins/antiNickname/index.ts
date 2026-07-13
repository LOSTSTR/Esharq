/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { RestAPI, showToast, Toasts, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    showToast: {
        type: OptionType.BOOLEAN,
        description: t("عرض إشعار عند إزالة لقب مفروض", "Show a notification when a forced nickname is removed"),
        default: true,
    }
});

// Guard against re-entrancy: our own PATCH triggers GUILD_MEMBER_UPDATE again.
const resettingGuilds = new Set<string>();

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
    authors: [EquicordDevs.LOSTSTR],
    settings,

    flux: {
        GUILD_MEMBER_UPDATE({ guildId, user, nick }: { guildId: string; user: { id: string; }; nick: string | null; }) {
            const me = UserStore.getCurrentUser();
            if (!me || user.id !== me.id || !nick) return;
            setTimeout(() => resetNick(guildId, nick), 300);
        }
    },

    stop() {
        resettingGuilds.clear();
    }
});
