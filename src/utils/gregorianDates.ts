/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * تحويل التواريخ الهجرية المعروضة إلى ميلادية — ميزة اختيارية (مُطفأة افتراضياً).
 *
 * ── لماذا في الـDOM لا عبر لفّ `Intl` ──────────────────────────────────
 * شُخِّص على عميل حيّ: ديسكورد يعرض التواريخ بالتقويم الهجريّ للعربية
 * (طابعٌ «11/11/46»، وفاصلٌ «26 جمادى الثانية، 1447»). والمصدر **ليس**
 * `Intl.DateTimeFormat` الأصليّ: قِيس في العالم الرئيسيّ وفي realm نظيف وفي
 * كلّ العُمّال فأعطى `ar`/`ar-SA` تقويماً ميلادياً (`gregory`)؛ وخطّافٌ على
 * مُنشئ `Intl` — مُثبَّتٌ قبل تحميل ديسكورد — لم يلتقط إنشاء أيّ مُنسّقٍ
 * إسلاميّ قطّ. بل يستعمل ديسكورد بوليفيل **@formatjs/intl-datetimeformat**
 * المُضمَّن في وحدةٍ تُحمَّل **قبل مُرقِّع فينكورد** (فلا رقعة تصله)، وببيانات
 * CLDR تجعل `ar-SA` افتراضُه إسلاميّاً، وبتهجئةٍ تخالف ICU («جمادى الثانية»
 * لا «جمادى الآخرة») — فلا لفٌّ ولا رقعةٌ ولا مطابقةُ نصٍّ عبر `Intl` تنفع.
 *
 * ── العلاج ───────────────────────────────────────────────────────────
 * نُعيد كتابة **النصّ المعروض** بعد رسمه: طوابع الرسائل تحمل التاريخ الأصليّ
 * في سمة `datetime` (ISO)، فنقرؤه ونُنسّقه ميلادياً — بلا حاجةٍ لحساب
 * هجريّ↔ميلاديّ. والفواصل بلا `datetime`، فنأخذ تاريخها من أوّل رسالةٍ
 * تليها. والكشف **بجذور أسماء الأشهر** (ربيع/جمادى/… تغطّي كلّ التهجئات)
 * فلا يتأثّر باختلاف بوليفيل ديسكورد عن ICU.
 *
 * ── لماذا آمن ────────────────────────────────────────────────────────
 * لا يمسّ نواة ولا يرقع وحدة؛ يُبدّل قيمة **عُقَد النصّ** وحدها (لا البنية)،
 * ولا يعمل إلا حين يُفعّله المستخدم. والتبديل عَكوسٌ ذهنياً: الإطفاء يوقف
 * المراقب، وأوّل إعادة رسمٍ من ديسكورد تُعيد الهجريّ. ويُعاد التطبيق تلقائياً
 * إن أعاد ديسكورد الرسم (المدّة النسبية تتحدّث)، فيبقى العرض ميلادياً.
 */

/** جذور أسماء الأشهر الهجرية — تكفي للكشف مهما اختلفت التهجئة (الأول/الآخر/الثاني…). */
const HIJRI_STEMS = ["محرم", "صفر", "ربيع", "جمادى", "رجب", "شعبان", "رمضان", "شوال", "القعدة", "الحجة"];
const hasHijriMonth = (s: string): boolean => HIJRI_STEMS.some(m => s.includes(m));

/**
 * تاريخٌ باسم شهرٍ هجريّ: يومٌ + شهر (كلمة أو كلمتان لـ ربيع/جمادى/ذو) + سنة.
 * يدعم الأرقام اللاتينية والعربية‑الهندية. الفاصلة اختيارية.
 */
const MONTH_DATE_RE = /[\d٠-٩]{1,2}\s+(?:محرم|صفر|رجب|شعبان|رمضان|شوال|(?:ربيع|جمادى|ذو)\s+[^\s,،\d٠-٩]+)\s*[،,]?\s*[\d٠-٩]{3,4}/;

/** تاريخٌ رقميّ DD/MM/YY(YY) بأيّ فاصلٍ من / - . ونظامَي الأرقام. */
const NUM_DATE_RE = /[\d٠-٩]{1,2}[/\-.][\d٠-٩]{1,2}[/\-.][\d٠-٩]{2,4}/;

let gregMonthFmt: Intl.DateTimeFormat | null = null;
function gregMonthName(d: Date): string {
    if (!gregMonthFmt) {
        // `calendar:"gregory"` صراحةً: أُثبت حيّاً أنّ `Intl` الأصليّ يُخرج
        // أسماء الأشهر الميلادية العربية صحيحةً («مايو»…) بهذا الخيار.
        try {
            gregMonthFmt = new Intl.DateTimeFormat("ar", { month: "long", calendar: "gregory" });
        } catch {
            gregMonthFmt = new Intl.DateTimeFormat("ar", { month: "long" });
        }
    }
    return gregMonthFmt.format(d);
}

