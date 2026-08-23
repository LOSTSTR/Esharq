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
/*
 * وحداتٌ مُولَّدة آلياً: **كلّ** ما نشحنه فعلاً في المُصيِّر.
 *
 * تُستثنى ٢٦ ملفّاً قِستُ أنّها تصل إلى Node أو إلكترون (ملفّات `native` وما
 * يشبهها). والقياس بالترجمة لا بالنصّ: محاولةٌ أولى تتبّعت استيراد الأنواع
 * فأسقطت ٩٦٦ وحدة سليمة — و`@main/themes` مثالها، فهي تُبنى في المُصيِّر بلا
 * مشكلة. وإدراج هذه الوحدات لا يزيد الحزمة بايتاً واحداً: قِستُ 10045 KB
 * قبلها وبعدها، لأنّها مشحونةٌ سلفاً عبر `~plugins`.
 */
/*
 * وحداتٌ مُولَّدة: كلّ ما نشحنه في المُصيِّر من `@api` و`@components` و`@utils`
 * و`@shared`، عدا ما قِستُ أنّه يصل إلى Node أو إلكترون.
 *
 * 🔴 القياس بالترجمة لا بالنصّ: محاولةٌ أولى تتبّعت استيراد **الأنواع** فحكمت
 * على 966 وحدة سليمة بالمنع — و`@main/themes` مثالها الفاضح، فهي تُبنى في
 * المُصيِّر بلا مشكلة لأنّ ملفّها خالٍ من Node. الصواب أن تُترجَم الشيفرة
 * أوّلاً (فتسقط الأنواع) ثمّ يُتتبَّع ما بقي.
 */
