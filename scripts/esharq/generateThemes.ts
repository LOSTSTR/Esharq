/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * **يولّد ثيمات إشراق الرسمية** — ملفّات `.css` وفهرسها، لمكتبة الثيمات.
 *
 * ## لماذا تُولَّد ولا تُكتب بيدٍ
 *
 * لأنها تُبنى بـ**نفس محرّك منشئ الثيمات** حرفاً بحرف. فما يراه المستخدم في
 * المكتبة هو نفسه ما ينتجه المنشئ عنده — ولو كُتبت بيدٍ لانحرفت عنه بصمت مع
 * أوّل تعديل في المحرّك.
 *
 * ## ولماذا نملكها
 *
 * ثيماتٌ من عندنا: لونٌ نختاره وسلّمٌ يُشتقّ منه. لا ننشر عمل غيرنا في
 * مستودعنا بلا رخصةٍ نعرفها.
 *
 * ## ⚠️ السلّم مُثبَّتٌ في الملفّ
 *
 * ثيمٌ ثابتٌ يجب أن يحمل أرقامه معه، فتُؤخذ نسخةٌ من سلّم ديسكورد وقت التوليد
 * (`scripts/esharq/discordRamp.json`، مقروءةٌ من عميل حيّ). ولو غيّر ديسكورد
 * سلّمه لزم إعادة التوليد — وهذا قيدُ أي ثيمٍ ثابت، لا قيدَنا. أمّا وضع
 * المنشئ الحيّ فيقرأ السلّم في كل جلسة ولا يتقادم.
 *
 *   pnpm generateThemes
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import {
    buildGlassCss,
    buildRampCss,
    NeutralMap,
    Surface,
    SURFACES,
    SurfaceValues
} from "../../src/components/settings/esharq/themeCreator/engine";

/** مستودع الشارات والبيانات العامّ — تسكن الثيمات فيه بجوار باقي ما يُقرأ بلا بناء. */
const OUT_DIR = process.env.ESHARQ_BORED ?? "C:/tmp/Esharq-Bored";
const THEMES_DIR = join(OUT_DIR, "themes");
const RAW_BASE = "https://raw.githubusercontent.com/LOSTSTR/Esharq-Bored/main/themes";

interface ThemeSpec {
    id: string;
    nameAr: string;
    nameEn: string;
    descAr: string;
    descEn: string;
    color: string;
    glass: SurfaceValues | null;
    panelBlur: number;
    tags: string[];
}

/**
 * الألوان مختارةٌ لا مُولَّدة: كلٌّ منها تحت عتبة التباين للوضع الداكن، وبينها
 * فروقٌ في الصبغة تكفي لتُميَّز بالعين في شبكة المكتبة.
 */
const THEMES: ThemeSpec[] = [
    {
        id: "midnight-gold",
        nameAr: "ذهب منتصف الليل",
        nameEn: "Midnight Gold",
        descAr: "هوية إشراق نفسها: أسودُ عميق تسري فيه دفءُ الذهب.",
        descEn: "Esharq's own identity: deep black warmed through with gold.",
        color: "1a1710",
        glass: null,
        panelBlur: 0,
        tags: ["esharq", "dark"]
    },
    {
        id: "desert-night",
        nameAr: "ليل الصحراء",
        nameEn: "Desert Night",
        descAr: "رمالٌ باردة بعد الغروب — بنّيٌّ مائل للرماديّ، هادئ للعين الطويلة السهر.",
        descEn: "Cold sand after sunset — a grey-leaning brown, easy on long nights.",
        color: "241f1a",
        glass: null,
        panelBlur: 0,
        tags: ["warm", "dark"]
    },
    {
        id: "deep-sea",
        nameAr: "قاع البحر",
        nameEn: "Deep Sea",
        descAr: "أزرقُ غائر بلا برودةٍ زرقاء صارخة.",
        descEn: "A sunken blue, without the harsh cold cast.",
        color: "141b24",
        glass: null,
        panelBlur: 0,
        tags: ["cool", "dark"]
    },
    {
        id: "olive-grove",
        nameAr: "بستان الزيتون",
        nameEn: "Olive Grove",
        descAr: "أخضرُ زيتونيّ خافت — أهدأ ما في اللوحة.",
        descEn: "A muted olive green — the calmest of the set.",
        color: "1a2018",
        glass: null,
        panelBlur: 0,
        tags: ["green", "dark"]
    },
    {
        id: "glass-slate",
        nameAr: "زجاج الأردواز",
        nameEn: "Glass Slate",
        descAr: "رماديٌّ أزرق مع شفافيةٍ معتدلة على كل سطح — يُظهر خلفية سطح مكتبك خلف ديسكورد.",
        descEn: "A blue-grey with moderate transparency on every surface — your desktop shows through Discord.",
        color: "191c22",
        glass: Object.fromEntries(SURFACES.map(s => [s.key, 30])),
        panelBlur: 14,
        tags: ["glass", "dark"]
    },
    {
        id: "plum-dusk",
        nameAr: "غسق البرقوق",
        nameEn: "Plum Dusk",
        descAr: "بنفسجيٌّ داكن بلا صخب.",
        descEn: "A dark plum, quiet rather than loud.",
        color: "1d1722",
        glass: null,
        panelBlur: 0,
        tags: ["purple", "dark"]
    }
];

