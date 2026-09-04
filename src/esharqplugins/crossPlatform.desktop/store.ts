/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Logger } from "@utils/Logger";

import { PlatformId } from "./types";

const logger = new Logger("CrossPlatform");

const CREDS_KEY = "CrossPlatform_creds";
const LINKS_KEY = "CrossPlatform_links";

/**
 * مفاتيح المستخدم. تبقى في IndexedDB المحليّ ولا تغادر الجهاز إلا إلى المنصّة
 * صاحبة المفتاح نفسها.
 *
 * 🔴 لا تُسجَّل هذه القيم في أيّ سجلّ ولا تُدرَج في أيّ تقرير خطأ.
 */
export interface Credentials {
    /** من steamcommunity.com/dev/apikey */
    steamKey: string;
    /** SteamID64 الخاصّ بالمستخدم — منه تُجلب قائمة أصدقائه. */
    steamId: string;
    /** من developer.hypixel.net */
    hypixelKey: string;
    twitchClientId: string;
    /** توكن OAuth بنطاق user:read:follows */
    twitchToken: string;
    /** معرّف حساب تويتش الخاصّ بالمستخدم. */
    twitchUserId: string;
}

const EMPTY_CREDS: Credentials = {
    steamKey: "",
    steamId: "",
    hypixelKey: "",
    twitchClientId: "",
    twitchToken: "",
    twitchUserId: ""
};

/** معرّف ديسكورد ← حساباته على المنصّات. الربط يدويّ بالكامل. */
export type Links = Record<string, Partial<Record<PlatformId, string>>>;

let creds: Credentials = { ...EMPTY_CREDS };
let links: Links = {};

const listeners = new Set<() => void>();

/** يشترك في أيّ تغيّر على المفاتيح أو الروابط؛ يُرجع دالّة إلغاء. */
export function onStoreChange(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

const notify = () => listeners.forEach(fn => fn());

export const getCredentials = (): Credentials => creds;

export function setCredential(key: keyof Credentials, value: string): void {
    creds = { ...creds, [key]: value.trim() };
    notify();
    DataStore.set(CREDS_KEY, creds).catch(e => logger.error("تعذّر حفظ المفاتيح", e));
}

export const getLinks = (): Links => links;

/** يربط حساباً على منصّة بمستخدم ديسكورد، أو يفكّ الربط بقيمة فارغة. */
export function setLink(discordId: string, platform: PlatformId, accountId: string): void {
    const trimmed = accountId.trim();
    const entry = { ...links[discordId] };
    if (trimmed) entry[platform] = trimmed;
    else delete entry[platform];

    links = { ...links };
    if (Object.keys(entry).length > 0) links[discordId] = entry;
    else delete links[discordId];

    notify();
    DataStore.set(LINKS_KEY, links).catch(e => logger.error("تعذّر حفظ الروابط", e));
}

/** كلّ الحسابات المربوطة بمنصّة، بترتيب ثابت: معرّف المنصّة ← معرّف ديسكورد. */
export function accountsFor(platform: PlatformId): Map<string, string> {
    const out = new Map<string, string>();
    for (const discordId of Object.keys(links)) {
        const accountId = links[discordId][platform];
        if (accountId) out.set(accountId, discordId);
    }
    return out;
}

export async function loadStore(): Promise<void> {
    const [savedCreds, savedLinks] = await Promise.all([
        DataStore.get(CREDS_KEY),
        DataStore.get(LINKS_KEY)
    ]);
    if (savedCreds && typeof savedCreds === "object") creds = { ...EMPTY_CREDS, ...savedCreds };
    if (savedLinks && typeof savedLinks === "object") links = savedLinks as Links;
    notify();
}
