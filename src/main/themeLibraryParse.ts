/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * **قراءة معرض BetterDiscord** — منطقٌ خالص، بلا `electron` ولا شبكة.
 *
 * 🔴 مفصولٌ عن `themeLibrary.ts` عمداً: ذاك يستورد `electron` فلا يعمل خارج
 * التطبيق، وهذا يُختبَر في البوّابة بـ`node` وحده. وفحصٌ لا يعمل في البوّابة
 * لا يُشغَّل، وفحصٌ لا يُشغَّل ليس فحصاً.
 */

const SITE = "https://betterdiscord.app";

export interface LibraryTheme {
    id: number;
    name: string;
    description: string;
    author: string;
    downloads: number;
    likes: number;
    tags: string[];
    thumbnail: string;
    file: string;
}

/** اسمٌ صالحٌ لملفّ: المعرض يسمح بمحارف لا يسمح بها نظام الملفّات. */
export function fileNameFor(name: string, id: number): string {
    const safe = name.replace(/[^\p{L}\p{N} ._-]/gu, "").trim().replace(/\s+/g, "-").slice(0, 48);
    return `${safe === "" ? "theme" : safe}-${id}.theme.css`;
}

const unescapeJs = (s: string) => s
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, " ")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)));

/**
 * يقرأ كائناً كاملاً بدءاً من `{`، بعدّ الأقواس.
 *
 * 🔴 هذه هي عقدة المحلّل. أوّل نسخةٍ قسّمت النصّ على `{id:` وأخذت 900 حرف —
 * وسقطت: سجلّ الثيم يحوي `thumbnail:{id:176,…}` بداخله، فالقسمة تقطعه **قبل**
 * `tags` و`likes` و`author`. فخرجت الوسوم فارغةً والمؤلّف مجهولاً، والفحص
 * وحده كشفها (ثلاثة إخفاقاتٍ من ثلاثة عشر).
 *
 * وعدّ الأقواس يقرأ الكائن كما هو مهما تداخل. والنصوص تُتخطّى بحالةٍ خاصّة:
 * وصفُ ثيمٍ فيه `}` كان سيُنهي السجلّ قبل أوانه.
 */
function readObject(text: string, open: number): string | null {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = open; i < text.length && i < open + 4000; i++) {
        const ch = text[i];

        if (inString) {
            if (escaped) escaped = false;
            else if (ch === "\\") escaped = true;
            else if (ch === '"') inString = false;
            continue;
        }

        if (ch === '"') inString = true;
        else if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) return text.slice(open, i + 1);
        }
    }
    return null;
}

/**
 * يستخرج الثيمات من نصّ الصفحة.
 *
 * مُصدَّرةٌ ليختبرها فحصٌ ذاتيّ بلا شبكةٍ ولا متصفّح: **قراءةُ صفحةٍ ليست
 * واجهةً برمجية**، وشكلُها قد يتغيّر بلا إنذار — فيجب أن يُكشَف التغيّر في
 * البوّابة لا عند مستخدم.
 *
 * والقراءة متسامحة: كل حقلٍ يُقرأ وحده، فترتيبٌ مختلف لا يُسقط شيئاً، ومدخلٌ
 * ناقص يُتخطّى وحده. والكائنات المتداخلة (`thumbnail` و`author`) تُقرأ أيضاً
 * كمرشّحين ثم تسقط: لا `downloads` فيها.
 */
export function parseThemes(html: string): LibraryTheme[] {
    const out: LibraryTheme[] = [];
    const seen = new Set<number>();

    // 🔴 خريطة المؤلّفين بالرقم.
    //
    // الصفحة تُكرّر كائن المؤلّف مرّةً ثم تُشير إليه بمتغيّرٍ حرفيّ
    // (`author:t`) — 65 إشارةً من أصل 113. فيُبنى جدولٌ من الكائنات المكتوبة
    // كاملةً، ويُبحَث فيه بـ`authorId`.
    //
    // ⚠️ ويبقى بعضهم مجهولاً (49 من 69 يُحلّون): متغيّراتٌ لا تُعرَّف في هذه
    // الصفحة أصلاً. والواجهة **تُخفي السطر** حينها بدل أن تكتب «بواسطة» بلا اسم.
    const authors = new Map<number, string>();
    const AUTHOR_OBJECT = /\{id:(\d+),loginId:\d+[^{}]*?login:\{displayName:"([^"]*)"\}\}/g;
    for (const m of html.matchAll(AUTHOR_OBJECT)) {
        authors.set(Number(m[1]), unescapeJs(m[2]));
    }

    for (const match of html.matchAll(/\{id:\d+,/g)) {
        const record = readObject(html, match.index!);
        if (record === null) continue;

        const id = Number(/^\{id:(\d+),/.exec(record)?.[1]);
        if (!Number.isFinite(id) || seen.has(id)) continue;

        const name = /\bname:"((?:[^"\\]|\\.)*)"/.exec(record)?.[1];
        const downloads = Number(/\bdownloads:(\d+)/.exec(record)?.[1] ?? NaN);
        const thumbnailId = Number(/\bthumbnailId:(\d+)/.exec(record)?.[1] ?? NaN);

        // بلا اسمٍ أو عدّادٍ أو مصغّرة فليس ثيماً — وهكذا تسقط الكائنات
        // المتداخلة التي تحمل `id` و`name` أيضاً.
        if (name === undefined || !Number.isFinite(downloads) || !Number.isFinite(thumbnailId)) continue;

        const description = /\bdescription:"((?:[^"\\]|\\.)*)"/.exec(record)?.[1] ?? "";
        const tagsRaw = /\btags:\[([^\]]*)\]/.exec(record)?.[1] ?? "";
        const tags = [...tagsRaw.matchAll(/"([^"]+)"/g)].map(m => m[1]);
        const likes = Number(/\blikes:"?(\d+)"?/.exec(record)?.[1] ?? 0);
        // المؤلّف: مكتوباً في السجلّ إن وُجد، وإلّا من جدول الأرقام.
        const inlineAuthor = /displayName:"([^"]*)"/.exec(record)?.[1];
        const authorId = Number(/authorId:([0-9]+)/.exec(record)?.[1] ?? NaN);
        const author = inlineAuthor !== undefined
            ? unescapeJs(inlineAuthor)
            : (authors.get(authorId) ?? "");

        const cleanName = unescapeJs(name);
        seen.add(id);
        out.push({
            id,
            name: cleanName,
            description: unescapeJs(description),
            author,
            downloads,
            likes,
            tags,
            thumbnail: `https://betterdiscord.app/image/${thumbnailId}`,
            file: fileNameFor(cleanName, id)
        });
    }

    return out;
}
