/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * **الاتّصال المشفَّر** — DNS عبر HTTPS لديسكورد.
 *
 * ## ما المشكلة أصلاً
 *
 * قبل أن يتّصل ديسكورد بخوادمه يسأل: «ما عنوان `discord.com`؟». وهذا السؤال
 * يُرسَل **نصّاً مكشوفاً** إلى مُحوّل الشبكة الافتراضيّ — مزوّد خدمتك في
 * الغالب. فيعرف متى تفتح ديسكورد وكم مرّة، ولو كان كل ما بعده مشفَّراً.
 *
 * ⇒ DoH يُلبس السؤالَ نفسه TLS، فيصير سؤالاً بين جهازك والمُحوّل الذي
 * **تختاره أنت**.
 *
 * ## 🔴 ما لا يفعله — قيلت صراحةً في الواجهة
 *
 *  • **لا يُخفي أنك تستعمل ديسكورد.** عنوان IP الوجهة يبقى مكشوفاً، ومزوّدك
 *    يراه. الذي يُخفى هو **السؤال** لا الاتّصال.
 *  • **وليس VPN.** لا يُغيّر موقعك ولا يتخطّى حجباً.
 *  • **وثقتُك تنتقل** من مزوّد خدمتك إلى مُحوّل DoH. وهذا اختيارٌ لا إلغاء.
 *
 * ## وما بُني عليه
 *
 * `app.configureHostResolver` — واجهة إلكترون الرسمية (تُضبَط على مستوى
 * التطبيق بعد `ready`). فالتشفير يقع في مُحوّل كروميوم نفسه لا في طبقةٍ
 * نكتبها فوقه.
 *
 * ⚠️ **DoH وحده، لا DoT.** مُحوّل كروميوم لا يدعم DNS-over-TLS، فلا يُعرَض
 * زرٌّ لاختباره. زرٌّ يفحص ما لا نُشغّله يكذب على ضاغطه.
 */

import { app, ipcMain, net } from "electron";

import { IpcEvents } from "../shared/IpcEvents";
import { NativeSettings, RendererSettings, StartupRead } from "./settings";

export type DnsMode = "off" | "automatic" | "secure";

export interface DnsProvider {
    id: string;
    name: string;
    /** قالب RFC 8484. */
    template: string;
    ar: string;
    en: string;
}

/**
 * المُحوّلات المعروضة.
 *
 * كلٌّ منها **مُحوِّلٌ عامّ يُعلن سياسة خصوصية** ويدعم RFC 8484. ولم يُدرَج
 * مُحوّلٌ يُسجّل الاستعلامات باعترافه، ولا واحدٌ بلا صفحةٍ تصف ما يحفظه.
 */
export const PROVIDERS: readonly DnsProvider[] = [
    {
        id: "cloudflare", name: "Cloudflare 1.1.1.1",
        template: "https://cloudflare-dns.com/dns-query",
        ar: "سريع وواسع الانتشار، ولا يحفظ سجلّاً يُعرَف به صاحبه.",
        en: "Fast and widely deployed; keeps no identifying query log."
    },
    {
        id: "cloudflare-malware", name: "Cloudflare 1.1.1.2",
        template: "https://security.cloudflare-dns.com/dns-query",
        ar: "مثل السابق، ويحجب النطاقات الخبيثة المعروفة.",
        en: "The same, and blocks known malicious domains."
    },
    {
        id: "quad9", name: "Quad9",
        template: "https://dns.quad9.net/dns-query",
        ar: "مؤسّسة سويسرية غير ربحية، تحجب الخبيث ولا تحفظ عنواناً.",
        en: "A Swiss non-profit; blocks malicious domains and stores no address."
    },
    {
        id: "mullvad", name: "Mullvad DNS",
        template: "https://dns.mullvad.net/dns-query",
        ar: "بلا سجلّات وبلا حسابات — من فريق Mullvad.",
        en: "No logs and no accounts — from the Mullvad team."
    },
    {
        id: "mullvad-adblock", name: "Mullvad Adblock",
        template: "https://adblock.dns.mullvad.net/dns-query",
        ar: "مثل السابق، مع حجب الإعلانات والمتعقّبات.",
        en: "The same, with ads and trackers blocked."
    },
    {
        id: "adguard", name: "AdGuard DNS",
        template: "https://dns.adguard-dns.com/dns-query",
        ar: "يحجب الإعلانات والمتعقّبات على مستوى الأسماء.",
        en: "Blocks ads and trackers at the name level."
    },
    {
        id: "dns0", name: "dns0.eu",
        template: "https://dns0.eu",
        ar: "مُحوِّل أوروبيّ غير ربحيّ، خاضع لقانون حماية البيانات الأوروبي.",
        en: "A European non-profit resolver, under EU data-protection law."
    }
];

