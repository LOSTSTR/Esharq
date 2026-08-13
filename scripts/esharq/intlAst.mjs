/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * شجرة رسائل ديسكورد ⇄ نصّ مصدر — **الجسر إلى «الطبقة العنيدة»**.
 *
 * كان الحاصد يقرأ الأجزاء البسيطة وحدها (نصّ و`[1,"اسم"]`) **فيُسقط 3,892
 * مفتاحاً** بنيتها أعقد: جمعٌ وتنسيقُ نصٍّ وتواريخ. وتلك بالضبط النصوص التي
 * كانت الإضافة القديمة تُلاحقها بطبقة تشغيل (`domFallback` وأنماط رقمية
 * يدوية). هذه الوحدة تُلغي الحاجة إلى تلك الطبقة: تُحوّل الشجرة إلى **نصّ
 * يُقرأ ويُترجَم**، وتُعيد النصّ العربي شجرةً **يفهمها مُنسِّق ديسكورد نفسه**.
 *
 * ⇒ الجمع العربي بصيغه الستّ يختاره محرّك ديسكورد، والعدد يُدرجه هو.
 * **صفر كود عند المستخدم.**
 *
 * ## الأنواع التسعة — مقيسة من العميل الحيّ لا مُخمَّنة
 *
 * | العقدة | المصدر |
 * |---|---|
 * | `"نصّ"` | `نصّ` |
 * | `[1,"n"]` | `{n}` |
 * | `[2,"n"]` | `{n, number}` |
 * | `[3,"n","long"]` | `{n, date, long}` |
 * | `[4,"n","short"]` | `{n, time, short}` |
 * | `[5,"n",{…}]` | `{n, select, a {…} other {…}}` |
 * | `[6,"n",{…},0,"cardinal"]` | `{n, plural, one {…} other {…}}` |
 * | `[7]` | `#` |
 * | `[8,"$b",[…]]` | `<$b>…</$b>` |
 * | `[8,"$link",[…],[[1,"url"]]]` | `<$link={url}>…</$link>` |
 *
 * ## 🔴 الهروب **سياقيّ**، وهذا شرط لا تحسين
 *
 * الصيغة الساذجة تهرب من `<` و`{` و`\` دائماً. وقياسُ اللقطة الحالية يقول إن
 * سبعة نصوص **مُعرَّبة سلفاً** تحمل هذه المحارف حرفيّاً (`Sent < 1 minute
 * ago` · `¯\_(ツ)_/¯`). فالهروب الدائم يُغيّر مفاتيحها ⇒ **تسقط ترجمتها
 * صامتةً** ولا يشتكي شيء.
 *
 * ولذلك: المحرف يُهرَب **فقط إن كان سيُقرأ بنيةً في موضعه**. `<` قبل مسافة
 * نصٌّ، و`<` قبل اسم وسم ثمّ `>` بنية. والنتيجة المقيسة: **كل مفاتيح اللقطة
 * الـ22,484 تبقى نصوصها كما هي حرفاً بحرف** — لا دفعة تُعاد ولا تغطية تُفقَد.
 *
 * والبرهان ليس هذا الشرح: `intlAstSelfTest.mjs` يُدوّر كل مفتاح حيّ
 * **شجرة ⇒ نصّ ⇒ شجرة** ويطابق النتيجة بالأصل.
 */

/** أنواع العقد كما يرقّمها ديسكورد. */
export const NODE = {
    ARGUMENT: 1,
    NUMBER: 2,
    DATE: 3,
    TIME: 4,
    SELECT: 5,
    PLURAL: 6,
    POUND: 7,
    TAG: 8
};

/** ما يجوز أن يأتي بعد `\` — وما عداه فالشرطة نفسها نصّ. */
const ESCAPABLE = "{}<>#\\";

/** أسماء المتغيّرات والوسوم كما رُصدت: حروف وأرقام و`$` و`_`. */
const NAME = /[A-Za-z0-9$_]+/y;

/** صيغ الجمع التي يقبلها CLDR — والعربية تستعمل الستّ كلّها. */
export const PLURAL_CATEGORIES = new Set(["zero", "one", "two", "few", "many", "other"]);

// ── التحويل: شجرة ⇒ نصّ ────────────────────────────────────────────────

/** هل يبدأ `text` عند `at` بما يُقرأ **متغيّراً**؟ */
function opensArgument(text, at) {
    return /^\{[A-Za-z0-9$_]+\s*[,}]/.test(text.slice(at));
}

/** هل يبدأ `text` عند `at` بما يُقرأ **وسماً** (فتحاً أو إغلاقاً)؟ */
function opensTag(text, at) {
    return /^<\/?[A-Za-z0-9$_]+[>=]/.test(text.slice(at));
}

/**
 * يهرب من محارف النصّ الحرفيّ — **بحسب موضعها لا بإطلاق**.
 *
 * `ctx.branch` يعني أننا داخل `{…}` لفرع جمع أو اختيار، فـ`}` يُنهيه.
 * `ctx.plural` يعني أن `#` يعني العدد. `ctx.tagArg` يعني أن `>` يُنهي الوسيط.
 */
