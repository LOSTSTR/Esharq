/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * **تنصيف الانهيار** — بحثٌ ثنائيّ عبر إعادات التشغيل عن الإضافة المُعطِّلة.
 *
 * ## 🔴 القاعدة التي بُني عليها: لا تُلمَس الإعدادات المحفوظة
 *
 * الطريق السهل أن نُعطّل نصف الإضافات في `Settings` ثم نُعيد ما نجح. وهو
 * طريقٌ يفقد المستخدم اختياراته إن انهار العميل في المنتصف، أو أغلق التطبيق،
 * أو نسي أنه بدأ تنصيفاً. ومن يبحث عن سبب انهيار **يحتمل الانهيار بتعريف
 * المشكلة** — فالحلّ الذي يفترض عدمه حلٌّ خاطئ.
 *
 * ⇒ الجلسة تسكن **ملفّاً مستقلّاً** (`bisect.json`) خارج الإعدادات، وتُقرأ
 * متزامنةً قبل بدء الإضافات فتُطبَّق **طبقةَ إخفاءٍ فوقها**. وإعدادات المستخدم
 * تبقى كما تركها حرفاً بحرف: انتهى التنصيف أم انقطع، عاد كل شيء بحذف ملفّ.
 */

import { DATA_DIR } from "@main/utils/constants";
import { IpcEvents } from "@shared/IpcEvents";
import { ipcMain } from "electron";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

const FILE = join(DATA_DIR, "bisect.json");

export interface BisectSession {
    /** المرشّحون الباقون: الإضافة المُعطِّلة بينهم قطعاً. */
    candidates: string[];
    /** ما يُعطَّل في هذه الجولة — نصف المرشّحين. */
    disabled: string[];
    /** رقم الجولة، للعرض. */
    round: number;
    /** كم إضافة بدأ بها البحث — لحساب التقدّم. */
    startedWith: number;
    startedAt: string;
}

function read(): BisectSession | null {
    try {
        if (!existsSync(FILE)) return null;
        const parsed = JSON.parse(readFileSync(FILE, "utf8"));
        if (!Array.isArray(parsed?.candidates) || !Array.isArray(parsed?.disabled)) return null;
        return parsed as BisectSession;
    } catch {
        return null;
    }
}

function write(session: BisectSession) {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(session, null, 4), "utf8");
}

/** النصف الأوّل يُعطَّل. القسمة ثابتة فالجولة تُعاد بنفس النتيجة. */
function halve(candidates: string[]): string[] {
    return candidates.slice(0, Math.ceil(candidates.length / 2));
}

export function start(candidates: string[]): BisectSession {
    const clean = [...new Set(candidates)].sort();
    const session: BisectSession = {
        candidates: clean,
        disabled: halve(clean),
        round: 1,
        startedWith: clean.length,
        startedAt: new Date().toISOString()
    };
    write(session);
    return session;
}

/**
 * جواب المستخدم عن الجولة.
 *
 * `stillHappens` يعني أن العطب بقي رغم تعطيل النصف ⇒ **الجاني في النصف الذي
 * بقي يعمل**. و`gone` يعني أنه اختفى ⇒ الجاني في النصف المُعطَّل.
 *
 * 🔴 والمنطق معكوسٌ عمّا يظنّه الحدس أوّل مرّة، فكُتب صريحاً بدل اختصاره.
 */
export function answer(stillHappens: boolean): BisectSession | { done: true; culprit: string | null; } {
    const session = read();
    if (session === null) return { done: true, culprit: null };

    const next = stillHappens
        ? session.candidates.filter(p => !session.disabled.includes(p))
        : session.disabled;

    if (next.length <= 1) {
        rmSync(FILE, { force: true });
        return { done: true, culprit: next[0] ?? null };
    }

    const updated: BisectSession = {
        ...session,
        candidates: next,
        disabled: halve(next),
        round: session.round + 1
    };
    write(updated);
    return updated;
}

export function cancel() {
    rmSync(FILE, { force: true });
}

export function current(): BisectSession | null {
    return read();
}

export function registerCrashBisectIpc() {
    ipcMain.handle(IpcEvents.BISECT_START, (_e, candidates: string[]) => start(candidates));
    ipcMain.handle(IpcEvents.BISECT_ANSWER, (_e, stillHappens: boolean) => answer(stillHappens));
    ipcMain.handle(IpcEvents.BISECT_CANCEL, () => { cancel(); });

    // 🔴 متزامن: يُقرأ في تمهيد المُصيِّر قبل أن يبدأ أي إضافة، وإلّا بدأت
    // الإضافة المُعطَّلة ثم أُوقفت — وقد يكون بدؤها هو ما يُسقط العميل.
    ipcMain.on(IpcEvents.BISECT_GET, e => {
        try {
            e.returnValue = read();
        } catch {
            e.returnValue = null;
        }
    });
}