export interface DnsState {
    mode: DnsMode;
    providerId: string;
    /** ما طُبِّق فعلاً على مُحوّل كروميوم في هذه الجلسة. */
    appliedTemplate: string | null;
    appliedAt: number | null;
}

const state: DnsState = { mode: "off", providerId: "cloudflare", appliedTemplate: null, appliedAt: null };

function providerFor(id: string): DnsProvider {
    return PROVIDERS.find(p => p.id === id) ?? PROVIDERS[0];
}

/**
 * يُطبّق الإعداد على مُحوّل كروميوم.
 *
 * 🔴 `secureDnsMode: "secure"` تعني **لا رجوع** إلى DNS المكشوف: إن سقط
 * المُحوّل انقطع الاسم ولم يعمل ديسكورد. وهذا صحيحٌ للخصوصية وقاسٍ على من
 * لا يعرف — ولذلك تقول الواجهة ذلك قبل الاختيار، والافتراضيّ `automatic`.
 */
function apply(next: DnsState): void {
    const provider = providerFor(next.providerId);

    if (next.mode === "off") {
        app.configureHostResolver({ secureDnsMode: "off", secureDnsServers: [] });
        state.appliedTemplate = null;
    } else {
        app.configureHostResolver({
            secureDnsMode: next.mode,
            secureDnsServers: [provider.template]
        });
        state.appliedTemplate = provider.template;
    }

    state.mode = next.mode;
    state.providerId = next.providerId;
    state.appliedAt = Date.now();
}

/* ── اختبار المُحوّل ─────────────────────────────────────────────────────── */

/**
 * يبني استعلام DNS بصيغة السلك (RFC 1035) لاسمٍ ونوع A.
 *
 * الصيغة السلكية لا الـJSON: بعض المُحوّلات (مثل Mullvad) لا تُقدّم واجهة
 * JSON، والسلكية يفهمها **كلّ** مُحوّل يدّعي RFC 8484. فاختبارٌ بها يصلح
 * للجميع، وواحدٌ بالـJSON كان سيفشل عند بعضهم ويبدو عطلاً فيهم.
 */
