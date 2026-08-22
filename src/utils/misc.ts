/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { User } from "@vencord/discord-types";
import { ChannelStore, GuildMemberStore, IconUtils } from "@webpack/common";

import { EQUICORD_HELPERS, EquicordDevsById, ESHARQ_TIERS, EsharqTeamSeed, type EsharqTier, GUILD_ID, KNOWN_ISSUES_CHANNEL_ID, SUPPORT_CHANNEL_ID, VencordDevsById } from "./constants";

/**
 * Calls .join(" ") on the arguments
 * classes("one", "two") => "one two"
 */
export function classes(...classes: Array<string | null | undefined | false>) {
    return classes.filter(Boolean).join(" ");
}

/**
 * Returns a promise that resolves after the specified amount of time
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

/**
 * Check if obj is a true object: of type "object" and not null or array
 */
export function isObject(obj: unknown): obj is object {
    return typeof obj === "object" && obj !== null && !Array.isArray(obj);
}

/**
 * Check if an object is empty or in other words has no own properties
 */
export function isObjectEmpty(obj: object) {
    for (const k in obj)
        if (Object.hasOwn(obj, k)) return false;

    return true;
}

/**
 * Returns null if value is not a URL, otherwise return URL object.
 * Avoids having to wrap url checks in a try/catch
 */
export function parseUrl(urlString: string): URL | null {
    try {
        return new URL(urlString);
    } catch {
        return null;
    }
}

/**
 * Checks whether an element is on screen
 */
export const checkIntersecting = (el: Element) => {
    const elementBox = el.getBoundingClientRect();
    const documentHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
    return !(elementBox.bottom < 0 || elementBox.top - documentHeight >= 0);
};

export function identity<T>(value: T): T {
    return value;
}

export const isPluginDev = (id: string) => Object.hasOwn(VencordDevsById, id);
export const shouldShowContributorBadge = (id: string) => isPluginDev(id) && VencordDevsById[id].badge !== false;

export const isEquicordPluginDev = (id: string) => Object.hasOwn(EquicordDevsById, id);
export const shouldShowEquicordContributorBadge = (id: string) => isEquicordPluginDev(id) && EquicordDevsById[id].badge !== false;

// رتب إشراق الحيّة — تُبذَر من الثوابت المُصرَّفة (احتياط بلا شبكة، ولا وميض عند
// الإقلاع) ثمّ تُستبدَل وقت التشغيل من Esharq-Bored/team.json عبر BadgeAPI، فتُمنَح
// الرتب وتُسحَب بلا إعادة بناء — نفس فكرة ملفّات الشارات الأخرى.
type TierSets = Record<EsharqTier, Set<string>>;

function seedTiers(): TierSets {
    return Object.fromEntries(
        ESHARQ_TIERS.map(tier => [tier, new Set(EsharqTeamSeed[tier])])
    ) as TierSets;
}

let liveEsharqTiers: TierSets = seedTiers();

// يُستدعى من BadgeAPI بعد جلب team.json. ملفّ مفقود أو تالف أو فارغ تماماً يعود
// بالبذرة المُصرَّفة، فلا يمحو ملفٌّ سيّئ شارات الفريق. أمّا رتبةٌ غائبة من ملفٍّ
// صالح فتعني «لا أحد فيها» فعلاً — وهذه هي طريقة السحب.
export function setEsharqTeam(team: Partial<Record<EsharqTier, unknown>> | null | undefined) {
    if (!team || typeof team !== "object") {
        liveEsharqTiers = seedTiers();
        return;
    }
    const next = Object.fromEntries(ESHARQ_TIERS.map(tier => {
        const raw = (team as Record<string, unknown>)[tier];
        const ids = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
        return [tier, new Set(ids)];
    })) as TierSets;

    // ملفّ لا يحمل أيّ رتبة معروفة = تالف، لا «فريق فارغ».
    const total = ESHARQ_TIERS.reduce((n, tier) => n + next[tier].size, 0);
    liveEsharqTiers = total ? next : seedTiers();
}

export const esharqTierOf = (id: string): EsharqTier | null =>
    ESHARQ_TIERS.find(tier => liveEsharqTiers[tier].has(id)) ?? null;

export const hasEsharqTier = (id: string, tier: EsharqTier) => liveEsharqTiers[tier].has(id);

/** المالك والمدراء — هؤلاء «فريق إشراق». */
export const isEsharqTeam = (id: string) => hasEsharqTier(id, "owner") || hasEsharqTier(id, "admin");

/** شارة «مستخدم إشراق» تلقائية لكلّ من له مدخل عامّ في أي رتبة. */
export const isEsharqUser = (id: string) => esharqTierOf(id) !== null;

export const isAnyPluginDev = (id: string) => Object.hasOwn(VencordDevsById, id) || Object.hasOwn(EquicordDevsById, id);

export function pluralise(amount: number, singular: string, plural = singular + "s") {
    return amount === 1 ? `${amount} ${singular}` : `${amount} ${plural}`;
}

export function interpolateIfDefined(strings: TemplateStringsArray, ...args: any[]) {
    if (args.some(arg => arg == null)) return "";
    return String.raw({ raw: strings }, ...args);
}

export function tryOrElse<T>(func: () => T, fallback: T): T {
    try {
        const res = func();
        return res instanceof Promise
            ? res.catch(() => fallback) as T
            : res;
    } catch {
        return fallback;
    }
}

export function isEquicordGuild(id: string | null | undefined, isGuildId: boolean = false): boolean {
    if (!id) return false;
    if (isGuildId) return id === GUILD_ID;
    const channel = ChannelStore.getChannel(id);
    if (!channel) return false;
    return channel.guild_id === GUILD_ID;
}

export function isSupportChannel(channelId: string | null | undefined): boolean {
    if (!channelId) return false;
    return channelId === SUPPORT_CHANNEL_ID;
}

export function isKnownIssuesCategory(channelId: string | null | undefined): boolean {
    if (!channelId) return false;
    return channelId === KNOWN_ISSUES_CHANNEL_ID;
}

export function isEquicordSupport(userId: string | null | undefined): boolean {
    if (!userId) return false;

    const member = GuildMemberStore.getMember(GUILD_ID, userId);
    if (!member) return false;
    return member.roles.includes(EQUICORD_HELPERS) || false;
}

export function removeFromArray<T>(arr: T[], predicate: (e: T) => boolean) {
    const idx = arr.findIndex(predicate);
    if (idx !== -1) arr.splice(idx, 1);
}

export function getUserAvatarUrl(user: User, guildId?: string, canAnimate?: boolean, size?: number): string {
    const memberAvatar = guildId ? GuildMemberStore.getMember(guildId, user.id)?.avatar || null : null;
    if (memberAvatar) {
        return IconUtils.getGuildMemberAvatarURLSimple({
            guildId: guildId!,
            userId: user.id,
            avatar: memberAvatar,
            canAnimate,
            size
        });
    }

    return IconUtils.getUserAvatarURL(user, canAnimate, size) ?? IconUtils.getDefaultAvatarURL(user.id, user?.discriminator);
}
