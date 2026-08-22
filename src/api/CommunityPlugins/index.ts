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
import { Logger } from "@utils/Logger";
import * as WebpackCommon from "@webpack/common";

import { PluginMeta } from "~plugins";

import { resolveModule } from "./moduleMap";

const logger = new Logger("CommunityPlugins", "#22c9f0");

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
/** حكمٌ على وحدةٍ واحدة تطلبها إضافةٌ خارجية. */
export interface CompatItem {
    specifier: string;
    /**
     * `ok` تعمل · `blocked` مستحيلة في المُصيِّر (Node/إلكترون/العملية
     * الرئيسية) · `missing` اسمٌ لا نعرفه — غالباً وحدةٌ خاصّة بشوكة أخرى.
     */
    status: "ok" | "blocked" | "missing";
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
export function checkCompatibility(externals: string[]): {
    ok: boolean;
    items: CompatItem[];
    blocked: number;
    missing: number;
} {
    const items: CompatItem[] = externals.map(specifier => {
        const r = resolveModule(specifier);
        if (r.ok) return { specifier, status: "ok" as const };

        // «مستحيلة» تُميَّز عن «مجهولة»: الأولى لا حلّ لها بتاتاً في المُصيِّر،
        // والثانية قد تُحلّ بإدراج الوحدة أو باستيراد الإضافة التي تُكمّلها.
        const impossible = /^(node:)?(fs|path|os|crypto|child_process|http|https|net|dns|dgram|events|util|stream|zlib|worker_threads)(\/|$)/.test(specifier)
            || specifier === "electron"
            || specifier.startsWith("@main/");

        return { specifier, status: impossible ? "blocked" as const : "missing" as const, reason: r.reason };
    });

    const blocked = items.filter(i => i.status === "blocked").length;
    const missing = items.filter(i => i.status === "missing").length;
    return { ok: blocked === 0 && missing === 0, items, blocked, missing };
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
    const candidates = (base: string) => [base, `${base}.js`, `${base}/index.js`];

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
            const fn = new Function(
                "module", "exports", "require", "React",
                `"use strict";\n${code}\n//# sourceURL=esharq-community/${bundle.name}/${path}`
            );
            fn(module, exports, makeRequire(path), lazyReact);
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
