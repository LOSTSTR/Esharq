/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * **مُحمِّل إضافات المجتمع** — يُشغّل ما استورده العضو من جهازه.
 *
 * ## التوقيت هو كل شيء
 *
 * يُنادى هذا المُحمِّل **قبل `initPluginManager`** في `Vencord.ts`. والسبب
 * مقيس لا مفترَض: مدير الإضافات يمرّ على `Plugins` مرّةً واحدة فيُسجّل الرقع
 * ويحسب التبعيات. فإن أُضيفت إضافة بعده، لم تُسجَّل رقعها، ولم يُشغَّل بدؤها —
 * وتبدو «مُفعَّلة» في الواجهة وهي لا تفعل شيئاً. وهذا أسوأ من عطبٍ ظاهر.
 *
 * ## حدود المسؤولية
 *
 * إشراق مسؤول عن **التحميل**: أن يُقرأ الكود ويُنفَّذ ويُسجَّل في وقته، وأن
 * يُعزَل خطؤه فلا يُسقط العميل. **وليس مسؤولاً عن الإضافة**: لا يكتبها ولا
 * يُراجعها ولا يُحدّثها. ما يفعله كودُها شأن من كتبه ومن استورده.
 */

import { Settings } from "@api/Settings";
import * as ForkI18nShim from "@utils/forkI18nShim";
import { Logger } from "@utils/Logger";
import * as WebpackCommon from "@webpack/common";

import { PluginMeta } from "~plugins";

import { resolveModule } from "./moduleMap";

const logger = new Logger("CommunityPlugins", "#c9a227");

/** يُقرأ عند كل استعمال، فلا يُثبَّت `undefined` قبل جهوز webpack. */
const lazyReact: any = new Proxy({}, {
    get: (_t, key) => (WebpackCommon.React as any)?.[key],
    has: (_t, key) => key in ((WebpackCommon.React as any) ?? {})
});

export interface LoadedCommunityPlugin {
    id: string;
    name: string;
    hash: string;
    /** اسم الإضافة كما سُجّل في `Plugins` — قد يختلف عن `name` عند التصادم. */
    registeredAs?: string;
    error?: string;
}

const loaded: LoadedCommunityPlugin[] = [];

/** ما حُمّل في هذه الجلسة — تقرؤه الصفحة فتُظهر الحقيقة لا الأمنية. */
export function getLoaded(): readonly LoadedCommunityPlugin[] {
    return loaded;
}

/**
 * ينفّذ وحدات إضافة واحدة بترتيبها، ويُعيد صادرات آخرها (المدخل).
 *
 * 🔴 التنفيذ بـ`new Function` لا `eval`: `eval` يرى نطاق من ناداه فيلتقط
 * متغيّراتنا الداخلية بأسمائها المُصغَّرة، فيصير سلوك الإضافة رهيناً بأسماء
 * يُغيّرها البناء التالي. و`new Function` تُنشئ نطاقاً جذره عالميّ، فما تراه
 * الإضافة هو ما نُمرّره لها لا أكثر.
 */
/**
 * أسماء مُترجِمات الشوكات المعروفة — يُطابَق **آخر جزء من المسار** لا المسار
 * كلّه، لأنّ العمق يختلف: `../autoTranslateNightcord` و`../../utils/i18n`.
 *
 * 🔴 يبقى ضيّقاً عن قصد: كلّ اسمٍ هنا قرأتُ مصدره وتحقّقتُ أنّ عقده
 * `t(key) => key` بالإنجليزية. ولا يُضاف اسمٌ لم يُقرأ مصدره — البديل الخاطئ
 * أسوأ من فشلٍ صريح، لأنّه يعمل ويكذب.
 */
const FORK_I18N = /^(autoTranslate\w*|testcordI18n|nightcordI18n|trashcordI18n)$/;

/**
 * بديلٌ لاستيرادٍ يخرج من مجلّد الإضافة، أو `undefined` إن لم نعرفه.
 *
 * ما لا نعرفه يبقى خطأً صريحاً: أن تسقط الإضافة بسببٍ مفهوم خيرٌ من أن تعمل
 * بوحدةٍ فارغة اخترعناها لها.
 */
