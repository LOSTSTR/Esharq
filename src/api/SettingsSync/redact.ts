/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * تنقية نسخة الإعدادات من الأسرار قبل تصديرها.
 *
 * ## لماذا
 *
 * النسخة الاحتياطية تُشارَك: تُرسَل في محادثة دعم، تُرفَع في مشكلة على
 * GitHub، تُنسَخ إلى جهاز آخر عبر خدمة. وإعدادات الإضافات تحوي **مفاتيح
 * حقيقية** — مفتاح خدمة ذكاء، رمز خطّاف، كلمة مرور. فتصديرها كما هي يعني
 * أن يُسلّم المستخدم مفاتيحه وهو يظنّ أنه يُشارك تفضيلاته.
 *
 * ## القاعدة
 *
 * تُستبدل **قيمة** المفتاح المشبوه بعلامة، ويبقى **اسمه** ليعرف المستخدم
 * أن هناك ما يجب إعادة إدخاله. الحذف الصامت يترك الإضافة معطّلة بلا سبب
 * ظاهر بعد الاستعادة.
 *
 * 🔴 **الاستثناءات ليست تجميلاً**: `keybind` و`hotkey` و`keyword` تحتوي
 * كلمة `key` وليست أسراراً. بلا استثنائها تُمحى اختصارات المستخدم وكلماته
 * المرصودة عند كل تصدير — وهو ضرر صامت لا يشتكي منه شيء.
 */

/** ما يُعدّ سرّاً باسمه. */
const SECRET = /token|secret|password|passwd|credential|webhook|api[-_]?key|^key$|auth(?!or)/i;

/** ما يحمل «key» ولا علاقة له بالأسرار. */
const NOT_SECRET = /keybind|keyboard|hotkey|keyword|keycap|monkey|keys$|keyOf/i;

/** العلامة التي تحلّ محلّ القيمة — مقروءة، ولا تُشبه مفتاحاً حقيقياً. */
export const REDACTED = "__esharq_redacted__";

export function isSecretKey(name: string): boolean {
    if (NOT_SECRET.test(name)) return false;
    return SECRET.test(name);
}

export interface RedactionResult<T> {
    value: T;
    /** أسماء ما نُقّي — تُعرَض للمستخدم فيعرف ما عليه إعادة إدخاله. */
    redacted: string[];
}

/**
 * نسخة منقّاة من الكائن. لا يُعدَّل الأصل: التنقية للتصدير وحده، وتعديل
 * المخزن الحيّ يعني إفقاد المستخدم مفاتيحه من عميله لا من الملف.
 */
export function redactSecrets<T>(input: T, path = ""): RedactionResult<T> {
    const redacted: string[] = [];

    const walk = (node: any, at: string): any => {
        if (node === null || typeof node !== "object") return node;
        if (Array.isArray(node)) return node.map((item, i) => walk(item, `${at}[${i}]`));

        const out: Record<string, any> = {};
        for (const [key, value] of Object.entries(node)) {
            const here = at === "" ? key : `${at}.${key}`;
            // القيم غير النصّية لا تُنقّى: مفتاح منطقيّ أو رقم ليس سرّاً،
            // وتنقيته تكسر نوعه عند الاستعادة.
            if (typeof value === "string" && value !== "" && isSecretKey(key)) {
                out[key] = REDACTED;
                redacted.push(here);
            } else {
                out[key] = walk(value, here);
            }
        }
        return out;
    };

    return { value: walk(input, path), redacted };
}
