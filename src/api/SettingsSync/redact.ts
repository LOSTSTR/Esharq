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
 *
 * ## لماذا صار «المفتاح» طرفاً لا كلمةً كاملة
 *
 * 🔴 كان `^key$` مُقيَّداً بطرفيه، فلا يمسّ إلّا حقلاً اسمه `key` حرفاً بحرف.
 * ومعنى ذلك أنّ **كلّ** `<اسم الخدمة>Key` كان يخرج سليماً في النسخة:
 * `ezHostKey` و`encryptingHostKey` و`pixelVaultKey` و`pixelDrainKey`
 * و`s3AccessKeyId` — مفاتيح رفعٍ حقيقية. ومثلها `hash` و`session` اللذان لم
 * يكونا في القائمة أصلاً: `catboxUserHash` هو **بديل كلمة المرور** عند
 * Catbox، و`kagiSession` جلسة حسابٍ مدفوع.
 *
 * فصار المِحكّ **نهاية الاسم** لا مطابقته: `…Key`/`…KeyId`/`…Hash`/
 * `…Session`/`…Cookie`. والجمع ينجو من تلقاء نفسه — `getAllKeys` لا ينتهي
 * بـ`key`.
 *
 * 🔴 وحُذف `keys$` من قائمة الاستثناء: لم يكن يحمي اسماً واحداً في المستودع،
 * وكان يفتح ثغرة صامتة — حقلٌ اسمه `apiKeys` يُطابق `api[-_]?key` فيُنقّى،
 * ثمّ يُلغي `keys$` تنقيتَه فيخرج المفتاح.
 *
 * ## و«الترويسات» بالجمع وحدها
 *
 * `customHeadersJson` لا يحمل في اسمه شيئاً من الأعلى، ومع ذلك هو أخطرها:
 * قيمته ترويسات HTTP خامّة، ونصّه الإرشاديّ في الواجهة نفسه
 * `{"Authorization":"Bearer ..."}`. فأُضيف `headers` **بالجمع** لا بالمفرد:
 * الجمع لا يقع في المستودع إلّا على هذا الحقل، والمفرد يقع على ستّة عشر
 * مفتاحَ عرضٍ (`userHeader`، `notifHeader`، `showInputDeviceHeader`…) لا شأن
 * لها بالأسرار.
 */

/** ما يُعدّ سرّاً باسمه. */
const SECRET = /token|secret|password|passwd|credential|webhook|headers|api[-_]?key|key(?:id)?$|hash$|session$|cookie$|auth(?!or)/i;

/** ما يحمل «key» ولا علاقة له بالأسرار. */
const NOT_SECRET = /keybind|keyboard|hotkey|keyword|keycap|monkey|keyOf/i;

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

/** مُدخَلة `IndexedDB` كما تُصدَّر: زوج «مفتاح ← قيمة». */
export type DataStoreEntry = [IDBValidKey, unknown];

/**
 * تنقية مخزن `IndexedDB` — **لا تكفي فيه `redactSecrets`**.
 *
 * 🔴 شكل المخزن ليس شجرة إعدادات. يُصدَّر **مصفوفةَ أزواج**
 * `[[key, value], …]`، فاسم المفتاح يقع **قيمةً** في الموضع صفر لا اسمَ حقل.
 * و`redactSecrets` تُطابق **أسماء الحقول** وحدها ⇒ لو مُرّرت المصفوفة كما هي
 * لعبرت عليها بلا أن ترى اسم مفتاحٍ واحد، ولنجا كلّ سرٍّ قيمتُه نصّ مسطَّح:
 * `ThemeLibrary_uniqueToken` توكن خام، و`decor-auth` و`rdb-auth`
 * و`songspotlight-auth` و`vc-streaks-auth` مخازن تفويض، و`Vencord_cloudSecret`
 * سرّ المزامنة. لا واحد منها حقلٌ داخل كائن — كلّها مفاتيح عليا.
 *
 * فهنا يُقرأ اسم المفتاح **بنفسه**:
 *   • اسمٌ مشبوه ⇒ تُستبدل قيمتُه كلّها مهما كان نوعها. مخزن التفويض سرٌّ
 *     بتمامه، لا حقلاً فيه.
 *   • اسمٌ بريء ⇒ يُنزَل إلى قيمته بـ`redactSecrets` فتُلتقط الحقول الحسّاسة
 *     في داخلها: `CrossPlatform_creds.steamKey`، و`TempMail_accounts[].token`.
 */