export function substituteEscapingImport(specifier: string): any {
    const tail = specifier.replace(/\.(jsx?|tsx?)$/, "").split("/").filter(p => p !== "" && p !== "." && p !== "..").pop();
    if (tail !== undefined && FORK_I18N.test(tail)) return ForkI18nShim;
    return undefined;
}

/** حكمٌ على وحدةٍ واحدة تطلبها إضافةٌ خارجية. */
export interface CompatItem {
    specifier: string;
    /**
     * أسماءٌ تطلبها الإضافة من هذه الوحدة ولا تُصدّرها نسختنا.
     *
     * 🔴 هذا هو «النظيف كذباً»: الوحدة تُحلّ فيقول التقرير «سليمة»، ثمّ تسقط
     * الإضافة وقت التشغيل على `undefined.something`. لا يُصلَح — اختراع
     * قيمةٍ هنا يجعلها تعمل وتكذب — لكنّه **يُقال قبل التفعيل** بدل أن
     * يُكتشَف خطأً أحمر بعد إعادة تشغيلٍ كاملة.
     */
    missingNames?: string[];
    /**
     * `ok` تعمل · `blocked` مستحيلة في المُصيِّر (Node/إلكترون/العملية
     * الرئيسية) · `missing` اسمٌ لا نعرفه — غالباً وحدةٌ خاصّة بشوكة أخرى.
     */
    status: "ok" | "substituted" | "blocked" | "missing";
    reason?: string;
}

/**
 * تقرير التوافق **قبل التفعيل**.
 *
 * 🔴 لماذا هنا لا في العملية الرئيسية: الخريطة تسكن المُصيِّر، وهي وحدها من
 * تعرف ما نشحنه. فالعملية الرئيسية تُحصي الأسماء (فالشيفرة المُترجَمة عندها)،
 * وهذا الملفّ يحكم عليها. تقسيمٌ لا تكرار: مصدر الحقيقة واحد.
 *
 * والفائدة عمليّة: من يستورد إضافةً تطلب `fs` يرى ذلك في اللحظة، لا بعد
 * إعادة تشغيلٍ كاملة ينتهي بخطأٍ أحمر لا يدلّه على السبب.
 */
export function checkCompatibility(externals: string[], importedNames?: Record<string, string[]>): {
    ok: boolean;
    items: CompatItem[];
    blocked: number;
    missing: number;
    /** عدد الوحدات التي تُحلّ لكن ينقصها اسمٌ مطلوب. */
    incomplete: number;
} {
    /** أيّ الأسماء المطلوبة لا تُصدّرها الوحدة التي حُلّت؟ */
    const namesMissingFrom = (specifier: string, value: any): string[] => {
        const wanted = importedNames?.[specifier];
        if (wanted === undefined || wanted.length === 0 || value == null) return [];
        return wanted.filter(n => {
            // `default` له مسارٌ خاصّ: المُترجِم يقبل الوحدة كلّها بديلاً عنه.
            if (n === "default") return false;
            return !(n in value);
        });
    };

    const items: CompatItem[] = externals.map(specifier => {
        if (specifier.startsWith(".")) {
            // نسبيٌّ يخرج من المجلّد: إمّا نعرف بديله فنُعلنه، وإلّا فهو ناقص.
            return substituteEscapingImport(specifier) !== undefined
                ? {
                    specifier, status: "substituted" as const,
                    reason: "مُترجِم شوكةٍ أخرى — يُوضَع مكانه بديلٌ يُرجع النصّ الإنجليزي كما يفعل الأصل."
                }
                : {
                    specifier, status: "missing" as const,
                    reason: "ملفٌّ خارج مجلّد الإضافة، فلم يصل معها. انسخه داخل المجلّد ثمّ أعد الاستيراد."
                };
        }

        const r = resolveModule(specifier);
        if (r.ok) {
            const missingNames = namesMissingFrom(specifier, r.value);
            return missingNames.length === 0
                ? { specifier, status: "ok" as const }
                : { specifier, status: "ok" as const, missingNames };
        }

        // «مستحيلة» تُميَّز عن «مجهولة»: الأولى لا حلّ لها بتاتاً في المُصيِّر،
        // والثانية قد تُحلّ بإدراج الوحدة أو باستيراد الإضافة التي تُكمّلها.
        const impossible = /^(node:)?(fs|path|os|crypto|child_process|http|https|net|dns|dgram|events|util|stream|zlib|worker_threads)(\/|$)/.test(specifier)
            || specifier === "electron"
            || specifier.startsWith("@main/");

        return { specifier, status: impossible ? "blocked" as const : "missing" as const, reason: r.reason };
    });

    const blocked = items.filter(i => i.status === "blocked").length;
    const missing = items.filter(i => i.status === "missing").length;
    const incomplete = items.filter(i => (i.missingNames?.length ?? 0) > 0).length;
    // «مستبدَل» ليس عطلاً: الإضافة تعمل. يُعلَن ولا يُعَدّ فشلاً.
    // أمّا نقص الأسماء فعطلٌ مؤكَّد: الإضافة تسقط عند أوّل استعمال.
    return { ok: blocked === 0 && missing === 0 && incomplete === 0, items, blocked, missing, incomplete };
}

