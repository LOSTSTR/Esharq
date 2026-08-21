/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * اختبار فاحص إضافات المجتمع.
 *
 *   pnpm testCommunity
 *
 * الفاحص **ليس حارساً على النوايا** — قرار تشغيل إضافة خارجية قرار صاحب
 * الجهاز. وظيفته أن تبقى الميزة نفسها سليمة: لا يكتب النسخُ خارج مجلده، ولا
 * يدخل ملفٌّ يكسر التحميل، ولا يُقبَل ما لا يستطيع أحد قراءته.
 *
 * ولذلك أكثر الحالات هنا **سالبة**: ما يجب أن **يمرّ**. فاحصٌ يرفض كل شيء
 * يبدو آمناً وهو عديم النفع — واختبارٌ لا يفشل على الخطأ لا يُثبت شيئاً.
 */

import { type InputFile, LIMITS, validate } from "../../src/main/communityPlugins/validate";

let failed = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failed++;
    console.log(`  ${ok ? "✔" : "✖"} ${label}${detail === undefined ? "" : ` — ${detail}`}`);
}

const enc = new TextEncoder();
const file = (path: string, text: string): InputFile => ({ path, bytes: enc.encode(text) });

const PLUGIN = `
import definePlugin from "@utils/types";
import { Devs } from "@utils/constants";

export default definePlugin({
    name: "Hello",
    description: "says hello",
    authors: [Devs.Ven],
    start() { console.log("hi"); }
});
`;

const rulesOf = (r: ReturnType<typeof validate>) => r.findings.filter(f => f.severity === "error").map(f => f.rule);

console.log("── ما يجب أن يمرّ (ضوابط سالبة) ──");
{
    const r = validate([file("index.ts", PLUGIN)]);
    check("إضافة بسيطة بملفّ index.ts", r.ok, rulesOf(r).join(","));
}
{
    const r = validate([file("index.tsx", PLUGIN), file("styles.css", ".a{color:red}"), file("data.json", "{}")]);
    check("مدخل + css + json", r.ok, rulesOf(r).join(","));
    check("  الموارد تُقبَل ولا تُعدّ كوداً", r.accepted.filter(f => !f.code).length === 2);
}
{
    const r = validate([file("main.js", "export default {};")]);
    check("ملفّ كود وحيد باسم غير index يُعدّ مدخلاً", r.ok, rulesOf(r).join(","));
}
{
    const r = validate([file("index.ts", PLUGIN), file("lib/util.ts", "export const a = 1;")]);
    check("مجلد فرعي", r.ok, rulesOf(r).join(","));
}
{
    // 🔴 الأهمّ: لا نمنع أي واجهة. من أراد `fs` فقراره — وهي ستفشل عند
    // التشغيل لأن المُصيِّر بلا Node، لا لأننا رفضناها.
    const r = validate([file("index.ts", `import fs from "fs";\nimport { exec } from "child_process";\neval("1");\nexport default {};`)]);
    check("لا يُرفض بسبب fs/child_process/eval — القرار للمستخدم", r.ok, rulesOf(r).join(","));
}
{
    const r = validate([file("index.ts", "export default {};\n" + "// تعليق عربيّ فيه مسافات\n".repeat(50))]);
    check("نصّ عربيّ UTF-8", r.ok, rulesOf(r).join(","));
}
{
    const r = validate([file("index.ts", "const s = \"" + "x".repeat(LIMITS.lineChars - 20) + "\";\nexport default {};")]);
    check("سطر طويل لكن تحت الحدّ", r.ok, rulesOf(r).join(","));
}
{
    const r = validate([file("index.ts", PLUGIN), ...Array.from({ length: LIMITS.files - 1 }, (_, i) => file(`f${i}.ts`, "export const a=1;"))]);
    check(`${LIMITS.files} ملفّاً بالضبط (عند الحدّ لا فوقه)`, r.ok, rulesOf(r).join(","));
}

console.log("── ما يجب أن يُرفَض ──");
{
    const r = validate([]);
    check("مجلد فارغ", !r.ok && rulesOf(r).includes("empty"));
}
{
    const r = validate([file("../../evil.ts", PLUGIN)]);
    check("مسار فيه ..", !r.ok && rulesOf(r).includes("bad-path"));
}
{
    const r = validate([file("/etc/passwd.ts", PLUGIN)]);
    check("مسار مطلق", !r.ok && rulesOf(r).includes("bad-path"));
}
{
    const r = validate([file("C:/Windows/x.ts", PLUGIN)]);
    check("حرف سواقة", !r.ok && rulesOf(r).includes("bad-path"));
}
{
    const r = validate([file("a/../../b.ts", PLUGIN)]);
    check(".. في وسط المسار", !r.ok && rulesOf(r).includes("bad-path"));
}
{
    const r = validate([file("index.ts", PLUGIN), file("run.exe", "MZ")]);
    check("امتداد تنفيذيّ", !r.ok && rulesOf(r).includes("bad-extension"));
}
{
    const r = validate([{ path: "index.ts", bytes: new Uint8Array([0xff, 0xfe, 0x00, 0x80, 0x9f]) }]);
    check("ليس UTF-8", !r.ok && rulesOf(r).includes("not-utf8"));
}
{
    const r = validate([file("index.ts", "const a=1;".repeat(400) + "\nexport default {};")]);
    check("سطر مُصغَّر فوق الحدّ", !r.ok && rulesOf(r).includes("minified"));
}
{
    const r = validate([file("index.js", "export default {};\n//# sourceMappingURL=index.js.map")]);
    check("خريطة مصدر ⇒ ناتج بناء", !r.ok && rulesOf(r).includes("generated"));
}
{
    const r = validate([{ path: "index.ts", bytes: enc.encode("x".repeat(LIMITS.fileBytes + 1)) }]);
    check("ملفّ فوق حدّ الحجم", !r.ok && rulesOf(r).includes("file-too-big"));
}
{
    const r = validate(Array.from({ length: LIMITS.files + 1 }, (_, i) => file(`f${i}.ts`, "export const a=1;")));
    check("عدد ملفّات فوق الحدّ", !r.ok && rulesOf(r).includes("too-many-files"));
}
{
    const r = validate([file("styles.css", ".a{}"), file("data.json", "{}")]);
    check("موارد بلا كود", !r.ok && rulesOf(r).includes("no-code"));
}
{
    const r = validate([file("a.ts", "export const a=1;"), file("b.ts", "export const b=2;")]);
    check("ملفّا كود بلا index ⇒ لا مدخل معروف", !r.ok && rulesOf(r).includes("no-entry"));
}

console.log("── سلوك التجميع ──");
{
    const r = validate([file("run.exe", "MZ"), file("../x.ts", "a"), { path: "b.ts", bytes: new Uint8Array([0xff]) }]);
    const rules = new Set(rulesOf(r));
    check("يجمع كل المشاكل لا أوّلها فقط", rules.size >= 3, [...rules].join(","));
}
{
    const r = validate([file("index.ts", PLUGIN), file("empty.ts", "   \n  ")]);
    check("الملفّ الفارغ تحذير لا خطأ", r.ok && r.findings.some(f => f.rule === "empty-file" && f.severity === "warning"));
}
{
    const r = validate([file("index.ts", "const a=1;".repeat(400))]);
    const f = r.findings.find(x => x.rule === "minified");
    check("الرفض يحمل رقم سطر", f?.line === 1, f?.line);
    check("الرفض يحمل اسم الملفّ", f?.file === "index.ts", f?.file);
}

console.log(failed === 0 ? "\n✅ كل الحالات مرّت" : `\n❌ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
