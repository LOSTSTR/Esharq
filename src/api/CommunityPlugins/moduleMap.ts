/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * **جسر الوحدات لإضافات المجتمع.**
 *
 * إضافة إشراق تُكتب هكذا: `import definePlugin from "@utils/types"`. وهذه
 * المُعرّفات يحلّها **مُجمِّع البناء**، فلا وجود لها وقت التشغيل. وإضافة
 * المجتمع لا تمرّ بالمُجمِّع، فتحتاج من يُجيب `require("@utils/types")` حيّاً.
 *
 * هذا الملفّ هو المُجيب. والمُعرّفات المُدرجة هنا **قِيست** من إضافاتنا
 * الحقيقية لا خُمّنت: أُحصيت 5,556 عبارة استيراد في 900 ملفّ، والمُدرَج أدناه
 * يغطّي الغالبية الساحقة منها.
 *
 * 🔴 **ما ليس هنا يفشل برسالة تقول اسمه** — لا بخطأ غامض. ومن استورد `fs` أو
 * `child_process` فسيُقال له إنها غير موجودة في المُصيِّر: ليس منعاً منّا، بل
 * لأن صفحة ديسكورد بلا Node أصلاً (`contextIsolation`). القرار قراره، والحدّ
 * حدُّ المنصّة.
 */

import * as Badges from "@api/Badges";
import * as ChatButtons from "@api/ChatButtons";
import * as Commands from "@api/Commands";
import * as ContextMenu from "@api/ContextMenu";
import * as DataStore from "@api/DataStore";
import * as Api from "@api/index";
import * as MemberListDecorators from "@api/MemberListDecorators";
import * as MessageAccessories from "@api/MessageAccessories";
import * as MessageEvents from "@api/MessageEvents";
import * as MessagePopover from "@api/MessagePopover";
import * as MessageUpdater from "@api/MessageUpdater";
import * as Notices from "@api/Notices";
import * as Notifications from "@api/Notifications";
import * as ServerList from "@api/ServerList";
import * as SettingsApi from "@api/Settings";
import * as Styles from "@api/Styles";
import * as UserSettings from "@api/UserSettings";
import * as Components from "@components/index";
import * as Clipboard from "@utils/clipboard";
import * as Constants from "@utils/constants";
import * as Css from "@utils/css";
import * as DiscordUtils from "@utils/discord";
import * as EsharqI18n from "@utils/esharqI18n";
import * as Guards from "@utils/guards";
import * as Utils from "@utils/index";
import * as Lazy from "@utils/lazy";
import * as LoggerModule from "@utils/Logger";
import * as Margins from "@utils/margins";
import * as Misc from "@utils/misc";
import * as ModalUtils from "@utils/modal";
import * as ReactUtils from "@utils/react";
import * as Text from "@utils/text";
import * as Types from "@utils/types";
import * as Webpack from "@webpack";
import * as WebpackCommon from "@webpack/common";

/**
 * 🔴 يُلبِس كائنَ نطاق ESM ثوبَ وحدةِ CommonJS.
 *
 * المُحوِّل يكتب `_interopRequireDefault(m)`، وهي تُعيد `m` إن كان
 * `m.__esModule` صادقاً، وإلّا لفّته في `{ default: m }`. وكائن نطاق ESM
 * **لا يحمل `__esModule`** — فيُلَفّ، فيصير `m.default` هو النطاق كلّه، فيفشل
 * `definePlugin` بـ«default.call is not a function».
 *
 * وقع هذا فعلاً في أوّل تجربة حيّة. والوسيط هنا يُضيف العلَم **بلا نسخ**:
 * والنسخ (`{ ...ns }`) كان سيُقيّم الجالبات الكسولة في `@webpack/common`
 * **لحظة بناء الخريطة** — أي قبل أن يُقلع webpack عند ديسكورد أصلاً.
 */
function lazyNamespace(get: () => any) {
    return new Proxy({} as any, {
        get: (_t, key) => (key === "__esModule" ? true : get()?.[key]),
        has: (_t, key) => key === "__esModule" || key in (get() ?? {})
    });
}

function asCjsModule(ns: any) {
    return new Proxy(ns, {
        get: (target, key) => (key === "__esModule" ? true : Reflect.get(target, key)),
        has: (target, key) => key === "__esModule" || Reflect.has(target, key)
    });
}

/**
 * الوحدات التي يستطيع مُعرّفٌ أن يحلّ إليها.
 *
 * `react` و`react-dom` يأتيان من ديسكورد نفسه لا من حزمتنا — وإلّا لكان في
 * الصفحة نسختان من React، وهو عطبٌ يظهر بأخطاء خطّافات غامضة.
 */