function escapeLiteral(text, ctx) {
    let out = "";

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === "\\" && ESCAPABLE.includes(text[i + 1] ?? "")) out += "\\\\";
        else if (char === "{" && opensArgument(text, i)) out += "\\{";
        else if (char === "<" && opensTag(text, i)) out += "\\<";
        else if (char === "}" && ctx.branch) out += "\\}";
        else if (char === "#" && ctx.plural) out += "\\#";
        else if (char === ">" && ctx.tagArg) out += "\\>";
        else out += char;
    }

    return out;
}

function serializeParts(parts, ctx) {
    if (typeof parts === "string") return escapeLiteral(parts, ctx);
    if (!Array.isArray(parts)) throw new Error(`أجزاء بشكل غير متوقّع: ${typeof parts}`);

    let out = "";
    for (const part of parts) {
        out += typeof part === "string" ? escapeLiteral(part, ctx) : serializeNode(part, ctx);
    }
    return out;
}

function serializeBranches(cases, ctx) {
    const inner = { ...ctx, branch: true, tagArg: false };
    return Object.entries(cases)
        .map(([name, parts]) => `${name} {${serializeParts(parts, inner)}}`)
        .join(" ");
}

function serializeNode(node, ctx) {
    if (!Array.isArray(node) || typeof node[0] !== "number") {
        throw new Error(`عقدة بشكل غير متوقّع: ${JSON.stringify(node)?.slice(0, 60)}`);
    }

    const [type, name] = node;

    switch (type) {
        case NODE.ARGUMENT: return `{${name}}`;
        case NODE.NUMBER: return `{${name}, number}`;
        case NODE.DATE: return `{${name}, date, ${node[2]}}`;
        case NODE.TIME: return `{${name}, time, ${node[2]}}`;

        case NODE.POUND:
            // `#` خارج الجمع لا معنى له. الصمت هنا يُنتج نصّاً ناقصاً عند
            // المستخدم، فالانفجار أصدق: لم يُرصد في أي مفتاح حيّ.
            if (!ctx.plural) throw new Error("`#` خارج صيغة جمع");
            return "#";

        case NODE.SELECT:
            return `{${name}, select, ${serializeBranches(node[2], { ...ctx, plural: false })}}`;

        case NODE.PLURAL: {
            const offset = node[3] ?? 0;
            const keyword = node[4] === "ordinal" ? "selectordinal" : "plural";
            const prefix = offset === 0 ? "" : `offset:${offset} `;
            return `{${name}, ${keyword}, ${prefix}${serializeBranches(node[2], { ...ctx, plural: true })}}`;
        }

        case NODE.TAG: {
            const children = serializeParts(node[2] ?? [], { ...ctx, tagArg: false });
            const argument = node.length > 3
                ? `=${serializeParts(node[3], { ...ctx, branch: false, tagArg: true })}`
                : "";
            return `<${name}${argument}>${children}</${name}>`;
        }

        default:
            throw new Error(`نوع عقدة مجهول: ${type}`);
    }
}

