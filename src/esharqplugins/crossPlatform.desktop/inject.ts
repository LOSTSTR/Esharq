/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { Activity } from "@vencord/discord-types";
import { ActivityFlags, ActivityType } from "@vencord/discord-types/enums";
import { PresenceStore } from "@webpack/common";

import { PlatformPresence } from "./types";

/**
 * حقنُ الأنشطة في `PresenceStore.getActivities`.
 *
 * لماذا لا نُرسل `PRESENCE_UPDATE` عبر Flux؟ لأنّ ديسكورد يبني حالة المتجر من
 * علاقاتٍ يعرفها هو، فحقنُ حضورٍ لمستخدمٍ لا يملك جلسةً يُهمَل بصمت. أمّا لفُّ
 * الدالّة فيصيب **كلّ** مكانٍ يقرأ النشاط: قائمة الأعضاء، والملفّ المنبثق،
 * والرسائل المباشرة، بلا استثناء.
 *
 * 🔴 **تساوي المراجع شرطٌ لا زينة.** المكوّنات تقرأ عبر
 * `useStateFromStores` الذي يقارن الناتج بالمرجع. لو أعدنا مصفوفةً جديدة عند
 * كلّ نداء لأعادت رياكت الرسم بلا توقّف. فالناتج المدموج يُخزَّن ويُعاد بعينه
 * ما لم يتغيّر أحدُ طرفيه.
 */

type GetActivities = (userId: string, guildId?: string) => Activity[];

/** معرّف ديسكورد ← الأنشطة المحقونة له. يُستبدل كاملاً عند كل استطلاع. */
let injected = new Map<string, Activity[]>();

interface MergeCache {
    base: Activity[];
    extra: Activity[];
    out: Activity[];
}

const mergeCache = new Map<string, MergeCache>();

let restore: (() => void) | null = null;

export const isInjected = (): boolean => restore !== null;

export function installInjection(): void {
    if (restore) return;

    const previous = Object.getOwnPropertyDescriptor(PresenceStore, "getActivities");
    const original: GetActivities = PresenceStore.getActivities.bind(PresenceStore);

    const wrapped: GetActivities = (userId, guildId) => {
        const base = original(userId, guildId);
        const extra = injected.get(userId);
        if (extra === undefined || extra.length === 0) return base;

        const cached = mergeCache.get(userId);
        if (cached && cached.base === base && cached.extra === extra) return cached.out;

        const out = [...base, ...extra];
        mergeCache.set(userId, { base, extra, out });
        return out;
    };

    PresenceStore.getActivities = wrapped;

    restore = () => {
        // لو كانت الدالّة مملوكةً للمتجر قبلنا نُعيد واصفَها كما كان، وإلا
        // نحذف ما أضفناه فيعود النداء إلى النموذج الأوّليّ.
        if (previous) Object.defineProperty(PresenceStore, "getActivities", previous);
        else Reflect.deleteProperty(PresenceStore, "getActivities");
    };
}

export function removeInjection(): void {
    restore?.();
    restore = null;
    injected = new Map();
    mergeCache.clear();
    PresenceStore.emitChange();
}

/** يبني نشاطاً واحداً من حضورٍ على منصّة. */
function toActivity(presence: PlatformPresence, platformLabel: string, discordId: string): Activity | null {
    if (presence.game === null) return null;

    const streaming = presence.streamUrl !== undefined;
    return {
        id: `esharq-xp-${platformLabel}-${discordId}`,
        name: presence.game,
        type: streaming ? ActivityType.STREAMING : ActivityType.PLAYING,
        state: presence.detail,
        details: streaming ? presence.detail : undefined,
        url: presence.streamUrl,
        flags: ActivityFlags.INSTANCE,
        created_at: Date.now(),
        timestamps: presence.startedAt === undefined ? undefined : { start: presence.startedAt }
    };
}

/**
 * يستبدل كلّ ما هو محقون بما وصل من هذه الجولة.
 *
 * الاستبدال الكامل مقصود: الغياب عن هذه الجولة يعني أنّ الصديق أغلق اللعبة،
 * فلو دمجنا مع السابق لبقي نشاطٌ ميّت معلّقاً إلى الأبد.
 */
export function applyPresences(
    rows: readonly { discordId: string; platformLabel: string; presence: PlatformPresence; }[]
): void {
    const next = new Map<string, Activity[]>();
    for (const row of rows) {
        const activity = toActivity(row.presence, row.platformLabel, row.discordId);
        if (!activity) continue;

        const list = next.get(row.discordId);
        if (list) list.push(activity);
        else next.set(row.discordId, [activity]);
    }

    injected = next;
    mergeCache.clear();
    PresenceStore.emitChange();
}
