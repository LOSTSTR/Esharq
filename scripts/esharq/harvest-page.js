/*
 * يُنفَّذ **داخل صفحة ديسكورد** — يُحصد منه جدول الرسائل الحيّ.
 *
 * لماذا من ذاكرة webpack المؤقّتة لا من ملفات الحِزَم: الجدول المُحمَّل هو
 * ما يعرضه ديسكورد فعلاً الآن، بنسخته وبناءه — والملفات قد تتقادم بين
 * إصدار وآخر. ونقرأ **المُنفَّذ سلفاً** فقط، فلا ننفّذ وحدة واحدة زيادة.
 *
 * شكل المفتاح مرصود من حزمة رسائل حقيقية: ستّة محارف base64 بأبجدية
 * تشمل `/` و`+`. والقيمة **شجرة أجزاء** لا نصّ: عناصرها نصوص حرفية
 * و`[1,"اسم"]` لمواضع الإدراج.
 */
(() => {
    const KEY = /^[A-Za-z0-9+/]{6}$/;
    const wreq = globalThis.Vencord?.Webpack?.wreq;
    if (wreq?.c == null) return JSON.stringify({ error: "لا وصول إلى ذاكرة webpack" });

    /** يُعيد تركيب النصّ الإنجليزي من الشجرة، ويُبقي مواضع الإدراج معلَّمة. */
    const plain = parts => {
        if (typeof parts === "string") return parts;
        if (!Array.isArray(parts)) return null;

        let text = "";
        for (const part of parts) {
            if (typeof part === "string") text += part;
            else if (Array.isArray(part) && part[0] === 1 && typeof part[1] === "string") text += `{${part[1]}}`;
            else return null; // شكل لم نره — لا نخمّنه
        }
        return text;
    };

    const messages = {};
    let scanned = 0;

    for (const id of Object.keys(wreq.c)) {
        let exports;
        try {
            exports = wreq.c[id]?.exports;
        } catch { continue; }
        if (exports == null || typeof exports !== "object") continue;

        // الوحدة تُصدّر الجدول على `default` كما رُصد في حزمة حقيقية.
        for (const candidate of [exports, exports.default]) {
            if (candidate == null || typeof candidate !== "object") continue;

            let keys;
            try { keys = Object.keys(candidate); } catch { continue; }
            if (keys.length < 5) continue;

            // جدول رسائل: أغلب مفاتيحه بالشكل المُجزَّأ.
            let hashed = 0;
            for (const key of keys) if (KEY.test(key)) hashed++;
            if (hashed / keys.length < 0.8) continue;

            scanned++;
            for (const key of keys) {
                if (!KEY.test(key) || messages[key] !== undefined) continue;
                let value;
                try { value = candidate[key]; } catch { continue; }
                const text = plain(value);
                if (text !== null && text.length > 0) messages[key] = text;
            }
        }
    }

    return JSON.stringify({ tables: scanned, keys: Object.keys(messages).length, messages });
})()
