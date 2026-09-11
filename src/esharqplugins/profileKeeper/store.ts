/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { Logger } from "@utils/Logger";

import { LookSnapshot } from "./types";

const logger = new Logger("ProfileKeeper");

/**
 * 🔴 المفتاح يحمل **معرّف الحساب**.
 *
 * من يبدّل الحسابات كان سيرى شكل حسابٍ آخر على ملفّه، ولا شيء في الواجهة
 * يقول لماذا. ولقطةُ كلّ حساب مستقلّةٌ عن الأخرى، وحذف الإضافة يحذفهنّ معاً.
 */
const keyFor = (userId: string) => `ProfileKeeper_look_${userId}`;

const EMPTY: LookSnapshot = {
    at: 0,
    tier: 0,
    banner: null,
    accentColor: null,
    themeColors: null,
    profileEffect: null,
    profileEffectId: null,
    collectibles: null,
    avatar: null,
    avatarDecoration: null,
    nameplate: null
};

let current: LookSnapshot | null = null;
let ownerId = "";

const listeners = new Set<() => void>();

/** يشترك في تغيّر اللقطة؛ يُرجع دالّة إلغاء. */
export function onSnapshotChange(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

const notify = () => listeners.forEach(fn => fn());

export const getSnapshot = (): LookSnapshot | null => current;

/** هل في اللقطة شيءٌ يُستعاد أصلاً؟ */
export function hasAnything(snap: LookSnapshot | null): boolean {
    if (!snap) return false;
    return Boolean(
        snap.banner || snap.accentColor !== null || snap.themeColors
        || snap.profileEffect || snap.avatarDecoration || snap.nameplate
    );
}

export async function loadFor(userId: string): Promise<void> {
    ownerId = userId;
    try {
        current = (await DataStore.get<LookSnapshot>(keyFor(userId))) ?? null;
    } catch (e) {
        logger.error("تعذّرت قراءة اللقطة", e);
        current = null;
    }
    notify();
}

/**
 * يدمج ما التُقط مع المحفوظ.
 *
 * 🔴 **دمجٌ لا استبدال.** الملفّ قد لا يكون مجلوباً بعد فتأتي اللقطة ناقصة،
 * والاستبدال كان يمحو ما التُقط أمس بنصفِ ما يُقرأ اليوم. والحقل لا يُكتب
 * إلّا إذا جاء بقيمة.
 */
export async function mergeSave(patch: Partial<LookSnapshot>): Promise<void> {
    const base = current ?? { ...EMPTY };
    const next: LookSnapshot = { ...base, ...patch };
    current = next;
    notify();
    try {
        await DataStore.set(keyFor(ownerId), next);
    } catch (e) {
        logger.error("تعذّر حفظ اللقطة", e);
    }
}

/** يمحو اللقطة كاملةً — زرٌّ صريح في اللوحة، لا يقع تلقائياً أبداً. */
export async function clearSnapshot(): Promise<void> {
    current = null;
    notify();
    try {
        await DataStore.del(keyFor(ownerId));
    } catch (e) {
        logger.error("تعذّر حذف اللقطة", e);
    }
}