function runPlugin(bundle: { id: string; name: string; modules: { path: string; code: string; }[]; }) {
    /** ذاكرة الوحدات المُنفَّذة داخل الإضافة الواحدة. */
    const registry = new Map<string, any>();
    /** شيفرة كل وحدة بمسارها، لتُنفَّذ **عند طلبها** لا بترتيب القراءة. */
    const sources = new Map(bundle.modules.map(m => [m.path, m.code]));
    /** ما هو قيد التنفيذ الآن — لكشف الدور بدل الوقوع في تكرار لا ينتهي. */
    const running = new Set<string>();

    const normalise = (from: string, spec: string) => {
        if (!spec.startsWith(".")) return spec;
        const parts = from.split("/").slice(0, -1);
        for (const piece of spec.split("/")) {
            if (piece === "." || piece === "") continue;
            if (piece === "..") parts.pop();
            else parts.push(piece);
        }
        return parts.join("/");
    };

    /**
     * يجرّب لواحق الملفّات وصيغة المجلد.
     *
     * 🔴 من يكتب `../util/icons` لا يكتب اللاحقة، ومن يكتب `./components`
     * يقصد `components/index.js`. تثبيت `.js` وحدها كان يُفشل الثانية.
     */
    const candidates = (base: string) => base === ""
        // 🔴 `require(".")` من ملفٍّ في **جذر** الإضافة.
        //
        // `normalise("MemberCount.js", ".")` تُعيد نصّاً فارغاً، فكانت
        // المرشّحات `["", ".js", "/index.js"]` — ولا واحدة تُطابق `index.js`،
        // فتسقط الإضافة بـ«لا يوجد ملفّ لـ‹.›». وهي دلالة CommonJS المعروفة:
        // المجلد يعني `index` الذي فيه. ومن مجلدٍ فرعيّ كانت تعمل أصلاً.
        ? ["index.js"]
        : [base, `${base}.js`, `${base}/index.js`];

    /**
     * 🔴 التنفيذ **عند الطلب** لا بترتيب القراءة.
     *
     * كانت الوحدات تُنفَّذ مرتّبةً أبجدياً (`index.js` آخراً)، فوحدةٌ تستورد
     * أخرى تسبقها في الأبجدية تعمل، ومن تستورد ما يليها تفشل بـ«لا أعرف
     * الوحدة». مثالٌ حقيقيّ: `components/ChromeTab.js` يستورد `../util/icons`
     * و«c» قبل «u» ⇒ يعمل قبله فلا يجده. والترتيب الأبجدي ليس ترتيب اعتماد.
     *
     * الآن `require` يُنفّذ ما يُطلَب إن لم يكن مُنفَّذاً بعد، فيصحّ أي ترتيب.
     */
    const execute = (path: string): any => {
        if (registry.has(path)) return registry.get(path);

        const code = sources.get(path);
        if (code === undefined) return undefined;

        if (running.has(path)) {
            // دورٌ بين وحدتين: تُعاد الصادرات الجزئية كما يفعل CommonJS،
            // فالبرنامج يعمل بدل أن يعلّق.
            return registry.get(path) ?? {};
        }

        running.add(path);
        const exports: any = {};
        const module = { exports };
        // يُسجَّل **قبل** التنفيذ حتى يرى الدورُ كائناً لا فراغاً.
        registry.set(path, exports);

        try {
            // 🔴 `React` يُمرَّر صراحةً: JSX يُترجَم إلى `React.createElement`،
            // و`React` ليس متغيّراً عالمياً في حزمتنا. فبدونه تفشل **كل** إضافة
            // فيها JSX بـ«React is not defined». ويُمرَّر كسولاً لأنّ التحميل
            // يقع قبل أن يُقلع webpack عند ديسكورد.
            /**
             * 🔴 ثوابت البناء تُمرَّر وسائطَ.
             *
             * `IS_WEB` و`IS_DISCORD_DESKTOP` و`VERSION` وأخواتها يستبدلها
             * esbuild **وقت البناء** في حزمتنا. أمّا إضافة المجتمع فتُترجَم
             * بـsucrase وحدها، فتبقى معرّفاتٍ حرّة — و`new Function` لا تراها،
             * فتسقط بـ«IS_WEB is not defined» قبل أن تبدأ. والقيمة المُمرَّرة
             * هي قيمة العميل الذي تعمل فيه فعلاً، وهي بعينها ما كان بناء
             * صاحبها سيُعطيها.
             */
            const fn = new Function(
                "module", "exports", "require", "React",
                "IS_WEB", "IS_DEV", "IS_STANDALONE", "IS_UPDATER_DISABLED", "IS_REPORTER",
                "IS_DISCORD_DESKTOP", "IS_VESKTOP", "IS_EQUIBOP", "IS_EXTENSION", "IS_USERSCRIPT",
                "VERSION", "BUILD_TIMESTAMP",
                `"use strict";\n${code}\n//# sourceURL=esharq-community/${bundle.name}/${path}`
            );
            fn(
                module, exports, makeRequire(path), lazyReact,
                IS_WEB, IS_DEV, IS_STANDALONE, IS_UPDATER_DISABLED, IS_REPORTER,
                IS_DISCORD_DESKTOP, IS_VESKTOP, IS_EQUIBOP, IS_EXTENSION, IS_USERSCRIPT,
                VERSION, BUILD_TIMESTAMP
            );
        } finally {
            running.delete(path);
        }

        registry.set(path, module.exports);
        return module.exports;
    };

    const makeRequire = (from: string) => (spec: string) => {
        if (spec.startsWith(".")) {
            const base = normalise(from, spec);
            for (const candidate of candidates(base)) {
                if (sources.has(candidate)) return execute(candidate);
            }
            // 🔴 استيرادٌ **يخرج من مجلّد الإضافة**: شائعٌ في الشوكات، فملفّ
            // المُترجِم يسكن بجوار مجلّدات الإضافات لا داخل أحدها، ولا يصل مع
            // المجلّد المُستورَد. الإضافة سليمة وتسقط عند أوّل سطر بسببه.
            const substitute = substituteEscapingImport(spec);
            if (substitute !== undefined) return substitute;

            throw new Error(
                `[${bundle.name}] ${from}: لا يوجد ملفّ لـ«${spec}» داخل الإضافة. ` +
                `المُتاح: ${[...sources.keys()].join(" · ")}`
            );
        }

        const resolved = resolveModule(spec);
        if (!resolved.ok) {
            throw new Error(`[${bundle.name}] ${from}: ${resolved.reason}`);
        }
        return resolved.value;
    };

    // المدخل هو آخر ما رتّبه الجانب الأصليّ (`index.js` يُؤخَّر هناك).
    const entry = bundle.modules[bundle.modules.length - 1]?.path;
    return entry === undefined ? undefined : execute(entry);
}