function buildQuery(name: string): Buffer {
    const labels = name.split(".").filter(Boolean);
    const nameBytes: number[] = [];
    for (const label of labels) {
        nameBytes.push(label.length);
        for (const ch of Buffer.from(label, "ascii")) nameBytes.push(ch);
    }
    nameBytes.push(0);

    // المعرّف صفرٌ عمداً: الطلب يُرسَل عبر HTTPS فلا يُطابَق بمعرّفه، والصفر
    // يجعل الطلب قابلاً للتخزين المؤقّت عند الوسطاء كما يوصي RFC 8484 § 4.1.
    const header = Buffer.from([0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
    const question = Buffer.concat([Buffer.from(nameBytes), Buffer.from([0, 1, 0, 1])]);
    return Buffer.concat([header, question]);
}

/** عدد الأجوبة في ردّ DNS — يكفي للحكم بأن المُحوّل ردّ فعلاً. */
function answerCount(buffer: Buffer): number {
    return buffer.length >= 8 ? buffer.readUInt16BE(6) : 0;
}

export interface DnsTestResult {
    ok: boolean;
    providerId: string;
    /** بالميلي ثانية. */
    ms?: number;
    answers?: number;
    status?: number;
    reason?: "http" | "empty" | "network" | "timeout";
}

async function testProvider(providerId: string, hostname: string): Promise<DnsTestResult> {
    const provider = providerFor(providerId);
    const query = buildQuery(hostname).toString("base64url");
    const url = `${provider.template}?dns=${query}`;

    const started = Date.now();
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 6000);

    try {
        // 🔴 `net.fetch` لا `fetch` العامّة.
        //
        // العامّة في العملية الرئيسية هي fetch الخاصّة بـNode: تحمل قائمة
        // شهاداتها الخاصّة، فترفض أي شبكةٍ تعترض TLS. وقِيس على هذا الجهاز:
        // كل مُحوّلات DoH ترمي `self-signed certificate in certificate chain`
        // بينما `curl` يصلها — لأن الأخير يستعمل مخزن شهادات النظام.
        //
        // و`net.fetch` تمرّ بمكدّس شبكة كروميوم: مخزن النظام نفسه الذي يثق به
        // المتصفّح، ومعه HTTP/2 الذي تشترطه بعض المُحوّلات (Quad9 ردّ 505 على
        // HTTP/1.1). فالاختبار يقيس ما سيحدث فعلاً، لا ما يحدث في بيئةٍ أنظف.
        const response = await net.fetch(url, {
            headers: { accept: "application/dns-message" },
            signal: abort.signal
        });
        const ms = Date.now() - started;
        if (!response.ok) return { ok: false, providerId, ms, status: response.status, reason: "http" };

        const answers = answerCount(Buffer.from(await response.arrayBuffer()));
        return answers > 0
            ? { ok: true, providerId, ms, answers, status: response.status }
            : { ok: false, providerId, ms, answers: 0, status: response.status, reason: "empty" };
    } catch (error: any) {
        const ms = Date.now() - started;
        return { ok: false, providerId, ms, reason: error?.name === "AbortError" ? "timeout" : "network" };
    } finally {
        clearTimeout(timer);
    }
}

/* ── التسجيل ─────────────────────────────────────────────────────────────── */

const KEY = "esharqSecureDns";

/**
 * ترحيلٌ مرّة واحدة من موضعها القديم في إعدادات المُصيِّر.
 *
 * 🔴 نسخٌ لا نقل، ولا يُحذف القديم: نسخةٌ أقدم من إشراق تقرؤه من هناك، وحذفُه
 * يُضيّع اختيار من رجع. والقديم سيُمحى وحده عند أوّل تبديلٍ من الواجهة — وهو
 * العطل نفسه الذي نُصلحه، فلا خسارة في تركه.
 */
function migrateFromRendererSettings(): void {
    if (NativeSettings.plain[KEY] !== undefined) return;

    /**
     * 🔴 لا يُرحَّل من قراءةٍ لم تنجح.
     *
     * إن تعثّرت قراءة `settings.json` هذا الإقلاع، فما في `RendererSettings`
     * هو **نسخة الأمان** — قد تسبق اليوم الذي بدّل فيه صاحبها الـDNS. والترحيل
     * يقع مرّةً واحدة إلى الأبد، فكان يقفل قيمة الأمس نهائياً: يعود الإعداد
     * إلى «مطفأ» بلا رسالة ولا سبيل رجوع. تأجيلُه إقلاعاً واحداً لا يُكلّف
     * شيئاً — الحارس يُعاد تقييمه من القرص في المرّة القادمة.
     */
    if (!StartupRead.ok) return;

    const legacy = (RendererSettings.plain as any)?.[KEY];
    if (legacy?.mode === undefined) return;
    NativeSettings.store[KEY] = { mode: legacy.mode, providerId: legacy.providerId };
}

function saved(): { mode: DnsMode; providerId: string; } {
    migrateFromRendererSettings();
    const raw = NativeSettings.plain[KEY];
    const mode: DnsMode = raw?.mode === "secure" || raw?.mode === "automatic" || raw?.mode === "off" ? raw.mode : "off";
    const providerId = typeof raw?.providerId === "string" && PROVIDERS.some(p => p.id === raw.providerId)
        ? raw.providerId
        : "cloudflare";
    return { mode, providerId };
}

export function registerSecureDnsIpc() {
    /**
     * 🔴 يُطبَّق بعد `ready` لا قبله: الواجهة تشترط ذلك، ونداءٌ أبكر يُرمى.
     * ولا يُطبَّق شيء إن كان مُطفأً — لا لمسَ لمُحوّل من لم يطلب.
     */
    app.whenReady().then(() => {
        const persisted = saved();
        state.mode = persisted.mode;
        state.providerId = persisted.providerId;
        if (persisted.mode !== "off") {
            try { apply({ ...persisted, appliedTemplate: null, appliedAt: null }); }
            catch (error) { console.error("[Esharq] secure DNS failed to apply", error); }
        }
    });

    ipcMain.handle(IpcEvents.DNS_GET_STATE, () => ({
        ...state,
        providers: PROVIDERS
    }));

    ipcMain.handle(IpcEvents.DNS_SET, (_, rawMode: unknown, rawProvider: unknown) => {
        const mode: DnsMode = rawMode === "secure" || rawMode === "automatic" ? rawMode : "off";
        const providerId = typeof rawProvider === "string" && PROVIDERS.some(p => p.id === rawProvider)
            ? rawProvider
            : state.providerId;

        try {
            apply({ mode, providerId, appliedTemplate: null, appliedAt: null });
        } catch (error) {
            console.error("[Esharq] secure DNS failed to apply", error);
            return { ok: false, reason: "apply" };
        }

        // تُكتب في تخزين العملية الرئيسية — لا يمرّ عليه دفعُ المُصيِّر فلا يُدهَس.
        NativeSettings.store[KEY] = { mode, providerId };
        return { ok: true, state: { ...state } };
    });

    /**
     * يختبر مُحوّلاً بعينه.
     *
     * ⚠️ الاختبار طلبٌ واحد يبدأ **بضغطة**؛ لا شيء يجري تلقائياً في الخلفية.
     * والاسم المسؤول عنه ثابتٌ عامّ لا يخصّ المستخدم.
     */
    ipcMain.handle(IpcEvents.DNS_TEST, async (_, rawProvider: unknown) => {
        const providerId = typeof rawProvider === "string" ? rawProvider : state.providerId;
        return testProvider(providerId, "discord.com");
    });
}
