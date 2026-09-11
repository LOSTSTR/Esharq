/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { FluxDispatcher, UserStore } from "@webpack/common";

import { captureNow, hasRealNitro } from "./capture";
import Panel from "./panel";
import { install, refresh, uninstall } from "./restore";
import { loadFor, mergeSave } from "./store";

const logger = new Logger("ProfileKeeper");

/** كم مرّة نلتقط تلقائياً ما دام الاشتراك قائماً. */
const AUTO_MS = 5 * 60 * 1000;

const settings = definePluginSettings({
    autoCapture: {
        type: OptionType.BOOLEAN,
        default: true,
        description: "Keep the snapshot fresh automatically while your subscription is active."
    },
    panel: {
        type: OptionType.COMPONENT,
        component: Panel
    }
});

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * معرّف الحساب الذي حُمِّلت لقطتُه. `""` يعني «لم يُحمَّل شيءٌ بعد».
 *
 * 🔴 كان مزلاجاً منطقياً (`ready`) يُرفَع مرّةً ولا ينزل. ومن بدّل حسابه داخل
 * العميل بقي على لقطة الحساب الأوّل: تُحقن لوحةُ حسابٍ في ملفّ حسابٍ آخر،
 * ولا يُستعاد شكل الثاني، **وتُكتب لقطتُه فوق لقطة الأوّل** بالالتقاط
 * التلقائيّ. فالمزلاج صار مقارنةَ هويّة: تبدّل المعرّف ⇒ يُعاد التحميل.
 */
let loadedFor = "";

/** هل أُوقفت الإضافة أثناء انتظارٍ غير متزامن؟ يمنع تسريب ما بعد الإيقاف. */
let running = false;

async function begin(): Promise<void> {
    const me = UserStore.getCurrentUser();
    if (!me || !running) return;
    if (loadedFor === me.id) return;

    // حسابٌ مختلف ⇒ ما حُقن للحساب السابق يُرفَع قبل تحميل لقطة الجديد.
    if (loadedFor !== "") uninstall();

    await loadFor(me.id);

    // 🔴 `start()` غير مُنتظَرة من مدير الإضافات، فقد تُوقَف الإضافة بينما
    // نقرأ من التخزين. بلا هذا الفحص يُركَّب اللافّ والمشتركون **بعد**
    // `stop()` فيبقون إلى الأبد بلا شيء يُزيلهم.
    if (!running) return;

    loadedFor = me.id;
    install();

    // التقاطةٌ أولى فوراً: من فتح العميل وهو مشترك يُحفظ شكله بلا أن يُطلب
    // منه شيء — وهو الفرق بين إضافةٍ تنفع وإضافةٍ تُكتشَف بعد فوات الأوان.
    void autoCapture();
}

async function autoCapture(): Promise<void> {
    if (!running || !settings.store.autoCapture) return;
    // 🔴 لا يُلتقط إلّا والاشتراك **حقيقيّ** قائم: الالتقاط بعد انتهائه يحفظ
    // الفراغ فوق المحفوظ، فيضيع الشكل في اللحظة التي وُجدت الإضافة لأجلها.
    if (!hasRealNitro()) return;

    try {
        const patch = captureNow();
        if (patch) {
            await mergeSave(patch);
            refresh();
        }
    } catch (e) {
        logger.error("تعذّر الالتقاط التلقائيّ", e);
    }
}

/**
 * 🔴 إعادة الاتّصال تُعيد بناء سجلّ المستخدم، فيزول ما كُتب فيه.
 *
 * ومن نام حاسوبه أو انقطعت شبكته كان يفقد اللوحة والإطار المستعادين فلا
 * يعودان إلّا بمصادفة `USER_UPDATE` لاحق. فإن كان الحساب هو نفسه يُعاد
 * التطبيق، وإن تبدّل يُعاد التحميل من أوّله.
 */
function onConnectionOpen() {
    const me = UserStore.getCurrentUser();
    if (me && me.id === loadedFor) refresh();
    else void begin();
}

export default definePlugin({
    name: "ProfileKeeper",
    description: "Keep your Nitro profile look after the subscription ends — banner, colours, avatar decoration, nameplate and profile effect are captured while you have them and shown back in your own client. Nothing is sent to Discord.",
    authors: [EquicordDevs.LOSTSTR],
    tags: ["Appearance", "Customisation", "Utility"],
    settings,

    async start() {
        running = true;
        // `CONNECTION_OPEN` يقع عند كلّ إعادة اتّصال وعند تبديل الحساب، فهو
        // ما يُعيد تركيب الاستعادة على السجلّ الجديد بعد نومٍ أو انقطاع شبكة.
        FluxDispatcher.subscribe("CONNECTION_OPEN", onConnectionOpen);
        await begin();
        timer = setInterval(() => void autoCapture(), AUTO_MS);
    },

    stop() {
        running = false;
        FluxDispatcher.unsubscribe("CONNECTION_OPEN", onConnectionOpen);
        if (timer) clearInterval(timer);
        timer = null;
        loadedFor = "";
        uninstall();
    }
});
