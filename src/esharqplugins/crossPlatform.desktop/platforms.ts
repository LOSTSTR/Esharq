/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { t } from "@utils/esharqI18n";
import { Logger } from "@utils/Logger";
import { PluginNative } from "@utils/types";

import { Credentials } from "./store";
import { HttpResult, PlatformId, PlatformPresence, ProbeResult } from "./types";

const logger = new Logger("CrossPlatform");

const Native = VencordNative.pluginHelpers.CrossPlatform as PluginNative<typeof import("./native")>;

// ── ما أُثبِت وما لم يُثبَت ──────────────────────────────────────────────────
// قياسٌ حيّ بتاريخ ٢٠٢٦-٠٩-٠٤، باختبارٍ مُميِّز: يُطلب مسارٌ حقيقيّ ومسارٌ
// مختلَق ويُقارَن الردّان. الحقيقيّ يصل إلى فحص المصادقة، والمختلَق يسقط
// عند التوجيه — فاختلافُ الردّين هو الدليل، لا الردُّ وحده.
//
//   Steam    ISteamUser/GetPlayerSummaries/v0002 → 403   المختلَق → 404  مُثبَت
//            ISteamUser/GetFriendList/v0001      → 403   المختلَق → 404  مُثبَت
//   Twitch   helix/streams/followed              → 401   المختلَق → 404  مُثبَت
//            helix/users                         → 401   المختلَق → 404  مُثبَت
//   Hypixel  v2/status                           → 400   المختلَق → 400  غير مُميِّز
//
// 🔴 Hypixel يفحص ترويسة المفتاح **قبل** التوجيه، فردُّه واحدٌ للحقيقيّ
// والمختلَق. المضيف حيٌّ يقيناً، أمّا المسار فيبقى **غير مُثبَت** حتى يُجرَّب
// بمفتاح حقيقيّ، وزرّ «اختبر الاتصال» هو ما يحسمه عند المستخدم.
//
// وأسماءُ الحقول أدناه من توثيق كلّ منصّة، وتُقرأ قراءةً متسامحة: الحقل
// الغائب يعني «لا نشاط» لا انهياراً.

const asRecord = (value: unknown): Record<string, unknown> | null =>
    typeof value === "object" && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;

const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const asText = (value: unknown): string => typeof value === "string" ? value : "";

type Parsed = { data: Record<string, unknown>; } | { error: string; };

/**
 * يقرأ ردّاً ويُرجع جسمه مُحلَّلاً، أو رسالةَ خطأ جاهزةً للعرض.
 *
 * التفصيل التقنيّ الآتي من الجسر الأصليّ يبقى إنجليزياً كما هو — هو نصُّ خطأٍ
 * لا رسالةُ واجهة، والتغليف حوله مُترجَم.
 */
function parse(result: HttpResult): Parsed {
    if (result.status === -1) return { error: `${t("تعذّر الاتصال: ", "Connection failed: ")}${result.body}` };
    if (result.status === 401 || result.status === 403) {
        return { error: t("المفتاح مرفوض، تأكّد من نسخه كاملاً.", "The key was rejected. Check that you copied all of it.") };
    }
    if (result.status === 429) {
        return { error: t("تجاوزتَ حدّ الطلبات، انتظر قليلاً.", "You hit the rate limit. Wait a moment.") };
    }
    if (result.status !== 200) {
        return { error: `${t("ردٌّ غير متوقَّع", "Unexpected response")} (${result.status}).` };
    }

    try {
        const data = asRecord(JSON.parse(result.body));
        return data ? { data } : { error: t("الردّ ليس كائن JSON.", "The response is not a JSON object.") };
    } catch {
        return { error: t("ردٌّ غير قابل للتحليل.", "The response could not be parsed.") };
    }
}

const get = (url: string, headers: Record<string, string> = {}): Promise<HttpResult> =>
    Native.request(url, headers);

// ── Steam ────────────────────────────────────────────────────────────────────
// وجودُ `gameextrainfo` هو الدليل الوحيد على أنّه يلعب، واسمُ اللعبة فيه نصّاً.
// الملفّ المخفيّ لا يُرجع الحقل أصلاً، فيُقرأ «لا يلعب» — وهو الصواب، إذ لا
// نعرف أكثر من ذلك.

const STEAM_BATCH = 100;