import * as C_api_AudioPlayer from "@api/AudioPlayer";
import * as C_api_Backpack from "@api/Backpack";
import * as Badges from "@api/Badges";
import * as ChatButtons from "@api/ChatButtons";
import * as Commands from "@api/Commands";
import * as C_api_Commands_commandHelpers from "@api/Commands/commandHelpers";
import * as C_api_Commands_types from "@api/Commands/types";
import * as C_api_CommunityPlugins from "@api/CommunityPlugins";
import * as C_api_CommunityPlugins_moduleMap from "@api/CommunityPlugins/moduleMap";
import * as ContextMenu from "@api/ContextMenu";
import * as DataStore from "@api/DataStore";
import * as C_api_GifPickerContextMenu from "@api/GifPickerContextMenu";
import * as C_api_HeaderBar from "@api/HeaderBar";
import * as Api from "@api/index";
import * as MemberListDecorators from "@api/MemberListDecorators";
import * as MessageAccessories from "@api/MessageAccessories";
import * as C_api_MessageDecorations from "@api/MessageDecorations";
import * as MessageEvents from "@api/MessageEvents";
import * as MessagePopover from "@api/MessagePopover";
import * as MessageUpdater from "@api/MessageUpdater";
import * as C_api_NicknameIcons from "@api/NicknameIcons";
import * as Notices from "@api/Notices";
import * as Notifications from "@api/Notifications";
import * as C_api_Notifications_NotificationComponent from "@api/Notifications/NotificationComponent";
import * as C_api_Notifications_notificationLog from "@api/Notifications/notificationLog";
import * as C_api_Notifications_Notifications from "@api/Notifications/Notifications";
import * as C_api_PluginManager from "@api/PluginManager";
import * as C_api_ProfileCollections from "@api/ProfileCollections";
import * as C_api_ProfileSections from "@api/ProfileSections";
import * as ServerList from "@api/ServerList";
import * as SettingsApi from "@api/Settings";
import * as C_api_SettingsSync_cloudSetup from "@api/SettingsSync/cloudSetup";
import * as C_api_SettingsSync_cloudSync from "@api/SettingsSync/cloudSync";
import * as C_api_SettingsSync_offline from "@api/SettingsSync/offline";
import * as C_api_SettingsSync_redact from "@api/SettingsSync/redact";
import * as C_api_SettingsSync_types from "@api/SettingsSync/types";
import * as Styles from "@api/Styles";
import * as C_api_SurfaceClasses from "@api/SurfaceClasses";
import * as C_api_Themes from "@api/Themes";
import * as C_api_UserArea from "@api/UserArea";
import * as C_api_UserSettingDefinitions from "@api/UserSettingDefinitions";
import * as UserSettings from "@api/UserSettings";
import * as C_components_Badge from "@components/Badge";
import * as C_components_BaseText from "@components/BaseText";
import * as C_components_Button from "@components/Button";
import * as C_components_Card from "@components/Card";
import * as C_components_CheckedTextInput from "@components/CheckedTextInput";
import * as C_components_CodeBlock from "@components/CodeBlock";
import * as C_components_Divider from "@components/Divider";
import * as C_components_ErrorBoundary from "@components/ErrorBoundary";
import * as C_components_ErrorCard from "@components/ErrorCard";
import * as C_components_ExpandableCard from "@components/ExpandableCard";
import * as C_components_Flex from "@components/Flex";
import * as C_components_FormSwitch from "@components/FormSwitch";
import * as C_components_Grid from "@components/Grid";
import * as C_components_handleComponentFailed from "@components/handleComponentFailed";
import * as C_components_Heading from "@components/Heading";
import * as C_components_Heart from "@components/Heart";
import * as C_components_Icons from "@components/Icons";
import * as Components from "@components/index";
import * as C_components_Link from "@components/Link";
import * as C_components_margins from "@components/margins";
import * as C_components_Notice from "@components/Notice";
import * as C_components_Paragraph from "@components/Paragraph";
import * as C_components_settings from "@components/settings";
import * as C_components_settings_tabs_BaseTab from "@components/settings/tabs/BaseTab";
import * as C_components_settings_tabs_plugins_components_Common from "@components/settings/tabs/plugins/components/Common";
import * as C_components_settings_tabs_plugins_PluginCard from "@components/settings/tabs/plugins/PluginCard";
import * as C_components_settings_tabs_plugins_PluginModal from "@components/settings/tabs/plugins/PluginModal";
import * as C_components_Span from "@components/Span";
import * as C_components_Switch from "@components/Switch";
import * as C_components_TooltipContainer from "@components/TooltipContainer";
import * as C_components_TooltipFallback from "@components/TooltipFallback";
import * as C_equicordplugins__core_concatenatedModules from "@equicordplugins/_core/concatenatedModules";
import * as C_plugins__core_settings from "@plugins/_core/settings";
import * as C_shared_debounce from "@shared/debounce";
import * as C_shared_IpcEvents from "@shared/IpcEvents";
import * as C_shared_onceDefined from "@shared/onceDefined";
import * as C_shared_SettingsStore from "@shared/SettingsStore";
import * as C_shared_vencordUserAgent from "@shared/vencordUserAgent";
import * as Npm_streamparserJson from "@streamparser/json";
import * as C_utils_apng from "@utils/apng";
import * as C_utils_ChangeList from "@utils/ChangeList";
// ─── نهاية المُولَّد ───
// وحداتٌ قِستُها مطلوبةً في إضافات الشوكات الأخرى، وهي عندنا:
// صفحات الإعدادات الثلاث المُستثناة أعلاه استثناءً عاماً، والوحدات
// الافتراضية التي يحقنها بناؤنا (`external` في scripts/build/common.mjs).
// قِست 107 استعمالات من 114 في شوكةٍ حقيقية تشير إلى ملفّاتٍ نشحنها نحن
// أصلاً، وكانت تفشل لأنّها غير مُدرَجة وحسب. وهي في الحزمة سلفاً عبر
// `~plugins`، فإدراجها لا يُضيف حجماً.
import * as Clipboard from "@utils/clipboard";
import * as Constants from "@utils/constants";
import * as C_utils_cspViolations from "@utils/cspViolations";
import * as Css from "@utils/css";
import * as C_utils_dependencies from "@utils/dependencies";
import * as DiscordUtils from "@utils/discord";
import * as C_utils_esharqAI from "@utils/esharqAI";
import * as C_utils_esharqBanWarning from "@utils/esharqBanWarning";
import * as C_utils_esharqFont from "@utils/esharqFont";
import * as C_utils_esharqFontData from "@utils/esharqFontData";
import * as C_utils_esharqFontsData from "@utils/esharqFontsData";
import * as EsharqI18n from "@utils/esharqI18n";
import * as C_utils_esharqLocale from "@utils/esharqLocale";
import * as C_utils_esharqModals from "@utils/esharqModals";
import * as C_utils_esharqPrefs from "@utils/esharqPrefs";
import * as ForkI18nShim from "@utils/forkI18nShim";
import * as C_utils_gregorianCalendar from "@utils/gregorianCalendar";
import * as Guards from "@utils/guards";
import * as C_utils_i18n from "@utils/i18n";
import * as C_utils_i18n_types from "@utils/i18n/types";
import * as Utils from "@utils/index";
import * as C_utils_intlHash from "@utils/intlHash";
import * as Lazy from "@utils/lazy";
import * as C_utils_lazyReact from "@utils/lazyReact";
import * as C_utils_localStorage from "@utils/localStorage";
import * as LoggerModule from "@utils/Logger";
import * as Margins from "@utils/margins";
import * as C_utils_mergeDefaults from "@utils/mergeDefaults";
import * as Misc from "@utils/misc";
import * as ModalUtils from "@utils/modal";
import * as C_utils_native from "@utils/native";
import * as C_utils_onlyOnce from "@utils/onlyOnce";
import * as C_utils_patches from "@utils/patches";
import * as C_utils_Queue from "@utils/Queue";
import * as ReactUtils from "@utils/react";
import * as C_utils_sha256 from "@utils/sha256";
import * as Text from "@utils/text";
import * as C_utils_TTLMap from "@utils/TTLMap";
import * as Types from "@utils/types";
import * as C_utils_updater from "@utils/updater";
import * as C_utils_web from "@utils/web";
import * as C_utils_web_metadata from "@utils/web-metadata";
import * as Webpack from "@webpack";
import * as WebpackCommon from "@webpack/common";
import * as C_webpack_common_components from "@webpack/common/components";
import * as C_webpack_common_utils from "@webpack/common/utils";
import * as Npm_fflate from "fflate";
import * as Npm_gifenc from "gifenc";
import * as Npm_gifuctJs from "gifuct-js";
import * as Npm_idb from "idb";
import * as Npm_nativeFileSystemAdapter from "native-file-system-adapter";
import * as Npm_virtualMerge from "virtual-merge";