/**
 * يُحمّل كل إضافات المجتمع المُفعَّلة ويضعها في `Plugins`.
 *
 * `plugins` تُمرَّر من `PluginManager` بدل استيرادها، فلا تدور الوحدتان حول
 * بعضهما (`~plugins` يستورد المدير، والمدير يستورد هذا).
 */
/**
 * فحص شكل التعريف **قبل** إدخاله في سجلّ الإضافات.
 *
 * ── لماذا هذا الفحص بالذات ────────────────────────────────────────────
 * 🔴 عزلُنا ينتهي عند `plugins[name] = definition`. وما بعده نواةٌ تقرأ
 * التعريف **بلا حماية**: `initPluginManager()` نداءٌ عارٍ في `Vencord.ts`،
 * وفيه `p.dependencies?.forEach(…)` و`(p[key] as Function).bind(p)` و
 * `Object.entries(p.settings.def)` و`for (const patch of p.patches)`.
 * فحقلٌ بشكلٍ خاطئ — `patches: {}` أو `start: "x"` — يرمي هناك، فلا يُنفَّذ
 * `initPluginManager` ولا `startAllPlugins` ولا `init`، ويُقلع العميل **بلا
 * إضافة واحدة**. و`userProfileBadges.forEach` بعد البدء تفعل الشيء نفسه
 * فتُجهض بقيّة الإضافات.
 *
 * وليست حالةَ خبثٍ فحسب: إضافةٌ **مشوّهة** تفعلها بالسهولة نفسها.
 *
 * فيُفحَص الشكل هنا — داخل الحماية القائمة لكلّ حزمة — فتُرفض الإضافة وحدها
 * برسالةٍ تُقرأ، ولا تصل النواةَ قيمةٌ لا تحتمل شكلها. ولا يُمَسّ سطرٌ في
 * نواة فينكورد، فلا يتغيّر سلوك إضافةٍ سليمة واحدة.
 */