async function pollSteam(creds: Credentials, accountIds: string[]): Promise<PlatformPresence[]> {
    if (!creds.steamKey || accountIds.length === 0) return [];

    const out: PlatformPresence[] = [];
    for (let i = 0; i < accountIds.length; i += STEAM_BATCH) {
        const batch = accountIds.slice(i, i + STEAM_BATCH).join(",");
        const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${encodeURIComponent(creds.steamKey)}&steamids=${encodeURIComponent(batch)}`;
        const parsed = parse(await get(url));
        if ("error" in parsed) {
            logger.warn("Steam:", parsed.error);
            continue;
        }

        const response = asRecord(parsed.data.response);
        for (const raw of asArray(response?.players)) {
            const player = asRecord(raw);
            if (!player) continue;

            const accountId = asText(player.steamid);
            if (!accountId) continue;

            const game = asText(player.gameextrainfo);
            out.push({
                accountId,
                game: game || null,
                detail: game ? t("على ستيم", "on Steam") : undefined
            });
        }
    }
    return out;
}

async function probeSteam(creds: Credentials): Promise<ProbeResult> {
    if (!creds.steamKey) {
        return { ok: false, message: t("لم تُدخل مفتاح ستيم بعد.", "You have not entered a Steam key yet.") };
    }
    if (!creds.steamId) {
        return { ok: false, message: t("لم تُدخل معرّف ستيم (SteamID64) بعد.", "You have not entered your SteamID64 yet.") };
    }

    const url = `https://api.steampowered.com/ISteamUser/GetFriendList/v0001/?key=${encodeURIComponent(creds.steamKey)}&steamid=${encodeURIComponent(creds.steamId)}&relationship=friend`;
    const parsed = parse(await get(url));
    if ("error" in parsed) return { ok: false, message: parsed.error };

    const list = asRecord(parsed.data.friendslist);
    if (!list) {
        return {
            ok: false,
            message: t(
                "المفتاح صحيح لكنّ قائمة الأصدقاء مخفيّة، اجعل ملفّك عامّاً.",
                "The key works but your friend list is private. Make your profile public."
            )
        };
    }

    const count = asArray(list.friends).length;
    return {
        ok: true,
        count,
        message: `${t("تمّ. المفتاح يعمل، ورأى", "Done. The key works and saw")} ${count} ${t("صديقاً.", "friends.")}`
    };
}

// ── Hypixel ──────────────────────────────────────────────────────────────────
// المعرّف هنا UUID لماينكرافت بلا شُرَط. `session.online` هو الفصل، و`gameType`
// و`mode` يصفان ما يلعبه. الطلب لحسابٍ واحد في المرّة، فلا دفعات في هذه الواجهة.

async function pollHypixel(creds: Credentials, accountIds: string[]): Promise<PlatformPresence[]> {
    if (!creds.hypixelKey || accountIds.length === 0) return [];

    const out: PlatformPresence[] = [];
    for (const accountId of accountIds) {
        const url = `https://api.hypixel.net/v2/status?uuid=${encodeURIComponent(accountId)}`;
        const parsed = parse(await get(url, { "API-Key": creds.hypixelKey }));
        if ("error" in parsed) {
            logger.warn("Hypixel:", parsed.error);
            continue;
        }

        const session = asRecord(parsed.data.session);
        if (!session || session.online !== true) {
            out.push({ accountId, game: null });
            continue;
        }

        const mode = asText(session.mode);
        out.push({
            accountId,
            game: asText(session.gameType) || "Hypixel",
            detail: mode && mode !== "LOBBY" ? mode : t("في اللوبي", "in the lobby")
        });
    }
    return out;
}

async function probeHypixel(creds: Credentials): Promise<ProbeResult> {
    if (!creds.hypixelKey) {
        return { ok: false, message: t("لم تُدخل مفتاح Hypixel بعد.", "You have not entered a Hypixel key yet.") };
    }

    // معرّف Notch: حسابٌ ثابت يصلح مِحكّاً لأنّه لا يزول.
    const url = "https://api.hypixel.net/v2/status?uuid=069a79f444e94726a5befca90e38aaf5";
    const parsed = parse(await get(url, { "API-Key": creds.hypixelKey }));
    if ("error" in parsed) return { ok: false, message: parsed.error };
    if (parsed.data.success !== true) {
        const cause = asText(parsed.data.cause) || t("بلا سبب معلن", "no stated reason");
        return { ok: false, message: `${t("رفض Hypixel الطلب:", "Hypixel refused the request:")} ${cause}` };
    }

    return { ok: true, message: t("تمّ. مفتاح Hypixel يعمل، والمسار صحيح.", "Done. The Hypixel key works and the path is correct.") };
}

// ── Twitch ───────────────────────────────────────────────────────────────────
// هذه المنصّة مختلفة في طبيعتها: تُرجع مَن تتابعهم وهم يبثّون الآن، لا
// «أصدقاءك». والمعرّف المربوط هو `user_id` الرقميّ لقناة تويتش.

async function pollTwitch(creds: Credentials, accountIds: string[]): Promise<PlatformPresence[]> {
    if (!creds.twitchToken || !creds.twitchClientId || !creds.twitchUserId) return [];
    if (accountIds.length === 0) return [];

    const url = `https://api.twitch.tv/helix/streams/followed?user_id=${encodeURIComponent(creds.twitchUserId)}&first=100`;
    const parsed = parse(await get(url, {
        Authorization: `Bearer ${creds.twitchToken}`,
        "Client-Id": creds.twitchClientId
    }));
    if ("error" in parsed) {
        logger.warn("Twitch:", parsed.error);
        return [];
    }

    const wanted = new Set(accountIds);
    const out: PlatformPresence[] = [];
    for (const raw of asArray(parsed.data.data)) {
        const stream = asRecord(raw);
        if (!stream) continue;

        const accountId = asText(stream.user_id);
        if (!wanted.has(accountId)) continue;

        const login = asText(stream.user_login);
        const startedAt = Date.parse(asText(stream.started_at));
        out.push({
            accountId,
            game: asText(stream.game_name) || t("بثّ مباشر", "Live stream"),
            detail: asText(stream.title) || undefined,
            startedAt: Number.isNaN(startedAt) ? undefined : startedAt,
            streamUrl: login ? `https://twitch.tv/${login}` : undefined
        });
    }
    return out;
}

async function probeTwitch(creds: Credentials): Promise<ProbeResult> {
    if (!creds.twitchClientId) {
        return { ok: false, message: t("لم تُدخل Client ID بعد.", "You have not entered a Client ID yet.") };
    }
    if (!creds.twitchToken) {
        return { ok: false, message: t("لم تُدخل توكن OAuth بعد.", "You have not entered an OAuth token yet.") };
    }
    if (!creds.twitchUserId) {
        return { ok: false, message: t("لم تُدخل معرّف حسابك على تويتش بعد.", "You have not entered your Twitch user id yet.") };
    }

    const url = `https://api.twitch.tv/helix/streams/followed?user_id=${encodeURIComponent(creds.twitchUserId)}&first=1`;
    const parsed = parse(await get(url, {
        Authorization: `Bearer ${creds.twitchToken}`,
        "Client-Id": creds.twitchClientId
    }));
    if ("error" in parsed) return { ok: false, message: parsed.error };

    const count = asArray(parsed.data.data).length;
    return {
        ok: true,
        count,
        message: count > 0
            ? t("تمّ. التوكن يعمل، وهناك بثّ مباشر الآن.", "Done. The token works and someone is live right now.")
            : t("تمّ. التوكن يعمل، ولا أحد ممّن تتابعهم يبثّ الآن.", "Done. The token works and nobody you follow is live right now.")
    };
}

// ── الجدول ───────────────────────────────────────────────────────────────────

export interface PlatformModule {
    id: PlatformId;
    /** اسم المنصّة كما يُعرض. يبقى لاتينياً لأنّه اسم علم. */
    label: string;
    /** ما يُكتب في حقل الربط، شرحاً للمستخدم. */
    linkHint: string;
    /** من أين يجلب المستخدم مفتاحه. */
    keyUrl: string;
    poll(creds: Credentials, accountIds: string[]): Promise<PlatformPresence[]>;
    probe(creds: Credentials): Promise<ProbeResult>;
}

/** يُبنى عند القراءة لا عند التحميل، فتتبع النصوصُ لغةَ الواجهة الحالية. */
export const buildPlatforms = (): readonly PlatformModule[] => [
    {
        id: "steam",
        label: "Steam",
        linkHint: t("SteamID64، رقمٌ من ١٧ خانة", "SteamID64, a 17 digit number"),
        keyUrl: "https://steamcommunity.com/dev/apikey",
        poll: pollSteam,
        probe: probeSteam
    },
    {
        id: "hypixel",
        label: "Hypixel",
        linkHint: t("UUID ماينكرافت بلا شُرَط", "Minecraft UUID without dashes"),
        keyUrl: "https://developer.hypixel.net",
        poll: pollHypixel,
        probe: probeHypixel
    },
    {
        id: "twitch",
        label: "Twitch",
        linkHint: t("معرّف قناة تويتش الرقميّ", "Numeric Twitch channel id"),
        keyUrl: "https://dev.twitch.tv/console/apps",
        poll: pollTwitch,
        probe: probeTwitch
    }
];