/** شجرة أجزاء ⇒ نصّ مصدر يُقرأ ويُترجَم. */
export function astToSource(parts) {
    return serializeParts(parts, { branch: false, plural: false, tagArg: false });
}

// ── التحويل: نصّ ⇒ شجرة ────────────────────────────────────────────────

class Parser {
    constructor(text) {
        this.text = text;
        this.at = 0;
    }

    fail(message) {
        throw new Error(`${message} (عند ${this.at} من ${JSON.stringify(this.text.slice(0, 80))})`);
    }

    /** يقرأ اسماً (متغيّر أو وسم) عند الموضع الحالي. */
    readName() {
        NAME.lastIndex = this.at;
        const match = NAME.exec(this.text);
        if (match === null) this.fail("اسم متوقّع");
        this.at = NAME.lastIndex;
        return match[0];
    }

    skipSpace() {
        while (/\s/.test(this.text[this.at] ?? "")) this.at++;
    }

    expect(char) {
        if (this.text[this.at] !== char) this.fail(`«${char}» متوقّع`);
        this.at++;
    }

    /**
     * يقرأ أجزاءً حتى نهاية النصّ أو حتى المُنهي الذي يفرضه السياق.
     * `ctx.closeTag` اسم الوسم الذي يُنهي القراءة بـ`</اسم>`.
     */
    parseParts(ctx) {
        const parts = [];
        let literal = "";

        const flush = () => {
            if (literal.length > 0) { parts.push(literal); literal = ""; }
        };

        while (this.at < this.text.length) {
            const char = this.text[this.at];

            if (char === "\\" && ESCAPABLE.includes(this.text[this.at + 1] ?? "")) {
                literal += this.text[this.at + 1];
                this.at += 2;
                continue;
            }

            if (char === "}" && ctx.branch) break;
            if (char === ">" && ctx.tagArg) break;

            if (char === "#" && ctx.plural) {
                flush();
                parts.push([NODE.POUND]);
                this.at++;
                continue;
            }

            if (char === "{" && opensArgument(this.text, this.at)) {
                flush();
                parts.push(this.parseArgument());
                continue;
            }

            if (char === "<" && opensTag(this.text, this.at)) {
                // وسم إغلاق: يُنهي أبناء الوسم المفتوح، وإلّا فهو خطأ صريح.
                if (this.text[this.at + 1] === "/") {
                    if (ctx.closeTag === undefined) this.fail("وسم إغلاق بلا فتح");
                    break;
                }
                flush();
                parts.push(this.parseTag(ctx));
                continue;
            }

            literal += char;
            this.at++;
        }

        flush();
        return parts;
    }

    parseArgument() {
        this.expect("{");
        const name = this.readName();
        this.skipSpace();

        if (this.text[this.at] === "}") { this.at++; return [NODE.ARGUMENT, name]; }

        this.expect(",");
        this.skipSpace();
        const kind = this.readName();
        this.skipSpace();

        if (kind === "number") { this.expect("}"); return [NODE.NUMBER, name]; }

        if (kind === "date" || kind === "time") {
            this.expect(",");
            this.skipSpace();
            // الصيغة قد تحوي `/` و`:` (`M/d` · `::MMMMd`)، فتُقرأ حتى `}`.
            const end = this.text.indexOf("}", this.at);
            if (end === -1) this.fail("صيغة تاريخ غير مغلقة");
            const style = this.text.slice(this.at, end).trim();
            this.at = end + 1;
            return [kind === "date" ? NODE.DATE : NODE.TIME, name, style];
        }

        if (kind === "select") return this.parseBranches(name, NODE.SELECT);
        if (kind === "plural" || kind === "selectordinal") {
            return this.parseBranches(name, NODE.PLURAL, kind === "selectordinal");
        }

        return this.fail(`نوع متغيّر مجهول: ${kind}`);
    }