function buildMap(): Record<string, any> {
    const map: Record<string, any> = {
        "@utils/types": Types,
        "@utils/constants": Constants,
        "@utils/esharqI18n": EsharqI18n,
        "@utils/css": Css,
        "@utils/Logger": LoggerModule,
        "@utils/discord": DiscordUtils,
        "@utils/misc": Misc,
        "@utils/react": ReactUtils,
        "@utils/margins": Margins,
        "@utils/text": Text,
        "@utils/clipboard": Clipboard,
        "@utils/modal": ModalUtils,
        "@utils/lazy": Lazy,
        "@utils/guards": Guards,
        "@utils/index": Utils,
        "@utils": Utils,

        "@api/Settings": SettingsApi,
        "@api/DataStore": DataStore,
        "@api/ContextMenu": ContextMenu,
        "@api/Commands": Commands,
        "@api/Notifications": Notifications,
        "@api/Notices": Notices,
        "@api/Styles": Styles,
        "@api/MessageEvents": MessageEvents,
        "@api/MessagePopover": MessagePopover,
        "@api/MessageUpdater": MessageUpdater,
        "@api/MessageAccessories": MessageAccessories,
        "@api/MemberListDecorators": MemberListDecorators,
        "@api/ChatButtons": ChatButtons,
        "@api/ServerList": ServerList,
        "@api/UserSettings": UserSettings,
        "@api/Badges": Badges,
        "@api/index": Api,
        "@api": Api,

        "@components/index": Components,
        "@components": Components,

        "@webpack": Webpack,
        "@webpack/common": WebpackCommon,

        // أنواع محضة: تُمحى عند التحويل، فلا يبقى منها شيء يُطلَب. ونُبقيها
        // كائناً فارغاً كي لا ينفجر من استوردها قيمةً بالخطأ.
        "@vencord/discord-types": {},
        "@vencord/discord-types/enums": {},

        // 🔴 كسولان: تُقرأ خصائصهما عند الاستعمال لا عند بناء الخريطة. الخريطة
        // تُبنى قبل أن يُقلع webpack عند ديسكورد، فقراءة `React` حينها تُعطي
        // `undefined` يُثبَّت في الخريطة إلى الأبد.
        react: lazyNamespace(() => WebpackCommon.React),
        "react-dom": lazyNamespace(() => (WebpackCommon as any).ReactDOM)
    };

    // كل مكوّن مُصدَّر يُتاح أيضاً بمساره المفرد (`@components/Button` …)،
    // فلا نكتب ستّين سطراً يدوياً ولا ننسى واحداً حين يُضاف مكوّن جديد.
    for (const [name, value] of Object.entries(Components)) {
        map[`@components/${name}`] ??= { [name]: value, default: value };
    }

    for (const key of Object.keys(map)) {
        const value = map[key];
        if (value != null && typeof value === "object" && value.__esModule !== true) {
            map[key] = asCjsModule(value);
        }
    }

    return map;
}

let cache: Record<string, any> | null = null;

export function resolveModule(specifier: string): { ok: true; value: any; } | { ok: false; reason: string; } {
    cache ??= buildMap();

    const clean = specifier.replace(/\.js$/, "");
    if (Object.hasOwn(cache, clean)) return { ok: true, value: cache[clean] };

    // مُعرّف عقدة معروف: نقول السبب الحقيقي بدل «غير موجود».
    if (/^(node:)?(fs|path|os|crypto|child_process|http|https|net|dns|dgram|events|util|stream|zlib|worker_threads)(\/|$)/.test(clean)) {
        return {
            ok: false,
            reason: `الوحدة «${specifier}» من Node، وصفحة ديسكورد تعمل بلا Node (contextIsolation). لا يمكن لأي إضافة في المُصيِّر أن تصل إليها — ولا لإضافات إشراق نفسها.`
        };
    }

    if (clean === "electron") {
        return { ok: false, reason: "«electron» غير متاحة في المُصيِّر — الواجهة المكشوفة هي `VencordNative` وحدها." };
    }

    return {
        ok: false,
        reason: `لا أعرف الوحدة «${specifier}». المتاح: @utils/* · @api/* · @components/* · @webpack · @webpack/common · react.`
    };
}

/** لأجل الواجهة: ما الذي تستطيع إضافة المجتمع استيراده؟ */
export function knownSpecifiers(): string[] {
    cache ??= buildMap();
    return Object.keys(cache).sort();
}
