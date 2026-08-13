/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * كاشف التغطية — **ما الذي لم يُعرَّب بعد؟**
 *
 * التعريب نفسه لم يعد هنا: صار في نواة إشراق على مستوى البيانات
 * (`@utils/esharqLocale`)، فمحرّك ديسكورد يعرض العربية بنفسه. وما بقي لهذه
 * الإضافة عمل واحد: **قياس ما لم نصل إليه بعد، وإخراجه طابور عمل**.
 *
 * ## لماذا القياس داخل العميل لا بالسكربت وحده
 *
 * `pnpm intl:harvest` يحصد عبر منفذ التنقيح — يصلح للمطوّر لا للمستخدم.
 * وهذا يقيس **ما يعرضه ديسكورد أمامك الآن**: نسخته وبناؤه والشاشات التي
 * فتحتها فعلاً. فما لم تفتحه لم يُحمَّل، ولذلك يرتفع الرقم كلّما تجوّلت.
 *
 * ## 🔴 صفر استهلاك ما لم يُطلَب
 *
 * لا مؤقّت ولا مراقب ولا خطّاف: الفحص **لا يجري إلّا بضغطة**، ويقرأ
 * **المُنفَّذ سلفاً فقط** من ذاكرة webpack فلا ينفّذ وحدة واحدة زيادة.
 */

import { ARABIC_TABLE_GLOBAL } from "@utils/esharqLocale";
import { wreq } from "@webpack";

import { type CoverageCounts, computeCoverage } from "./coverageCompare";

/** مفتاح رسالة عند ديسكورد: ستّة محارف base64 — مرصود من حزمة حقيقية. */
const KEY = /^[A-Za-z0-9+/]{6}$/;

/** نسبة المفاتيح المُجزَّأة التي تجعل الكائن جدول رسائل لا كائناً عابراً. */
const HASHED_RATIO = 0.8;

export interface CoverageReport extends CoverageCounts {
    /** جداول الرسائل التي عُرِفت في الذاكرة. */
    tables: number;
}

/**
 * يُعيد تركيب النصّ الإنجليزي من شجرة الأجزاء، ويُبقي مواضع الإدراج معلَّمة
 * `{name}`. شكل لم نره ⇒ نتركه ولا نخمّنه: نصّ مخمَّن يدخل القاموس خطأً.
 */
function plain(parts: unknown): string | null {
    if (typeof parts === "string") return parts;
    if (!Array.isArray(parts)) return null;

    let text = "";
    for (const part of parts) {
        if (typeof part === "string") text += part;
        else if (Array.isArray(part) && part[0] === 1 && typeof part[1] === "string") text += `{${part[1]}}`;
        else return null;
    }
    return text;
}

/** الجدول العربي المُثبَّت من النواة — مرجع المقارنة. */
function installedTable(): Record<string, unknown> {
    const table = (globalThis as Record<string, unknown>)[ARABIC_TABLE_GLOBAL];
    return table !== null && typeof table === "object" ? table as Record<string, unknown> : {};
}

/**
 * فحص واحد عند الطلب. يمرّ على ذاكرة webpack المُنفَّذة، يتعرّف على جداول
 * الرسائل بالنسبة لا بالاسم (الأسماء مُصغَّرة ومتغيّرة)، ويقارن بجدولنا.
 */
export function scanCoverage(): CoverageReport {
    const arabic = installedTable();
    const seen = new Map<string, string>();
    let tables = 0;

    const cache = wreq?.c;
    if (cache == null) return { tables: 0, liveKeys: 0, translated: 0, untranslated: {} };

    for (const id of Object.keys(cache)) {
        let exports: unknown;
        try {
            exports = cache[id]?.exports;
        } catch { continue; }
        if (exports === null || typeof exports !== "object") continue;

        // الجدول يُصدَّر على `default` في الحِزَم المرصودة، وعارياً في غيرها.
        for (const candidate of [exports, (exports as Record<string, unknown>).default]) {
            if (candidate === null || typeof candidate !== "object") continue;

            let keys: string[];
            try { keys = Object.keys(candidate as object); } catch { continue; }
            if (keys.length < 5) continue;

            let hashed = 0;
            for (const key of keys) if (KEY.test(key)) hashed++;
            if (hashed / keys.length < HASHED_RATIO) continue;

            tables++;
            for (const key of keys) {
                if (!KEY.test(key) || seen.has(key)) continue;
                let value: unknown;
                try { value = (candidate as Record<string, unknown>)[key]; } catch { continue; }
                const text = plain(value);
                if (text !== null && text.length > 0) seen.set(key, text);
            }
        }
    }

    return { tables, ...computeCoverage(seen, arabic) };
}
