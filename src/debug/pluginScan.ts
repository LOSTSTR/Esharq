/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * **جرد ما تلمسه كل إضافة** — مسحةٌ متزامنة واحدة تقرأ حقولاً موجودة أصلاً.
 *
 * بلا حلقات ولا مستمعين ولا تخصيصٍ يبقى. وتكلفتها صفر ما لم تُنادَ.
 *
 * 🔴 **ولا شيء هنا في نطاق الوحدة.** كل قراءة داخل دالّة تُنادى عند الطلب —
 * لأن ما يُنفَّذ في نطاق وحدةٍ داخل حزمة المُصيِّر يقع **قبل إقلاع webpack**،
 * وخطأ هناك يمنع إشراق من التحميل كلّه لا يكسر ميزةً وحدها.
 *
 * أصله ماسحٌ في أداة تشخيص قديمة حُذفت حين قُسّمت وظائفها على صفحات الإعدادات
 * الجديدة؛ استُعيد هنا وأُضيفت إليه **صلاحية الجسر الأصليّ** التي لم تكن فيه.
 */

import { isPluginEnabled } from "@api/PluginManager";
import { patches as pendingPatchList } from "@webpack/patcher";

import Plugins from "~plugins";

/**
 * `continuous` تعمل في الخلفية طول الجلسة (رقع · أحداث · أسطح تُرسَم دائماً).
 * `ondemand` لا تفعل شيئاً حتى يتصرّف المستخدم (أوامر · قوائم سياق · أزرار).
 */
export type PluginType = "continuous" | "ondemand";

export interface PluginScan {
    name: string;
    /** رقع على شيفرة ديسكورد. */
    patches: number;
    /** رقع لم تُطابق وحدتها بعد. */
    pendingPatches: number;
    /** أحداث Flux + مستمعو الرسائل — كلّها تعمل على حدث متكرّر. */
    listeners: number;
    /** أسطح واجهة تُحقَن. */
    uiInjects: number;
    /** أوامر شرطة مائلة. */
    commands: number;
    /**
     * 🔴 **أعلى صلاحية**: جسرٌ إلى العملية الرئيسية. صاحبه يتجاوز حدود
     * المُصيِّر — يقرأ القرص ويصل الشبكة خارج سياسة المحتوى. لم يكن في الماسح
     * الأصلي، وهو أهمّ ما فيه.
     */
    nativeMethods: number;
    type: PluginType;
    required: boolean;
    hidden: boolean;
}

/** خريطة (إضافة → رقع معلّقة) من قائمة الانتظار الفعلية. */
function pendingByPlugin(): Map<string, number> {
    const map = new Map<string, number>();
    try {
        for (const patch of pendingPatchList) {
            // `all:true` تبقى في القائمة دائماً بحكم التصميم — ليست إشارة.
            if (patch.all) continue;
            map.set(patch.plugin, (map.get(patch.plugin) ?? 0) + 1);
        }
    } catch { /* غير متاح — تُعرَض أصفار بصدق */ }
    return map;
}

/** أسماء الإضافات التي لها جسر أصليّ، وعدد دوالّه. */
function nativeBridges(): Map<string, number> {
    const map = new Map<string, number>();
    try {
        const helpers = (window as any).VencordNative?.pluginHelpers ?? {};
        for (const [plugin, methods] of Object.entries(helpers)) {
            map.set(plugin, Object.keys(methods as object).length);
        }
    } catch { /* الويب: لا جسور */ }
    return map;
}

/** لقطة واحدة متزامنة لكل إضافة مُفعَّلة. */
export function scanPlugins(): PluginScan[] {
    const out: PluginScan[] = [];
    const pending = pendingByPlugin();
    const natives = nativeBridges();

    for (const name of Object.keys(Plugins)) {
        if (!isPluginEnabled(name)) continue;
        const p = Plugins[name];
        if (!p) continue;

        const patches = p.patches?.length ?? 0;
        const commands = p.commands?.length ?? 0;

        let listeners = p.flux ? Object.keys(p.flux).length : 0;
        if (p.onMessageClick) listeners++;
        if (p.onBeforeMessageSend) listeners++;
        if (p.onBeforeMessageEdit) listeners++;

        let uiInjects = p.contextMenus ? Object.keys(p.contextMenus).length : 0;
        for (const field of [
            "userProfileBadge", "userProfileBadges", "messagePopoverButton", "chatBarButton",
            "chatBarButtonWrapper", "headerBarButton", "userAreaButton", "renderMessageAccessory",
            "renderMessageDecoration", "renderMemberListDecorator", "renderNicknameIcon",
            "renderProfileSection", "renderProfileCollection", "toolboxActions"
        ] as const) {
            if ((p as any)[field]) uiInjects++;
        }

        const isContinuous = patches > 0 || listeners > 0 || !!(
            p.renderMessageAccessory || p.renderMessageDecoration || p.renderMemberListDecorator ||
            (p as any).renderNicknameIcon || (p as any).renderProfileSection || (p as any).renderProfileCollection ||
            (p as any).headerBarButton || (p as any).userAreaButton || p.userProfileBadge || (p as any).userProfileBadges
        );

        out.push({
            name,
            patches,
            pendingPatches: pending.get(name) ?? 0,
            listeners,
            uiInjects,
            commands,
            nativeMethods: natives.get(name) ?? 0,
            type: isContinuous ? "continuous" : "ondemand",
            required: p.required === true,
            hidden: (p as any).hidden === true
        });
    }

    return out;
}

export interface NativeBridge {
    plugin: string;
    methods: number;
    /** أهي إضافة نعرفها، ومُفعَّلة؟ */
    known: boolean;
    enabled: boolean;
}

/**
 * 🔴 **كل الجسور، لا جسور المُفعَّلة وحدها.**
 *
 * الجسر يُسجَّل **وقت البناء** من كل `native.ts` في الشجرة، لا وقت التفعيل.
 * فجسر إضافةٍ معطَّلة يبقى في `VencordNative.pluginHelpers` **وقابلاً
 * للاستدعاء**. مقيس حيّاً: 25 جسراً، منها 19 لإضافات معطَّلة، وأوّلها يُعيد
 * `function` عند القراءة.
 *
 * ⇒ صفحةٌ تعدّ المُفعَّلة وحدها تُقلّل من سطح الصلاحية الحقيقي — وهو بالضبط
 * ما لا يجوز لصفحة اسمها «صلاحيات».
 */
export function scanNativeBridges(): NativeBridge[] {
    const out: NativeBridge[] = [];
    let helpers: Record<string, object> = {};
    try { helpers = (window as any).VencordNative?.pluginHelpers ?? {}; } catch { return out; }

    for (const [plugin, methods] of Object.entries(helpers)) {
        const p = (Plugins as any)[plugin];
        out.push({
            plugin,
            methods: Object.keys(methods).length,
            known: p != null,
            enabled: p != null && isPluginEnabled(plugin)
        });
    }
    return out.sort((a, b) => Number(b.enabled) - Number(a.enabled) || b.methods - a.methods);
}