export function redactDataStore(entries: DataStoreEntry[]): RedactionResult<DataStoreEntry[]> {
    const redacted: string[] = [];

    const value = entries.map(([key, val]): DataStoreEntry => {
        const name = String(key);

        if (isSecretKey(name)) {
            redacted.push(name);
            return [key, REDACTED];
        }

        const inner = redactSecrets(val, name);
        redacted.push(...inner.redacted);
        return [key, inner.value];
    });

    return { value, redacted };
}

/*
 * ── المسارات ────────────────────────────────────────────────────────────────
 *
 * سرٌّ من نوعٍ آخر: مسار الملفّ على ويندوز يحمل **اسم مستخدم نظام التشغيل**
 * (`C:\Users\<الاسم>\…`)، وهو اسمٌ حقيقيّ في الغالب. وحزمة الدعم تَعِد صراحةً
 * ألّا تُخرج «مسارات جهازك»، فوجب أن يكون الوعد صحيحاً لا مُعاد الصياغة.
 *
 * 🔴 ورسائل `fs` تُضمّن المسار بنفسها — `EACCES: permission denied, open
 * 'C:\Users\<الاسم>\…'` — فتنقية حقل المسار وحده لا تكفي؛ النصوص الحرّة
 * المجاورة تُعيد تسريبه.
 */

/**
 * حرف قرصٍ ثمّ مسار — ويندوز.
 *
 * 🔴 حرف القرص يجب ألّا يسبقه حرفُ كلمة. بلا هذا الشرط يلتقط المِحكّ الـ`s:/`
 * من `https://…` فيبتلع كلّ رابطٍ في أثر الخطأ — وهو ما كشفه الاختبار أدناه.
 */
const WINDOWS_PATH = /(?<![A-Za-z0-9_])[A-Za-z]:[\\/][^\s'"`<>|)\]]*/g;

/**
 * مسار يونكس مطلق.
 *
 * 🔴 يشترط ألّا تسبق الشرطةَ حرفُ كلمة ولا `:` ولا `/`، وإلّا ابتُلعت روابط
 * `https://discord.com/assets/…` في آثار الأخطاء — وهي ليست مسار أحد، وحذفها
 * يُعمي التشخيص بلا أن يحمي شيئاً.
 */
const POSIX_PATH = /(?<![\w:/])\/(?:[^\s'"`<>|)\]/]+\/)+[^\s'"`<>|)\]/]*/g;

const leafOf = (p: string) => p.split(/[\\/]+/).filter(Boolean).pop() ?? "";

/**
 * مسارٌ يُعرَض: آخر مقطعين تحت جذرٍ مُسمّى.
 *
 * يكفيان للتشخيص — يُعرف أيّ ملفّ في أيّ مجلد — ولا يبقى فيهما من هو صاحبه.
 */
export function redactPath(p: string | null | undefined): string | null {
    if (!p) return null;
    const tail = p.split(/[\\/]+/).filter(Boolean).slice(-2);
    return tail.length ? `<userData>/${tail.join("/")}` : "<userData>";
}

/** يُسقط المسارات من أيّ نصّ حرّ ويُبقي اسم الملفّ — به يُشخَّص العطل. */
export function scrubPaths(text: string | null | undefined): string | null {
    if (!text) return null;
    const keep = (m: string) => {
        const leaf = leafOf(m);
        return leaf ? `<path>/${leaf}` : "<path>";
    };
    return text
        .replace(/file:\/\/\/?/gi, "")
        .replace(WINDOWS_PATH, keep)
        .replace(POSIX_PATH, keep);
}