function checkDefinitionShape(d: any): string | null {
    const arrays = ["dependencies", "patches", "authors", "userProfileBadges", "commands"];
    for (const key of arrays) {
        if (d[key] != null && !Array.isArray(d[key])) {
            return `الحقل «${key}» يجب أن يكون مصفوفة — وصل ${typeof d[key]}.`;
        }
    }

    // نفس قائمة `pluginKeysToBind` في مدير الإضافات، وتُربَط بـ`.bind` بلا فحص.
    const functions = [
        "start", "stop", "flux",
        "onBeforeMessageEdit", "onBeforeMessageSend", "onMessageClick",
        "renderMemberListDecorator", "renderMessageAccessory", "renderMessageDecoration",
        "renderNicknameIcon"
    ];
    for (const key of functions) {
        if (d[key] != null && typeof d[key] !== "function" && key !== "flux") {
            return `الحقل «${key}» يجب أن يكون دالّة — وصل ${typeof d[key]}.`;
        }
    }
    if (d.flux != null && typeof d.flux !== "object") {
        return `الحقل «flux» يجب أن يكون كائناً — وصل ${typeof d.flux}.`;
    }

    if (d.settings != null) {
        if (typeof d.settings !== "object" || d.settings.def == null || typeof d.settings.def !== "object") {
            return "الحقل «settings» يجب أن يأتي من `definePluginSettings` (كائنٌ فيه `def`).";
        }
    }

    if (d.contextMenus != null && typeof d.contextMenus !== "object") {
        return `الحقل «contextMenus» يجب أن يكون كائناً — وصل ${typeof d.contextMenus}.`;
    }

    // 🔴 `__proto__` اسماً: `Object.hasOwn` لا يراه، والإسناد يُبدّل نموذج
    // السجلّ بدل أن يُضيف مفتاحاً — فيمشي `for…in` على مفاتيح موروثة.
    if (d.name === "__proto__" || d.name === "constructor" || d.name === "prototype") {
        return `الاسم «${d.name}» محجوز ولا يصلح اسماً لإضافة.`;
    }

    return null;
}

