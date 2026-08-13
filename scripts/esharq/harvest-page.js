/*
 * يُنفَّذ **داخل صفحة ديسكورد** — يُحصد منه جدول الرسائل الحيّ.
 *
 * لماذا من ذاكرة webpack المؤقّتة لا من ملفات الحِزَم: الجدول المُحمَّل هو
 * ما يعرضه ديسكورد فعلاً الآن، بنسخته وبناءه — والملفات قد تتقادم بين
 * إصدار وآخر. ونقرأ **المُنفَّذ سلفاً** فقط، فلا ننفّذ وحدة واحدة زيادة.
 *
 * شكل المفتاح مرصود من حزمة رسائل حقيقية: ستّة محارف base64 بأبجدية
 * تشمل `/` و`+`. والقيمة **شجرة أجزاء** لا نصّ.
 *
 * 🔴 **الشجرة تُعاد خاماً كما هي، ولا تُترجم هنا إلى نصّ.**
 * كانت هذه الصفحة تُسطّح الشجرة بنفسها فتُسقط كل ما لم يكن نصّاً أو
 * `[1,"اسم"]` — **3,892 مفتاحاً** فيها الجمع وتنسيق النصّ والتواريخ. وحتى
 * لو عُلِّمت البنى هنا لصار للمُسلسِل نسختان: واحدة تعمل داخل ديسكورد
 * وأخرى في `intlAst.mjs` تقرأ العربية — ونسختان تفترقان بلا أن يلاحظ أحد.
 * فالتسلسل كلّه في وحدة واحدة عند Node، وهذه الصفحة تجمع لا غير.
 */
(() => {
    const KEY = /^[A-Za-z0-9+/]{6}$/;
    const wreq = globalThis.Vencord?.Webpack?.wreq;
    if (wreq?.c == null) return JSON.stringify({ error: "لا وصول إلى ذاكرة webpack" });

    const messages = {};
    let scanned = 0;
    let callables = 0;

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
                if (value == null) continue;

                // قيمة دالّة = مُنسِّق يكتبه ديسكورد بيده لا رسالة بيانات،
                // فلا نصّ فيها يُترجَم. رُصدت 28 منها ويُصرَّح بعددها.
                if (typeof value === "function") { callables++; continue; }

                messages[key] = value;
            }
        }
    }

    return JSON.stringify({
        tables: scanned,
        keys: Object.keys(messages).length,
        callables,
        messages
    });
})()