    parseBranches(name, type, ordinal = false) {
        this.expect(",");
        this.skipSpace();

        let offset = 0;
        if (this.text.startsWith("offset:", this.at)) {
            this.at += "offset:".length;
            const digits = /-?\d+/y;
            digits.lastIndex = this.at;
            const match = digits.exec(this.text);
            if (match === null) this.fail("رقم إزاحة متوقّع");
            offset = Number(match[0]);
            this.at = digits.lastIndex;
            this.skipSpace();
        }

        const inner = {
            branch: true,
            plural: type === NODE.PLURAL,
            tagArg: false,
            closeTag: undefined
        };

        const cases = {};
        while (this.at < this.text.length && this.text[this.at] !== "}") {
            // مفتاح الفرع: `one` · `other` · `=0` · `VOICE_ISOLATION` · `true`
            const exact = this.text[this.at] === "=";
            if (exact) this.at++;
            const label = (exact ? "=" : "") + (exact ? this.readExactNumber() : this.readName());

            this.skipSpace();
            this.expect("{");
            cases[label] = this.parseParts(inner);
            this.expect("}");
            this.skipSpace();
        }

        this.expect("}");

        if (Object.keys(cases).length === 0) this.fail("صيغة بلا فروع");

        return type === NODE.SELECT
            ? [NODE.SELECT, name, cases]
            : [NODE.PLURAL, name, cases, offset, ordinal ? "ordinal" : "cardinal"];
    }

    readExactNumber() {
        const digits = /-?\d+/y;
        digits.lastIndex = this.at;
        const match = digits.exec(this.text);
        if (match === null) this.fail("رقم متوقّع بعد «=»");
        this.at = digits.lastIndex;
        return match[0];
    }

    parseTag(ctx) {
        this.expect("<");
        const name = this.readName();

        let argument;
        if (this.text[this.at] === "=") {
            this.at++;
            argument = this.parseParts({ branch: false, plural: ctx.plural, tagArg: true, closeTag: undefined });
        }

        this.expect(">");

        const children = this.parseParts({ ...ctx, tagArg: false, closeTag: name });

        this.expect("<");
        this.expect("/");
        const closing = this.readName();
        if (closing !== name) this.fail(`وسم مُغلق باسم آخر: ${name} ⇒ ${closing}`);
        this.expect(">");

        return argument === undefined
            ? [NODE.TAG, name, children]
            : [NODE.TAG, name, children, argument];
    }
}

/** نصّ مصدر ⇒ شجرة أجزاء كما ينتظرها مُنسِّق ديسكورد. */
export function sourceToAst(text) {
    const parser = new Parser(text);
    const parts = parser.parseParts({ branch: false, plural: false, tagArg: false, closeTag: undefined });

    if (parser.at < text.length) parser.fail("بقيّة غير مقروءة");

    // رسالة فارغة تبقى جزءاً فارغاً: الشكل الذي يقبله المحرّك.
    return parts.length === 0 ? [""] : parts;
}

// ── البصمة البنيوية — ما يجب أن تحفظه الترجمة ──────────────────────────

/**
 * بصمة تصف **ما لا يجوز أن تُغيّره الترجمة**: المتغيّرات وأنواعها، وأسماء
 * الوسوم ووسيطاتها، وأطراف الاختيار.
 *
 * ## 🔴 ثلاثة استثناءات، كلٌّ منها لأن اشتراطه يرفض عربيةً صحيحة
 *
 * 1. **أسماء صيغ الجمع**: الإنجليزية فرعان (`one`/`other`) والعربية ستّة.
 * 2. **`#`**: يظهر في بعض الفروع دون بعض (`zero {لا أصدقاء}` بلا عدد)،
 *    فعدُّه يجعل البصمة تتبع عدد الفروع لا معنى الرسالة.
 * 3. **ما داخل الفروع يُجمَع اتّحاداً لا تَكراراً**: فرعان إنجليزيان فيهما
 *    `{name}` مقابل ستّة فروع عربية فيها `{name}` ⇒ العدد يختلف والمعنى
 *    واحد. فالمقارنة على **وجود المتغيّر** لا على عدد مرّاته.
 *
 * وهذه الاستثناءات الثلاثة **اكتشفتها الضوابط السالبة في الاختبار** لا
 * القراءة: أوّل نسخة رفضت الجمع العربي الصحيح وهي تظنّ أنها تحميه.
 */