import * as C_git_hash from "~git-hash";
import * as C_git_remote from "~git-remote";
import * as C_plugins from "~plugins";

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
/**
 * جدول مطوّري شوكةٍ أخرى — يُصطنَع عند الطلب.
 *
 * 🔴 أكبر عطلٍ في إضافات المجتمع، وأخبثه: `import { TestcordDevs } from
 * "@utils/constants"` — والوحدة **موجودة عندنا**، فيقول تقرير التوافق
 * «سليمة»، ثمّ تسقط الإضافة وقت التشغيل لأنّ الاسم ليس فيها:
 * `_constants.TestcordDevs.x2b` ⇒ «Cannot read properties of undefined».
 * قِيس على ٥١٥ مجلداً حقيقياً: **٢٢٣ منها** تسقط هكذا، والتقرير صامت.
 *
 * والمفتاح في تلك الجداول **هو اسم صاحبه** (`x2b: { name: "x2b", id: … }`)،
 * فإرجاع `{ name: المفتاح }` يُبقي النسبة صادقةً لا مُخترَعة. و`id: 0n`
 * يجعل `PluginModal` يعرضه اسماً بلا حساب — وهو ما يفعله بأي مؤلّفٍ لا
 * يعرف معرّفه.
 *
 * وهذا **الموضع الوحيد** في المُحلِّل الذي يُنشئ قيمةً بدل أن يُرجع قائمة،
 * فيُعلَن في التقرير كما يُعلَن البديل، ولا يقع صامتاً.
 */
const unknownDevsTable = () => new Proxy({}, {
    get: (_t, handle) => typeof handle === "string" ? { name: handle, id: 0n } : undefined,
    has: () => true
});

/**
 * `@utils/constants` كما تراه إضافة المجتمع: ثوابتنا كما هي، ويُضاف إليها
 * جدولُ مطوّرين مُصطنَع لأي اسمٍ ينتهي بـ`Devs` لا نعرفه.
 *
 * 🔴 يُنسَخ بالانتشار لا يُغلَّف مباشرةً: `Proxy` على فضاء أسماء وحدة يكسر
 * ثوابت اللغة (فضاء الأسماء غير قابل للتوسيع)، والنسخ آمنٌ هنا لأن
 * `src/utils/constants.ts` **بلا واردات** فلا جالبَ كسولاً يُستدعى قبل أوانه.
 */