const pad2 = (n: number): string => (n < 10 ? "0" + n : String(n));

/** «٢٠ أغسطس ٢٠٢٦» — يومٌ ثمّ اسم الشهر الميلاديّ ثمّ السنة الكاملة. */
const longGregorian = (d: Date): string => `${d.getDate()} ${gregMonthName(d)} ${d.getFullYear()}`;

/** «20/08/26» — يطابق طول سنة المصدر (رقمان أو أربعة). المكوّنات محلّية لا UTC. */
function numericGregorian(d: Date, yearLen: number): string {
    const y = d.getFullYear();
    const yy = yearLen <= 2 ? String(y).slice(-2) : String(y);
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${yy}`;
}

/** يُبدّل التاريخ الهجريّ وحده في النصّ بالميلاديّ المقابل، ويُبقي ما عداه (الوقت، «—»…). */
function convertText(text: string, d: Date): string {
    if (hasHijriMonth(text)) return text.replace(MONTH_DATE_RE, longGregorian(d));
    const m = NUM_DATE_RE.exec(text);
    if (m) {
        const yearLen = (m[0].split(/[/\-.]/)[2] ?? "").length;
        return text.replace(NUM_DATE_RE, numericGregorian(d, yearLen));
    }
    return text;
}

function dateFromAttr(el: Element): Date | null {
    const dt = el.getAttribute?.("datetime");
    if (!dt) return null;
    const d = new Date(dt);
    return isNaN(d.getTime()) ? null : d;
}

/** يُبدّل قيمة عُقَد النصّ الحاملة تاريخاً هجرياً فقط — فلا تُمَسّ بنية العنصر. */
function convertTextNodes(root: Node, d: Date): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const changes: Array<[Text, string]> = [];
    let node: Node | null;

    while ((node = walker.nextNode())) {
        const v = node.nodeValue;
        if (v && (hasHijriMonth(v) || NUM_DATE_RE.test(v))) {
            const nv = convertText(v, d);
            if (nv !== v) changes.push([node as Text, nv]);
        }
    }
    for (const [textNode, value] of changes) textNode.nodeValue = value;
}

function processTimestamp(el: Element): void {
    const d = dateFromAttr(el);
    if (!d) return;
    convertTextNodes(el, d);
    const label = el.getAttribute("aria-label");
    if (label && (hasHijriMonth(label) || NUM_DATE_RE.test(label))) {
        const next = convertText(label, d);
        if (next !== label) el.setAttribute("aria-label", next);
    }
}

/** تاريخ الفاصل: من أوّل `time[datetime]` في العناصر التي تليه (رسائل ذلك اليوم). */
function dateFromNeighbour(el: Element): Date | null {
    let node: Element | null = el;
    for (let i = 0; i < 8 && node; i++) {
        node = node.nextElementSibling;
        const t = node?.querySelector?.("time[datetime]");
        if (t) {
            const d = dateFromAttr(t);
            if (d) return d;
        }
    }
    return null;
}

function processDivider(el: Element): void {
    const text = el.textContent;
    if (!text || !hasHijriMonth(text)) return;
    const d = dateFromNeighbour(el);
    if (!d) return;
    convertTextNodes(el, d);
}

function scan(): void {
    document.querySelectorAll("time[datetime]").forEach(processTimestamp);
    document.querySelectorAll("[class*='divider']").forEach(processDivider);
}

let observer: MutationObserver | null = null;
let scanQueued = false;

function queueScan(): void {
    if (scanQueued) return;
    scanQueued = true;
    // تجميع تعديلات الإطار الواحد في مسحٍ واحد — لا مسح لكلّ طفرة.
    requestAnimationFrame(() => {
        scanQueued = false;
        try { scan(); } catch { /* لا نُفشِل رسم ديسكورد أبداً */ }
    });
}

/** يبدأ التحويل: مسحٌ فوريّ ثمّ مراقبةٌ لإعادة التطبيق على ما يُرسَم لاحقاً. */
export function startGregorianDates(): void {
    if (observer || typeof document === "undefined") return;
    try { scan(); } catch { /* تجاهل */ }
    observer = new MutationObserver(queueScan);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

/** يوقف التحويل. ما حُوِّل يبقى حتى أوّل إعادة رسمٍ من ديسكورد، أو إعادة تحميل. */
export function stopGregorianDates(): void {
    observer?.disconnect();
    observer = null;
}

/** يشغّل أو يوقف حسب الخيار — يُستدعى من صفحة اللغة وعند الإقلاع. */
export function setGregorianDates(enabled: boolean): void {
    if (enabled) startGregorianDates();
    else stopGregorianDates();
}