function collect(node, into) {
    if (typeof node === "string" || node == null) return;

    if (!Array.isArray(node)) return;
    if (typeof node[0] !== "number") { for (const child of node) collect(child, into); return; }

    const [type, name] = node;
    switch (type) {
        case NODE.ARGUMENT:
        case NODE.NUMBER:
            into.add(`${type}:${name}`);
            return;
        case NODE.DATE:
        case NODE.TIME:
            into.add(`${type}:${name}:${node[2]}`);
            return;
        case NODE.POUND:
            return; // مستثنى — انظر (2) أعلاه
        case NODE.SELECT: {
            // أطراف الاختيار **قِيَم لا صيغ لغوية** (`true` · `STUDIO`)،
            // فحذف طرفٍ منها يُسقط حالةً كاملة ⇒ تدخل البصمة بأسمائها.
            into.add(`5:${name}:${Object.keys(node[2]).sort().join("|")}`);
            for (const value of Object.values(node[2])) collect(value, into);
            return;
        }
        case NODE.PLURAL: {
            into.add(`6:${name}:${node[3] ?? 0}:${node[4] ?? "cardinal"}`);
            for (const value of Object.values(node[2])) collect(value, into);
            return;
        }
        case NODE.TAG:
            into.add(`8:${name}${node.length > 3 ? ":arg" : ""}`);
            collect(node[2] ?? [], into);
            if (node.length > 3) collect(node[3], into);
            return;
        default:
            into.add(`?${type}`);
    }
}

export function structureOf(parts) {
    const into = new Set();
    collect(parts, into);
    return [...into].sort().join(",");
}

/**
 * يفحص ترجمةً عربية مقابل أصلها الإنجليزي.
 * يُعيد `null` إن سلمت، أو سبب الرفض نصّاً.
 *
 * 🔴 الرفض هنا **أرحم من الشحن**: نصٌّ فقد متغيّراً يُعرض ناقصاً بلا شكوى
 * من أي طبقة — لا خطأ في كونسول ولا مفتاح مفقود، فقط جملة عربية ناقصة.
 */
export function validateTranslation(english, arabic) {
    let source;
    let target;

    try { source = sourceToAst(english); } catch (error) { return `الأصل لا يُقرأ: ${error.message}`; }
    try { target = sourceToAst(arabic); } catch (error) { return `الترجمة لا تُقرأ: ${error.message}`; }

    const wanted = structureOf(source);
    const got = structureOf(target);
    if (wanted !== got) return `بنية مختلفة — يريد [${wanted}] ووجد [${got}]`;

    for (const problem of pluralProblems(target)) return problem;
    return null;
}

/** فروع الجمع في الترجمة: أسماء معروفة، و`other` حاضرة دائماً. */
function* pluralProblems(parts) {
    const walk = function* (node) {
        if (typeof node === "string" || !Array.isArray(node)) return;
        if (typeof node[0] !== "number") { for (const child of node) yield* walk(child); return; }

        if (node[0] === NODE.PLURAL) {
            const labels = Object.keys(node[2]);
            for (const label of labels) {
                if (label.startsWith("=")) continue;
                if (!PLURAL_CATEGORIES.has(label)) {
                    yield `صيغة جمع مجهولة «${label}» في {${node[1]}}`;
                    return;
                }
            }
            // بلا `other` يسقط المُنسِّق على لا شيء لعددٍ لم يُذكَر فرعه.
            if (!labels.includes("other")) { yield `صيغة الجمع {${node[1]}} بلا فرع other`; return; }
        }

        if (node[0] === NODE.SELECT || node[0] === NODE.PLURAL) {
            for (const value of Object.values(node[2])) yield* walk(value);
            return;
        }
        if (node[0] === NODE.TAG) {
            yield* walk(node[2] ?? []);
            if (node.length > 3) yield* walk(node[3]);
        }
    };

    yield* walk(parts);
}