export function loadCommunityPlugins(plugins: Record<string, any>) {
    const native = (window as any).VencordNative?.communityPlugins;
    if (native == null) return;

    let bundles: { id: string; name: string; hash: string; modules: { path: string; code: string; }[]; }[];
    try {
        bundles = native.getBundle() ?? [];
    } catch (e) {
        logger.error("تعذّرت قراءة حزمة إضافات المجتمع:", e);
        return;
    }
    if (bundles.length === 0) return;

    for (const bundle of bundles) {
        const record: LoadedCommunityPlugin = { id: bundle.id, name: bundle.name, hash: bundle.hash };
        loaded.push(record);

        try {
            const exported = runPlugin(bundle);
            const definition = exported?.default ?? exported;

            if (definition == null || typeof definition !== "object" || typeof definition.name !== "string") {
                throw new Error("الملفّ لا يُصدّر إضافة: المتوقَّع `export default definePlugin({ name, description, authors, ... })`.");
            }

            const shapeError = checkDefinitionShape(definition);
            if (shapeError !== null) throw new Error(shapeError);

            // 🔴 لا تدوس إضافةً قائمة: اسمٌ مكرّر يعني أن إضافة خارجية تحلّ محلّ
            // إضافة إشراق بلا أن يدري أحد. نُلحق لاحقةً ونقولها في السجلّ.
            let { name } = definition;
            if (Object.hasOwn(plugins, name)) {
                name = `${definition.name} (مجتمع)`;
                logger.warn(`الاسم «${definition.name}» مستعمل سلفاً — سُجّلت باسم «${name}».`);
            }

            definition.name = name;
            // تُدار من صفحة «إضافات المجتمع» وحدها، فلا تظهر في قائمة إضافات إشراق.
            definition.hidden = true;
            definition.required = false;
            (definition as any).isCommunityPlugin = true;
            (definition as any).communityId = bundle.id;

            plugins[name] = definition;

            // 🔴 **سجلّ البيانات لازم وإلّا انهارت صفحة الإضافات.**
            //
            // `PluginMeta` يُولَّد وقت البناء من مجلدات الإضافات، فلا مدخل فيه
            // لإضافة مستورَدة. وصفحة الإضافات تقرأ `PluginMeta[name].folderName`
            // **بلا حارس** في خمسة مواضع، فتنفجر على `undefined` — ومعها العميل
            // كلّه إلى شاشة «هذا محرج». وقع هذا حرفياً في التجربة الحيّة.
            //
            // واسم المجلد لا يبدأ بأيٍّ من بادئات المرشِّحات، فلا تدخل أي عدّاد
            // ولا أي تبويب في تلك الصفحة.
            (PluginMeta as Record<string, any>)[name] = {
                folderName: `community/${bundle.id}`,
                userPlugin: false
            };

            // 🔴 مصدر الحقيقة **بيان القرص** لا إعدادات ڤينكورد.
            //
            // `getBundle` لا تُرجع إلّا المُفعَّلة، فوجودها هنا يعني أن العضو
            // فعّلها من صفحة إضافات المجتمع. ومن دون هذا السطر يبقى
            // `Settings.plugins[name].enabled` على `false` الافتراضية، فتُسجَّل
            // الإضافة ولا تبدأ — تظهر «مُفعَّلة» في الصفحة وهي لا تعمل. وهو
            // العطب الذي وقع فعلاً في أوّل تجربة حيّة.
            definition.enabledByDefault = true;
            try {
                if (Settings.plugins[name]?.enabled !== true) Settings.plugins[name].enabled = true;
            } catch (e) {
                logger.warn(`تعذّر ضبط حالة «${name}»:`, e);
            }

            record.registeredAs = name;
            logger.info(`حُمّلت «${name}» (${bundle.id}).`);
        } catch (e: any) {
            // خطأ إضافة واحدة لا يُسقط البقيّة ولا العميل.
            record.error = String(e?.message ?? e);
            logger.error(`فشل تحميل «${bundle.name}»:`, e);
        }
    }
}
