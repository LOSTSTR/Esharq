/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * **فهرس مكتبة الثيمات** — قراءةٌ وتثبيت، بلا حساب ولا تفويض.
 *
 * ## أين تسكن
 *
 * `Esharq-Bored/themes/index.json` ومعه ملفّات `.css` بجواره. مستودعٌ عامّ
 * يُقرأ بلا مفاتيح، وهو نفسه الذي تُقرأ منه الشارات — فلا خدمةَ جديدة تُدار،
 * ولا تُسجَّل زيارة.
 *
 * ## 🔴 ولا تفويض ولا حساب
 *
 * مكتبةٌ مرجعيّة أخرى تطلب OAuth بصلاحيّتَي `identify` و`connections` لتُسجّل
 * الإعجابات. وهذا ثمنٌ لا يستحقّه تصفّحُ ثيمات: يربط حسابك بخدمةٍ ويكشف
 * حساباتك المتّصلة. فمكتبتنا **تقرأ ملفّاً وتُنزّل ملفّاً**، وليس فيها ما
 * يُعرَف به مَن قرأ.
 *
 * ## والمضيف مسموحٌ سلفاً
 *
 * `raw.githubusercontent.com` مُدرَجٌ في سياسة المحتوى بـ`connect-src`
 * و`img-src` (`src/main/csp/index.ts`) — فلا حاجة إلى توسيعها لأجل هذه
 * الصفحة. وتوسيعُها كان سيفتح لكل ثيمٍ ما فُتح لنا.
 */

const INDEX_URL = "https://raw.githubusercontent.com/LOSTSTR/Esharq-Bored/main/themes/index.json";

export interface CatalogueTheme {
    id: string;
    name: { ar: string; en: string; };
    description: { ar: string; en: string; };
    author: string;
    version: string;
    /** `#rrggbb` — منه تُحسَب المعاينة بنفس رياضيات التطبيق. */
    color: string;
    tags: string[];
    file: string;
    url: string;
    bytes: number;
}

export interface Catalogue {
    version: number;
    updatedAt: string;
    themes: CatalogueTheme[];
}

export type LoadResult =
    | { status: "ok"; catalogue: Catalogue; }
    /** الفهرس غير منشور بعد — حالةٌ متوقّعة لا عطل. */
    | { status: "empty"; }
    | { status: "error"; reason: string; };

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * يُصفّي المدخل قبل عرضه.
 *
 * الملفّ عامّ ويُحرَّر بيدٍ، فمدخلٌ ناقصٌ وارد. وواحدٌ فاسد يجب ألّا يُسقط
 * الصفحة كلّها — يُتخطّى وحده ويُعرَض الباقي.
 */
function sane(entry: unknown): entry is CatalogueTheme {
    const e = entry as Partial<CatalogueTheme>;
    return e != null
        && typeof e.id === "string" && e.id !== ""
        && typeof e.file === "string" && e.file.endsWith(".css")
        && typeof e.url === "string" && e.url.startsWith("https://raw.githubusercontent.com/")
        && typeof e.color === "string" && HEX.test(e.color)
        && typeof e.name?.ar === "string" && typeof e.name?.en === "string";
}

export async function loadCatalogue(): Promise<LoadResult> {
    let response: Response;
    try {
        response = await fetch(INDEX_URL, { cache: "no-cache" });
    } catch {
        return { status: "error", reason: "offline" };
    }

    // 404 = لم يُنشَر الفهرس بعد. حالةٌ نقولها بوضوح بدل أن تبدو الصفحة معطوبة.
    if (response.status === 404) return { status: "empty" };
    if (!response.ok) return { status: "error", reason: `http-${response.status}` };

    let data: any;
    try {
        data = await response.json();
    } catch {
        return { status: "error", reason: "bad-json" };
    }

    const themes = Array.isArray(data?.themes) ? data.themes.filter(sane) : [];
    if (themes.length === 0) return { status: "empty" };

    return {
        status: "ok",
        catalogue: {
            version: Number(data.version) || 1,
            updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
            themes
        }
    };
}

export type InstallResult =
    | { ok: true; fileName: string; }
    | { ok: false; reason: "download" | "empty" | "save"; };

/**
 * يُنزّل الثيم ويكتبه في مجلد الثيمات.
 *
 * 🔴 الرابط **لا يُؤخذ من المدخل كما جاء**: يُعاد بناؤه من `file` على المضيف
 * الثابت. ملفٌّ عامّ قد يُعدَّل، ورابطٌ مأخوذٌ منه كما هو يعني أن من يُعدّله
 * يختار المضيف الذي نُنزّل منه.
 */
export async function installTheme(theme: CatalogueTheme): Promise<InstallResult> {
    const safeFile = theme.file.replace(/[/\\]/g, "");
    const url = `https://raw.githubusercontent.com/LOSTSTR/Esharq-Bored/main/themes/${encodeURIComponent(safeFile)}`;

    let css: string;
    try {
        const response = await fetch(url, { cache: "no-cache" });
        if (!response.ok) return { ok: false, reason: "download" };
        css = await response.text();
    } catch {
        return { ok: false, reason: "download" };
    }

    if (css.trim() === "") return { ok: false, reason: "empty" };

    const saved = await (window as any).VencordNative?.themeCreator?.saveCss?.(safeFile, css);
    return saved?.ok ? { ok: true, fileName: saved.fileName } : { ok: false, reason: "save" };
}