function constantsForCommunity(): any {
    const own = { ...Constants } as Record<string, any>;
    // 🔴 `has` يُطابق `get`: فاحص الأسماء يسأل بـ`in`، فلو لم يُطابقه لأنذر
    // بأنّ `TestcordDevs` مفقودة وهي تعمل — إنذارٌ كاذب يُفقد التقرير قيمته.
    const synthesised = (key: PropertyKey) => typeof key === "string" && /Devs$/.test(key);
    return new Proxy(own, {
        get(target, key) {
            if (Reflect.has(target, key)) return Reflect.get(target, key);
            return synthesised(key) ? unknownDevsTable() : undefined;
        },
        has(target, key) {
            return Reflect.has(target, key) || synthesised(key);
        }
    });
}

function buildMap(): Record<string, any> {
    const map: Record<string, any> = {
        "@utils/types": Types,
        "@utils/constants": constantsForCommunity(),

        /**
         * مُترجِمات الشوكات الأخرى — **بالشِيم لا بمُترجِمنا**.
         *
         * 🔴 كان `FORK_ALIASES` يوجّهها إلى `@utils/esharqI18n`، وعقدُها
         * `t(ar, en)`: خارج الوضع العربي تُرجع `en` — أي **`undefined`** حين
         * تُستدعى بوسيطٍ واحد كما تفعل تلك الإضافات. فتُعرَض نصوصٌ فارغة بدل
         * الإنجليزية. والشِيم موجودٌ ويفعل الصواب، لكنّه لم يكن في الخريطة
         * فلا يصله إلّا الوارد النسبيّ. (التحذير مكتوبٌ في رأس الشِيم نفسه.)
         */
        "@utils/forkI18nShim": ForkI18nShim,
        "@api/pluginI18n": ForkI18nShim,

        /**
         * وحداتٌ لها **توأمٌ موجود عندنا**، وكانت تُعَدّ مجهولة.
         * ولا تُكلّف بايتاً: كلّها في حزمة المُصيِّر أصلاً.
         */
        "@plugins/_core/settings": C_plugins__core_settings,
        "@plugins/_core/concatenatedModules": C_equicordplugins__core_concatenatedModules,
        "@webpack/common/components": C_webpack_common_components,
        "@webpack/common/utils": C_webpack_common_utils,

        /** حزم npm نشحنها فعلاً — أُضيفت بلا كلفة (مقيسة واحدةً واحدة). */
        "fflate": Npm_fflate,
        "gifenc": Npm_gifenc,
        "gifuct-js": Npm_gifuctJs,
        "idb": Npm_idb,
        "native-file-system-adapter": Npm_nativeFileSystemAdapter,
        "@streamparser/json": Npm_streamparserJson,
        "virtual-merge": Npm_virtualMerge,
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

        // حزمة أنواعٍ محضة: لا شيء منها يبقى بعد الترجمة، والفراغ هو الصواب —
        // كما `@vencord/discord-types` نفسها أعلاه.
        "@vencord/discord-types/webpack": {},

        "@api/AudioPlayer": C_api_AudioPlayer,
        "@api/Backpack": C_api_Backpack,
        "@api/Commands/commandHelpers": C_api_Commands_commandHelpers,
        "@api/Commands/types": C_api_Commands_types,
        "@api/CommunityPlugins": C_api_CommunityPlugins,
        "@api/CommunityPlugins/moduleMap": C_api_CommunityPlugins_moduleMap,
        "@api/GifPickerContextMenu": C_api_GifPickerContextMenu,
        "@api/HeaderBar": C_api_HeaderBar,
        "@api/MessageDecorations": C_api_MessageDecorations,
        "@api/NicknameIcons": C_api_NicknameIcons,
        "@api/Notifications/NotificationComponent": C_api_Notifications_NotificationComponent,
        "@api/Notifications/Notifications": C_api_Notifications_Notifications,
        "@api/Notifications/notificationLog": C_api_Notifications_notificationLog,
        "@api/PluginManager": C_api_PluginManager,
        "@api/ProfileCollections": C_api_ProfileCollections,
        "@api/ProfileSections": C_api_ProfileSections,
        "@api/SettingsSync/cloudSetup": C_api_SettingsSync_cloudSetup,
        "@api/SettingsSync/cloudSync": C_api_SettingsSync_cloudSync,
        "@api/SettingsSync/offline": C_api_SettingsSync_offline,
        "@api/SettingsSync/redact": C_api_SettingsSync_redact,
        "@api/SettingsSync/types": C_api_SettingsSync_types,
        "@api/SurfaceClasses": C_api_SurfaceClasses,
        "@api/Themes": C_api_Themes,
        "@api/UserArea": C_api_UserArea,
        "@api/UserSettingDefinitions": C_api_UserSettingDefinitions,
        "@components/Badge": C_components_Badge,
        "@components/BaseText": C_components_BaseText,
        "@components/Button": C_components_Button,
        "@components/Card": C_components_Card,
        "@components/CheckedTextInput": C_components_CheckedTextInput,
        "@components/CodeBlock": C_components_CodeBlock,
        "@components/Divider": C_components_Divider,
        "@components/ErrorBoundary": C_components_ErrorBoundary,
        "@components/ErrorCard": C_components_ErrorCard,
        "@components/ExpandableCard": C_components_ExpandableCard,
        "@components/Flex": C_components_Flex,
        "@components/FormSwitch": C_components_FormSwitch,
        "@components/Grid": C_components_Grid,
        "@components/Heading": C_components_Heading,
        "@components/Heart": C_components_Heart,
        "@components/Icons": C_components_Icons,
        "@components/Link": C_components_Link,
        "@components/Notice": C_components_Notice,
        "@components/Paragraph": C_components_Paragraph,
        "@components/Span": C_components_Span,
        "@components/Switch": C_components_Switch,
        "@components/TooltipContainer": C_components_TooltipContainer,
        "@components/TooltipFallback": C_components_TooltipFallback,
        "@components/handleComponentFailed": C_components_handleComponentFailed,
        "@components/margins": C_components_margins,
        "@components/settings": C_components_settings,
        "@components/settings/tabs/BaseTab": C_components_settings_tabs_BaseTab,
        "@components/settings/tabs/plugins/PluginCard": C_components_settings_tabs_plugins_PluginCard,
        "@components/settings/tabs/plugins/PluginModal": C_components_settings_tabs_plugins_PluginModal,
        "@components/settings/tabs/plugins/components/Common": C_components_settings_tabs_plugins_components_Common,
        "@shared/IpcEvents": C_shared_IpcEvents,
        "@shared/SettingsStore": C_shared_SettingsStore,
        "@shared/debounce": C_shared_debounce,
        "@shared/onceDefined": C_shared_onceDefined,
        "@shared/vencordUserAgent": C_shared_vencordUserAgent,
        "@utils/ChangeList": C_utils_ChangeList,
        "@utils/Queue": C_utils_Queue,
        "@utils/TTLMap": C_utils_TTLMap,
        "@utils/apng": C_utils_apng,
        "@utils/cspViolations": C_utils_cspViolations,
        "@utils/dependencies": C_utils_dependencies,
        "@utils/esharqAI": C_utils_esharqAI,
        "@utils/esharqBanWarning": C_utils_esharqBanWarning,
        "@utils/esharqFont": C_utils_esharqFont,
        "@utils/esharqFontData": C_utils_esharqFontData,
        "@utils/esharqFontsData": C_utils_esharqFontsData,
        "@utils/esharqLocale": C_utils_esharqLocale,
        "@utils/esharqModals": C_utils_esharqModals,
        "@utils/esharqPrefs": C_utils_esharqPrefs,
        "@utils/gregorianCalendar": C_utils_gregorianCalendar,
        "@utils/i18n": C_utils_i18n,
        "@utils/i18n/types": C_utils_i18n_types,
        "@utils/intlHash": C_utils_intlHash,
        "@utils/lazyReact": C_utils_lazyReact,
        "@utils/localStorage": C_utils_localStorage,
        "@utils/mergeDefaults": C_utils_mergeDefaults,
        "@utils/native": C_utils_native,
        "@utils/onlyOnce": C_utils_onlyOnce,
        "@utils/patches": C_utils_patches,
        "@utils/sha256": C_utils_sha256,
        "@utils/updater": C_utils_updater,
        "@utils/web": C_utils_web,
        "@utils/web-metadata": C_utils_web_metadata,
        "~git-hash": C_git_hash,
        "~git-remote": C_git_remote,
        "~plugins": C_plugins,

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

/**
 * جدول مسارات الشوكات الأخرى ⇒ ما يقابلها عندنا.
 *
 * 🔴 يبقى صغيراً عن قصد: أدخلتُ فيه ما **قِسته** مطلوباً في شيفرة حقيقية، لا
 * ما قد يُطلَب. وكلّ مدخل يُتحقَّق أنّ هدفه موجودٌ في الخريطة قبل استعماله،
 * فمدخلٌ بائد يسقط بنفسه بدل أن يُنتج وحدةً فارغة صامتة.
 */
const FORK_ALIASES: [RegExp, string][] = [
    // 🔴 إلى الشِيم لا إلى مُترجِمنا: `esharqI18n.t(ar, en)` تُرجع `en` خارج
    // الوضع العربي، فوسيطٌ واحد ⇒ `undefined` ⇒ نصوصٌ فارغة في الإضافة.
    [/^@utils\/(testcord|nightcord|trashcord)I18n$/, "@utils/forkI18nShim"],
    [/^@api\/(plugin)?[Ii]18n$/, "@utils/forkI18nShim"],
    [/^@streamparser\/json\/.+$/, "@streamparser/json"],
    [/^@vencordplugins\//, "@plugins/"],
    [/^@vencord\/discord-types\/.+$/, "@vencord/discord-types"]
];

/**
 * صيغٌ مختلفة لاسم الوحدة الواحدة.
 *
 * 🔴 `/index` ليست تفصيلاً: الخريطة تُولَّد بحذفها (فـ`x/index.ts` يصير `x`)،
 * ومن يكتب `@equicordplugins/messageLoggerEnhanced/index` صراحةً كان يفشل رغم
 * أنّ الملفّ عندنا. قِستُ ذلك في شوكةٍ حقيقية: خمسة استعمالات تفشل بلا سبب
 * حقيقيّ. واللاحقة كذلك: `@utils/misc.js` هي `@utils/misc`.
 */
function* variants(specifier: string) {
    const noExt = specifier.replace(/\.(jsx?|tsx?)$/, "");
    yield noExt;
    if (noExt.endsWith("/index")) yield noExt.slice(0, -6);
    else yield `${noExt}/index`;

    for (const [pattern, to] of FORK_ALIASES) {
        if (pattern.test(noExt)) yield noExt.replace(pattern, to);
    }
}

/** أقرب أسماء الخريطة إلى ما طُلب — ليُصلح المستخدم السطر بنفسه. */
function nearest(specifier: string, map: Record<string, any>) {
    const tail = specifier.split("/").pop()!.toLowerCase();
    if (tail.length < 3) return [];
    return Object.keys(map).filter(k => k.toLowerCase().endsWith(`/${tail}`)).slice(0, 3);
}

export function resolveModule(specifier: string): { ok: true; value: any; } | { ok: false; reason: string; } {
    cache ??= buildMap();

    for (const candidate of variants(specifier)) {
        if (Object.hasOwn(cache, candidate)) return { ok: true, value: cache[candidate] };
    }

    const clean = specifier.replace(/\.(jsx?|tsx?)$/, "");

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

    if (clean.startsWith("@main/")) {
        return {
            ok: false,
            reason: `«${specifier}» من العملية الرئيسية، والإضافة تعمل في المُصيِّر. لا جسر بينهما إلّا ملفّ \`native.ts\` — وإضافات المجتمع لا تملك واحداً عمداً.`
        };
    }

    // 🔴 الرسالة القديمة كانت تعِد بـ«@utils/* · @api/* · @components/*» —
    // والمُحلِّل يُطابق **الاسم كاملاً** لا النمط. فمن قرأها ظنّ العطل في
    // إضافته لا في اسمٍ غير مُدرَج. الآن نقول المُتاح عدداً، ونقترح الأقرب.
    const close = nearest(clean, cache);
    return {
        ok: false,
        reason: `لا أعرف الوحدة «${specifier}». إشراق يُتيح ${Object.keys(cache).length} وحدة`
            + (close.length ? `. هل تقصد: ${close.join(" · ")}؟` : "، وهذه ليست منها.")
    };
}

/** لأجل الواجهة: ما الذي تستطيع إضافة المجتمع استيراده؟ */
export function knownSpecifiers(): string[] {
    cache ??= buildMap();
    return Object.keys(cache).sort();
}