function loadRamp(): NeutralMap {
    const path = join(__dirname, "discordRamp.json");
    const raw = JSON.parse(readFileSync(path, "utf8")) as { count: number; map: Record<string, number>; };
    const map: NeutralMap = new Map();
    for (const [index, lightness] of Object.entries(raw.map)) map.set(Number(index), lightness);
    if (map.size < 50) throw new Error(`ramp fixture looks wrong: ${map.size} steps`);
    return map;
}

/**
 * ألوان الأسطح للثيم الثابت.
 *
 * الوضع الحيّ يقرأ اللون من العنصر نفسه؛ ولا عنصرَ هنا، فيُشتقّ من الدرجة التي
 * يستعملها ديسكورد لذلك السطح — وهي مقروءةٌ من مصدره لا مُخمَّنة:
 * `--background-base-low: var(--neutral-66)` وأخواتها.
 */
const SURFACE_NEUTRAL: Record<string, number> = {
    appFrame: 69,
    guilds: 69,
    chat: 69,
    title: 66,
    members: 66,
    panels: 64,
    settings: 66
};

function surfaceColor(surface: Surface): string {
    const index = SURFACE_NEUTRAL[surface.key];
    return index === undefined ? "var(--background-base-low)" : `hsl(var(--neutral-${index}-hsl))`;
}

function build(spec: ThemeSpec, ramp: NeutralMap): string {
    const header = [
        "/**",
        ` * @name ${spec.nameEn}`,
        " * @author Esharq",
        ` * @description ${spec.descEn} · ${spec.descAr}`,
        " * @version 1.0.0",
        " * @source https://github.com/LOSTSTR/Esharq",
        " *",
        ` * ${spec.nameAr} — من ثيمات إشراق الرسمية.`,
        " *",
        " * مُولَّد بمحرّك «منشئ الثيمات»: يُعاد تعريف سلّم ديسكورد الرمادي كلّه",
        " * انطلاقاً من لونٍ واحد، مع حفظ فروق الإضاءة بين درجاته — فيتغيّر اللون",
        " * ويبقى النصّ مقروءاً. عدّله كما تشاء من صفحة «منشئ الثيمات».",
        " */",
        ""
    ].join("\n");

    const blocks = [header, buildRampCss(ramp, spec.color)];
    if (spec.glass != null) blocks.push(buildGlassCss(spec.glass, spec.panelBlur, surfaceColor));

    return blocks.filter(block => block !== "").join("\n\n") + "\n";
}

function main() {
    const ramp = loadRamp();
    if (!existsSync(THEMES_DIR)) mkdirSync(THEMES_DIR, { recursive: true });

    const index = THEMES.map(spec => {
        const css = build(spec, ramp);
        const file = `${spec.id}.theme.css`;
        writeFileSync(join(THEMES_DIR, file), css, "utf8");

        return {
            id: spec.id,
            name: { ar: spec.nameAr, en: spec.nameEn },
            description: { ar: spec.descAr, en: spec.descEn },
            author: "Esharq",
            version: "1.0.0",
            color: `#${spec.color}`,
            tags: spec.tags,
            file,
            url: `${RAW_BASE}/${file}`,
            bytes: Buffer.byteLength(css, "utf8")
        };
    });

    writeFileSync(
        join(THEMES_DIR, "index.json"),
        JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), themes: index }, null, 4) + "\n",
        "utf8"
    );

    console.log(`generated ${index.length} themes into ${THEMES_DIR}`);
    for (const entry of index) console.log(`  ${entry.file.padEnd(28)} ${entry.bytes} bytes  ${entry.color}`);
}

main();
