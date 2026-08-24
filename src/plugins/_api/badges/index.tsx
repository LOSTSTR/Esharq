/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import "./fixDiscordBadgePadding.css";
import "./esharqBadges.css";

import { _getBadges, BadgePosition, BadgeUserArgs, ProfileBadge } from "@api/Badges";
import { addMessageDecoration, removeMessageDecoration } from "@api/MessageDecorations";
import ErrorBoundary from "@components/ErrorBoundary";
import { CopyIcon, LinkIcon } from "@components/Icons";
import { openContributorModal } from "@components/settings/tabs";
import { Devs, ESHARQ_GUILD_ID } from "@utils/constants";
import { copyWithToast } from "@utils/discord";
import { t } from "@utils/esharqI18n";
import { Logger } from "@utils/Logger";
import { esharqTierOf, isEsharqUser, setEsharqTeam, shouldShowContributorBadge, shouldShowEquicordContributorBadge } from "@utils/misc";
import { sha256Hex } from "@utils/sha256";
import definePlugin from "@utils/types";
import { ContextMenuApi, GuildMemberStore, Menu, Toasts, Tooltip, UserStore } from "@webpack/common";

import Plugins, { PluginMeta } from "~plugins";

import { isHiddenLocally, startLinkCapture, stopLinkCapture } from "./control";
import { EquicordDonorModal, EquicordTranslatorModal, VencordDonorModal } from "./modals";

const CONTRIBUTOR_BADGE = "https://cdn.discordapp.com/emojis/1092089799109775453.png?size=64";
const EQUICORD_CONTRIBUTOR_BADGE = "https://equicord.org/assets/favicon.png";
const USERPLUGIN_CONTRIBUTOR_BADGE = "https://equicord.org/assets/icons/misc/userplugin.png";
const ESHARQ_BADGES = "https://raw.githubusercontent.com/LOSTSTR/Esharq-Bored/main/badges/";

/**
 * رتب إشراق. الصورة والاسم لكلّ رتبة في مكان واحد، فإضافة رتبة لاحقاً سطرٌ هنا
 * وسطرٌ في `ESHARQ_TIERS` — لا شيء آخر.
 *
 * «مستخدم» ليست رتبة تُمنَح: تظهر تلقائياً لكلّ من له مدخل عامّ في أيّ رتبة،
 * فهي علامة الانتماء لا مرتبة فوق غيرها.
 */
const ESHARQ_TIER_META = {
    owner: { img: "owner/owner.png", label: "مالك إشراق · Esharq Owner" },
    admin: { img: "admin/admin.png", label: "مدير إشراق · Esharq Admin" },
    tester: { img: "tester/tester.png", label: "مُختبِر إشراق · Esharq Tester" },
    supporter: { img: "supporter/supporter.png", label: "داعم إشراق · Esharq Supporter" },
    user: { img: "user/user.png", label: "مستخدم إشراق · Esharq User" },
} as const;

const tierIcon = (tier: keyof typeof ESHARQ_TIER_META) => ESHARQ_BADGES + ESHARQ_TIER_META[tier].img;

// شارة الرتبة الممنوحة (واحدة لكلّ عضو — أعلى رتبة يملكها). الصقل البصريّ
// (قصّ دائريّ، حلقة، تكبير عند المرور) في esharqBadges.css عبر aria-label،
// لأنّ النمط السطريّ يمنع تحوّل :hover.
const EsharqTierBadge: ProfileBadge = {
    id: "esharq_tier_badge",
    // اسمٌ عامّ لا تفصيليّ: الشارة مكوّن، والمكوّن يعرف الرتبة فيُظهر اسمها
    // الدقيق في تلميحه. أمّا هذا الحقل فيقرؤه ديسكورد وصفحة «ملفّي» في إعدادات
    // إشراق، وكان فارغاً — فكانت الشارة تغيب عن تلك الصفحة كلّياً.
    description: "رتبة إشراق · Esharq Rank",
    position: BadgePosition.START,
    shouldShow: ({ userId }) => esharqTierOf(userId) !== null && badgeVisible(userId, "tier", "profile"),
    component: ({ userId }: BadgeUserArgs) => {
        const tier = esharqTierOf(userId);
        if (!tier) return null;
        const meta = ESHARQ_TIER_META[tier];
        return (
            <Tooltip text={meta.label}>
                {({ onMouseEnter, onMouseLeave }) => (
                    <span
                        className="esharq-tier-badge"
                        data-tier={tier}
                        role="img"
                        aria-label={meta.label}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        onClick={() => openContributorModal(UserStore.getUser(userId))}
                    >
                        <img src={tierIcon(tier)} alt="" />
                    </span>
                )}
            </Tooltip>
        );
    },
};

/**
 * شارة «مستخدم إشراق» — علامة انتماء لا مرتبة.
 *
 * تُمنَح لثلاثة، وترتيبها ترتيب الوثوق والكلفة:
 *
 *  1. **مدخل عامّ في أيّ رتبة** — يُعرَف بلا شبكة ولا مخزن.
 *  2. **بصمات الأعضاء المنشورة** — تجعلها تظهر **لكلّ ناظر**، حتى من ليس في
 *     خادم إشراق، وتبقى لمن غادره. تُبنى بمهمّة مجدولة في الموقع، ولا توجد
 *     قبل أوّل مزامنة. تُنشَر بصماتٍ لا معرّفات، فلا تُسحَب القائمة.
 *  3. **مخزن ديسكورد المحليّ** — احتياطٌ فوريّ يلتقط من انضمّ اليوم قبل أن
 *     تلحقه المزامنة، ويعمل حين يتعذّر جلب القائمة.
 *
 * الثالث وحده كان يعني «تظهر لأهل الدار فقط»؛ الثاني هو ما جعلها عامّة.
 */
const isEsharqMember = (userId: string) =>
    isEsharqUser(userId)
    || (EsharqMemberFingerprints.size > 0 && EsharqMemberFingerprints.has(fingerprintOf(userId)))
    || GuildMemberStore.isMember(ESHARQ_GUILD_ID, userId);

const EsharqUserBadge: ProfileBadge = {
    id: "esharq_user_badge",
    description: ESHARQ_TIER_META.user.label,
    iconSrc: tierIcon("user"),
    position: BadgePosition.START,
    shouldShow: ({ userId }) => isEsharqMember(userId) && badgeVisible(userId, "user", "profile"),
    onClick: (_, { userId }) => openContributorModal(UserStore.getUser(userId)),
};

// شارة الرتبة تظهر أيضاً بجانب الاسم في المحادثة (زخرفة رسالة).
const EsharqTierChatBadge = ({ userId }: { userId: string; }) => {
    const tier = esharqTierOf(userId);
    if (!tier) return null;
    const meta = ESHARQ_TIER_META[tier];
    return (
        <span className="esharq-tier-chat-badge" data-tier={tier} role="img" aria-label={meta.label}>
            <img src={tierIcon(tier)} alt="" />
        </span>
    );
};

// Esharq Custom badges — a per-member image shown AS-IS (no ring/crop/text). Also shown
// inline in chat (message decoration) like the donor/contributor/developer badges; clicking
// opens the Esharq supporter modal ("داعم إشراق"), and hovering shows ":3".
// Each member's image is mapped by Discord user id in
// Esharq-Bored/badges/custom/custom.json (loaded into EsharqCustomBadges).
const EsharqCustomBadge: ProfileBadge = {
    id: "esharq_custom_badge",
    description: "مخصّص · Esharq Custom",
    position: BadgePosition.START,
    shouldShow: ({ userId }) => userId in EsharqCustomBadges && badgeVisible(userId, "custom", "profile"),
    component: ({ userId }: ProfileBadge & BadgeUserArgs) => {
        // Per-member image + hover text come from custom.json ({ image, tooltip }); since
        // component-rendered badges get no automatic Discord tooltip, wrap in an explicit one.
        const entry = EsharqCustomBadges[userId];
        if (!entry?.image) return null;
        return (
            <Tooltip text={entry.tooltip || " "}>
                {({ onMouseEnter, onMouseLeave }) => (
                    <span
                        className="esharq-custom-badge"
                        role="img"
                        aria-label={entry.tooltip || "Esharq Custom"}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        onClick={e => { e.stopPropagation(); EquicordDonorModal(); }}
                    >
                        <img src={entry.image} alt="" />
                    </span>
                )}
            </Tooltip>
        );
    },
    // ⚠️ onClick on a `component:` ProfileBadge is IGNORED by the badge API (like the auto
    // tooltip) — so the click is wired INSIDE the <span> above instead. This makes EVERY custom
    // badge (present and future, any member in custom.json) open the Esharq supporter modal on click.
};

// The Custom badge also shows inline in chat — the member's OWN image, shown as-is (no ring/
// crop, like its profile badge). Same idea as the donor/dev/contributor chat badges; hover
// reveals ":3" and clicking opens the Esharq supporter modal.
const EsharqCustomChatBadge = ({ userId }: { userId: string; }) => {
    const entry = EsharqCustomBadges[userId];
    if (!entry?.image) return null;
    return (
        <Tooltip text={entry.tooltip || " "}>
            {({ onMouseEnter, onMouseLeave }) => (
                <span
                    className="esharq-custom-chat-badge"
                    role="img"
                    aria-label={entry.tooltip || "Esharq Custom"}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onClick={e => { e.stopPropagation(); EquicordDonorModal(); }}
                >
                    <img src={entry.image} alt="" />
                </span>
            )}
        </Tooltip>
    );
};

// Esharq self-service supporter badge — the member's own image, own hover text and own effect,
// all from selfserve.json.
//
// A `component:` badge rather than an iconSrc one, and that is forced rather than stylistic:
// Discord replaces the className on an iconSrc badge, which is why every other Esharq effect is
// targeted through the aria-label (see esharqBadges.css). That cannot work here, because the
// hover text is free-form — there is no stable string to match on. Rendering our own component
// gives the className back, which is what makes a per-member effect possible at all.
const EsharqSelfServeBadge: ProfileBadge = {
    id: "esharq_selfserve_badge",
    description: "داعم إشراق · Esharq Supporter",
    position: BadgePosition.START,
    shouldShow: ({ userId }) => selfServeVisible(userId, "profile"),
    component: ({ userId }: ProfileBadge & BadgeUserArgs) => {
        const live = EsharqSelfServeBadges[userId]?.live;
        if (!live?.image) return null;
        return (
            <Tooltip text={live.tooltip || " "}>
                {({ onMouseEnter, onMouseLeave }) => (
                    <span
                        className={selfServeClass("esharq-selfserve-badge", live.effect)}
                        role="img"
                        aria-label={live.tooltip || "Esharq Supporter"}
                        onMouseEnter={onMouseEnter}
                        onMouseLeave={onMouseLeave}
                        onClick={e => { e.stopPropagation(); EquicordDonorModal(); }}
                    >
                        <img src={live.image} alt="" />
                    </span>
                )}
            </Tooltip>
        );
    },
    // ⚠️ Same caveat as the Custom badge: onClick on a `component:` ProfileBadge is IGNORED by
    // the badge API, so the click is wired inside the <span> above instead.
};

// The self-service badge also shows inline in chat, like the donor/dev/contributor/custom ones.
const EsharqSelfServeChatBadge = ({ userId }: { userId: string; }) => {
    const live = EsharqSelfServeBadges[userId]?.live;
    if (!live?.image) return null;
    return (
        <Tooltip text={live.tooltip || " "}>
            {({ onMouseEnter, onMouseLeave }) => (
                <span
                    className={selfServeClass("esharq-selfserve-chat-badge", live.effect)}
                    role="img"
                    aria-label={live.tooltip || "Esharq Supporter"}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onClick={e => { e.stopPropagation(); EquicordDonorModal(); }}
                >
                    <img src={live.image} alt="" />
                </span>
            )}
        </Tooltip>
    );
};

const ContributorBadge: ProfileBadge = {
    id: "vencord_contributor_badge",
    get description() { return t("مساهم Vencord", "Vencord contributor"); },
    iconSrc: CONTRIBUTOR_BADGE,
    position: BadgePosition.START,
    shouldShow: ({ userId }) => shouldShowContributorBadge(userId),
    onClick: (_, { userId }) => openContributorModal(UserStore.getUser(userId))
};

const EquicordContributorBadge: ProfileBadge = {
    id: "equicord_contributor_badge",
    get description() { return t("مساهم Equicord", "Equicord contributor"); },
    iconSrc: EQUICORD_CONTRIBUTOR_BADGE,
    position: BadgePosition.START,
    shouldShow: ({ userId }) => shouldShowEquicordContributorBadge(userId),
    onClick: (_, { userId }) => openContributorModal(UserStore.getUser(userId)),
    props: {
        style: {
            borderRadius: "50%",
            transform: "scale(0.9)"
        }
    },
};

const UserPluginContributorBadge: ProfileBadge = {
    id: "user_plugin_contributor_badge",
    get description() { return t("مساهم إضافات المستخدم", "User plugin contributor"); },
    iconSrc: USERPLUGIN_CONTRIBUTOR_BADGE,
    position: BadgePosition.START,
    shouldShow: ({ userId }) => {
        if (!IS_DEV) return false;
        const allPlugins = Object.values(Plugins);
        return allPlugins.some(p => {
            const pluginMeta = PluginMeta[p.name];
            return pluginMeta?.userPlugin && p.authors.some(a => a.id.toString() === userId);
        });
    },
    onClick: (_, { userId }) => openContributorModal(UserStore.getUser(userId)),
    props: {
        style: {
            borderRadius: "50%",
            transform: "scale(0.9)"
        }
    },
};

let DonorBadges = {} as Record<string, Array<Record<"tooltip" | "badge", string>>>;
// تبقى فارغةً بعد اليوم: انظر التعليق في `loadAllBadges`. `const` لأنّ إسنادها
// هو بالضبط ما كان يرسم شارة الرتبة مرّتين.
const EquicordDonorBadges = {} as Record<string, Array<Record<"tooltip" | "badge", string>>>;
// Esharq's own donors only (from Esharq-Bored). The merged set above is used to render badges;
// this one decides who sees the "thank you for donating" card, so Equicord donors don't trigger it.
let EsharqDonorBadges = {} as Record<string, Array<Record<"tooltip" | "badge", string>>>;
// Esharq Custom badges: Discord user id → { image, tooltip } (from Esharq-Bored/custom.json).
// Data-driven so a member's image AND hover text can change with NO rebuild (edit the JSON).
let EsharqCustomBadges = {} as Record<string, { image: string; tooltip?: string; }>;

/**
 * بصمات أعضاء إشراق (Esharq-Bored/badges/user/members.json).
 *
 * الملفّ **لا يحمل معرّفات**، بل أوائل SHA-256 لكلّ معرّف مسبوقاً ببادئة معلنة.
 * فلا يستطيع أحد تنزيل «قائمة من في خادم إشراق»؛ ومن عنده معرّفٌ بعينه يستطيع
 * التحقّق منه — وهذا حدُّ ما يُمكن مع بيانٍ يقرأه كلّ عميل، وقيل صراحةً.
 *
 * يُوحَّد ولا ينكمش: من دخل الخادم مرّةً بقيت شارته وإن غادر.
 *
 * التجزئة تُخزَّن لكلّ معرّف بعد أوّل حساب: الشارة تُستدعى مراراً لنفس العضو
 * في القائمة والمحادثة والملفّ، فلا داعي لإعادة الحساب.
 */
/**
 * تفضيلات إظهار الشارات (Esharq-Bored/badges/visibility.json).
 *
 * 🔴 من الخادم لا من الجهاز. عضوٌ يُخفي شارته تختفي **لدى إشراق كلّه**، لا عنه
 * وحده — فمفتاحٌ محليّ يُخفيها عن صاحبها بينما يراها الناس إخفاءٌ وهميّ، ورُفض.
 *
 * الغياب يعني «ظاهرة»: من لم يُغيّر شيئاً لا يُذكَر في الملفّ أصلاً.
 */
let EsharqVisibility = {} as Record<string, Partial<Record<"tier" | "user" | "custom", { profile?: boolean; chat?: boolean; }>>>;

/**
 * أتُرسَم شارة من هذا النوع لهذا العضو في هذا الموضع؟
 *
 * فحصان مستقلّان: تفضيل صاحبها على الخادم (يسري على الجميع)، وتفضيلٌ محليّ
 * يخصّ **شاراتي أنا على جهازي**. الثاني لا يُطبَّق على غيري: إخفاء شارة شخصٍ
 * آخر عن نفسي ليس ممّا وُعِد به المستخدم، ولا معنى له.
 */
function badgeVisible(userId: string, kind: "tier" | "user" | "custom", surface: "profile" | "chat"): boolean {
    if (EsharqVisibility[userId]?.[kind]?.[surface] === false) return false;
    if (userId === UserStore.getCurrentUser()?.id && isHiddenLocally(kind, surface)) return false;
    return true;
}

let EsharqMemberFingerprints = new Set<string>();
let EsharqHashPrefix = "esharq-user-v1:";
let EsharqHashChars = 16;

const fingerprintCache = new Map<string, string>();

function fingerprintOf(userId: string): string {
    let fp = fingerprintCache.get(userId);
    if (fp === undefined) {
        fp = sha256Hex(EsharqHashPrefix + userId).slice(0, EsharqHashChars);
        // سقفٌ للذاكرة: خادمٌ مزدحم يمرّ بآلاف المعرّفات في الجلسة الواحدة.
        if (fingerprintCache.size > 5000) fingerprintCache.clear();
        fingerprintCache.set(userId, fp);
    }
    return fp;
}

// Esharq self-service supporter badges (Esharq-Bored/badges/selfserve.json). A supporter sets
// their own image, hover text and effect with /badge in the Esharq server; a moderator approves
// it and the entry appears here on the next refetch — no rebuild, no release.
//
// Only `live` is rendered. A submission awaiting review is never published (its image stays
// inside the private review channel until approval), so nothing unreviewed can reach a client.
/**
 * أين تظهر الشارة. الغياب = تظهر — فالبيانات القديمة تبقى صالحة بلا ترحيل،
 * ولا يختفي شيء عن أحد لأن حقلاً لم يُكتب بعد.
 */
interface BadgeSurfaces {
    profile?: boolean;
    chat?: boolean;
}

interface SelfServeEntry {
    live?: { image: string; tooltip?: string; effect?: string; surfaces?: BadgeSurfaces; };
}

/**
 * 🔴 قاعدة الظهور في موضع واحد.
 *
 * لها **مساران** — الملفّ الشخصيّ والمحادثة — وتكرار الشرط فيهما يعني أن
 * إصلاحاً في أحدهما ينسى الآخر، فتظهر الشارة في المحادثة بعد أن أخفاها
 * صاحبها. والقاعدة هنا تُقرأ من الاثنين.
 */
/**
 * حالة شارة الخدمة الذاتية كما جاءت **من الخادم** — تقرؤها صفحة «ملفّك
 * الشخصيّ» لترسم مفاتيحها على الحقيقة لا على تخمين محلّيّ.
 */
/**
 * أيّ شارات إشراق **يستحقّها** هذا العضو — بصرف النظر عن إخفائها.
 *
 * 🔴 لا تُحسَب من `_getBadges`: ذاك يحترم `shouldShow`، فالشارة المخفيّة تسقط
 * منه ⇒ يسقط معها مفتاحُ إظهارها من صفحة «ملفّي»، فلا يستطيع صاحبها إعادتها
 * أبداً. المفتاح يجب أن يبقى ما دام الاستحقاق قائماً، لا ما دام الظهور قائماً.
 */
export function getEsharqEntitlements(userId: string) {
    return {
        tier: esharqTierOf(userId) !== null,
        user: isEsharqMember(userId),
        custom: userId in EsharqCustomBadges,
        selfserve: getSelfServeBadges(userId).length > 0
    };
}

export function getSelfServeBadges(userId: string) {
    const entry = EsharqSelfServeBadges[userId];
    if (entry == null) return [];

    // 🔴 مدخلٌ واحد اليوم (`live`)، والسجلّ مُهيّأ لعدّة (`badges`). تُقرأ
    // الاثنتان فتعمل الصفحة نفسها قبل تغيير الخادم وبعده — بدل صفحةٍ تُعاد
    // كتابتها يوم يصير للداعم شارتان.
    const list = Array.isArray((entry as any).badges) ? (entry as any).badges : [];
    const all = [...list, ...(entry.live ? [entry.live] : [])];

    return all
        .filter(b => typeof b?.image === "string" && b.image !== "")
        .map((b, i) => ({
            id: String(b.assetId ?? b.id ?? i),
            image: b.image as string,
            tooltip: (b.tooltip ?? "") as string,
            effect: (b.effect ?? "none") as string,
            surfaces: {
                profile: b.surfaces?.profile !== false,
                chat: b.surfaces?.chat !== false
            }
        }));
}

function selfServeVisible(userId: string, surface: "profile" | "chat"): boolean {
    const live = EsharqSelfServeBadges[userId]?.live;
    if (!live?.image) return false;
    // 🔴 مصدر الحقيقة **الخادم وحده**: `surfaces` تأتي مع بيانات الشارة
    // فيراها كل عميل. ولا إخفاء محلّيّ هنا — مفتاحٌ يُخفي الشارة عن صاحبه
    // وحده يوهمه أنه أخفاها عن الناس، وهو أسوأ من غياب المفتاح.
    return live.surfaces?.[surface] !== false;
}
let EsharqSelfServeBadges = {} as Record<string, SelfServeEntry>;

// Effects the client knows how to draw (see esharqBadges.css). Anything else — a typo, or a
// newer effect added server-side before a client update — falls back to no effect rather than
// rendering a broken badge, which is what keeps the JSON forward-compatible.
const SELF_SERVE_EFFECTS = ["gleam", "rgb", "pulse", "aurora", "silver"];

function selfServeClass(base: string, effect?: string): string {
    return effect && SELF_SERVE_EFFECTS.includes(effect) ? `${base} esharq-fx-${effect}` : base;
}

async function loadBadges(url: string, noCache = false) {
    const init = {} as RequestInit;
    if (noCache) init.cache = "no-cache";

    return await fetch(url, init).then(r => r.json());
}

async function loadAllBadges(noCache = false) {
    const vencordBadges = await loadBadges("https://badges.vencord.dev/badges.json", noCache);
    // صور «مخصّص» لكلّ عضو (معرّف ← صورة + نصّ التمرير).
    const esharqCustom = await loadBadges("https://raw.githubusercontent.com/LOSTSTR/Esharq-Bored/main/badges/custom/custom.json", noCache);
    // رتب إشراق. تُمنَح وتُسحَب بتحرير team.json وحده — بلا إعادة بناء.
    // معزولة بـcatch حتى لا يُسقِط ملفٌّ مفقود أو تالف بقيّة الشارات.
    const esharqTeam = await loadBadges("https://raw.githubusercontent.com/LOSTSTR/Esharq-Bored/main/team.json", noCache).catch(() => null);
    // الشارة الذاتية للداعمين. معزولة بـcatch لأنّ الملفّ لا يوجد قبل أوّل موافقة —
    // و404 يجب ألّا يُعطّل بقيّة المجموعات.
    const esharqSelfServe = await loadBadges("https://raw.githubusercontent.com/LOSTSTR/Esharq-Bored/main/badges/selfserve.json", noCache).catch(() => null);
    // قائمة أعضاء إشراق. معزولة بـcatch: الملفّ لا يوجد قبل أوّل مزامنة، و404
    // يجب أن يترك بقيّة الشارات تعمل ويترك الفحص المحليّ يتولّى الأمر.
    const esharqMembers = await loadBadges("https://raw.githubusercontent.com/LOSTSTR/Esharq-Bored/main/badges/user/members.json", noCache).catch(() => null);
    // تفضيلات الإظهار. معزولة بـcatch: الملفّ لا يوجد حتى يُغيّر أوّل عضو شيئاً،
    // وغيابه يعني «الكلّ ظاهر» وهو الافتراض الصحيح.
    const esharqVisibility = await loadBadges("https://raw.githubusercontent.com/LOSTSTR/Esharq-Bored/main/badges/visibility.json", noCache).catch(() => null);

    DonorBadges = vencordBadges;
    EsharqCustomBadges = esharqCustom;
    EsharqSelfServeBadges = esharqSelfServe ?? {};
    EsharqVisibility = (esharqVisibility && typeof esharqVisibility === "object") ? esharqVisibility as typeof EsharqVisibility : {};
    // ملفّ تالف أو ناقص يترك المجموعة السابقة كما هي بدل أن يمحوها.
    const members = esharqMembers as { fp?: unknown; prefix?: unknown; chars?: unknown; } | null;
    if (Array.isArray(members?.fp)) {
        EsharqMemberFingerprints = new Set(members.fp.filter((x): x is string => typeof x === "string"));
        // البادئة والطول يأتيان مع البيانات، فتغييرهما لاحقاً لا يحتاج إعادة بناء.
        if (typeof members.prefix === "string") EsharqHashPrefix = members.prefix;
        if (typeof members.chars === "number" && members.chars >= 8 && members.chars <= 64) {
            EsharqHashChars = members.chars;
        }
        fingerprintCache.clear();
    }
    setEsharqTeam(esharqTeam);

    // واجهات قديمة (بطاقة الشكر، showBadgesInChat، api/Badges) كانت تقرأ خريطة
    // المتبرّعين. رتبة «داعم» حلّت محلّها، فتُشتقّ الخريطة منها بدل أن تُحذف
    // فتختفي الميزة صامتةً. صورة العضو المخصّصة تسبق صورة الرتبة إن وُجدت.
    const supporterIds: string[] = Array.isArray(esharqTeam?.supporter) ? esharqTeam.supporter : [];
    const supporters: Record<string, Array<Record<"tooltip" | "badge", string>>> = {};
    for (const id of supporterIds) {
        if (typeof id !== "string") continue;
        const own = EsharqCustomBadges[id];
        supporters[id] = [{
            tooltip: own?.tooltip || ESHARQ_TIER_META.supporter.label,
            badge: own?.image || tierIcon("supporter")
        }];
    }
    EsharqDonorBadges = supporters;
    // 🔴 **لا تُطعَم `EquicordDonorBadges`**: `api/Badges.ts` يرسمها شارةَ ملفٍّ
    // بنفسها (`getEquicordDonorBadges`)، فوضع داعمينا فيها يرسم صورة الرتبة
    // مرّةً ثانيةً بجوار شارة الرتبة — شارتان متطابقتان لكلّ داعم. رُئي على
    // ملفّ عضو حيّ. تبقى فارغةً: متبرّعو إيكوكورد ليسوا داعمينا.
}

let intervalId: any;

export function BadgeContextMenu({ badge }: { badge: Omit<ProfileBadge, "id"> & BadgeUserArgs; }) {
    return (
        <Menu.Menu
            navId="vc-badge-context"
            onClose={ContextMenuApi.closeContextMenu}
            aria-label="Badge Options"
        >
            {badge.description && (
                <Menu.MenuItem
                    id="vc-badge-copy-name"
                    label={t("نسخ اسم الشارة", "Copy Badge Name")}
                    action={() => copyWithToast(badge.description!)}
                    leadingAccessory={{ type: "icon", icon: CopyIcon }}
                />
            )}
            {badge.iconSrc && (
                <Menu.MenuItem
                    id="vc-badge-copy-link"
                    label={t("نسخ رابط صورة الشارة", "Copy Badge Image Link")}
                    action={() => copyWithToast(badge.iconSrc!)}
                    leadingAccessory={{ type: "icon", icon: LinkIcon }}
                />
            )}
        </Menu.Menu>
    );
}

export default definePlugin({
    name: "BadgeAPI",
    description: "API to add badges to users",
    authors: [Devs.Megu, Devs.Ven, Devs.TheSun],
    required: true,
    dependencies: ["MessageDecorationsAPI"],
    patches: [
        {
            find: "#{intl::PROFILE_USER_BADGES}",
            replacement: [
                {
                    match: /alt:" ","aria-hidden":!0,src:.{0,50}(\i).iconSrc/,
                    replace: "...$1.props,$&"
                },
                // Path with 2026-04-badge-discovery OFF
                {
                    match: /(?<=forceOpen:.{0,40}?ariaHidden:!0,)children:(?=.{0,50}?(\i)\.id)/,
                    replace: "children:$1.component?$self.renderBadgeComponent({...$1}):"
                },
                // Path with 2026-04-badge-discovery ON
                {
                    match: /(?<=fallbackIconSrc:.{0,50}?)children:(?=.{0,50}?(\i)\.id)/,
                    replace: "children:$1.component?$self.renderBadgeComponent({...$1}):"
                },
                // handle onClick and onContextMenu
                {
                    match: /href:(\i)\.link/,
                    replace: "...$self.getBadgeMouseEventHandlers($1),$&"
                }
            ]
        },
        {
            find: "getLegacyUsername(){",
            replacement: {
                match: /getBadges\(\)\{.{0,100}?return\[/,
                replace: "$&...$self.getBadges(this),"
            }
        }
    ],

    // for access from the console or other plugins
    get DonorBadges() {
        return DonorBadges;
    },

    get EquicordDonorBadges() {
        return EquicordDonorBadges;
    },

    get EsharqDonorBadges() {
        return EsharqDonorBadges;
    },

    toolboxActions: {
        async "Refetch Badges"() {
            await loadAllBadges(true);
            Toasts.show({
                id: Toasts.genId(),
                message: t("تمت إعادة جلب الشارات بنجاح!", "Successfully refetched badges!"),
                type: Toasts.Type.SUCCESS
            });
        }
    },

    // Listed in reverse display order: every START badge is unshifted, so the last one here
    // ends up first. This puts the Esharq Developer badge first, then the Custom badge.
    // 🔴 القائمة **بعكس ترتيب العرض**: كل شارة START تُدسّ في الأوّل، فآخر ما
    // هنا يظهر أوّلاً. المطلوب: شارات إشراق (الرتبة ثمّ المستخدم) قبل الصور
    // التي يختارها الأعضاء (المخصّصة ثمّ الذاتية).
    userProfileBadges: [UserPluginContributorBadge, EquicordContributorBadge, ContributorBadge, EsharqSelfServeBadge, EsharqCustomBadge, EsharqUserBadge, EsharqTierBadge],

    async start() {
        // يلتقط الرابط الموقَّع من ردّ /badge حتى يعمل التحكّم العامّ من داخل
        // التطبيق. مرشِّحٌ على معرّف المُرسِل، ولا يُكتب شيء على القرص.
        startLinkCapture();
        await loadAllBadges();
        clearInterval(intervalId);
        intervalId = setInterval(loadAllBadges, 1000 * 60 * 30); // 30 minutes

        // شارة واحدة لكلّ عضو في المحادثة: رتبته. لا تُكدَّس شارتان بجانب الاسم.
        addMessageDecoration("esharq-tier", ({ message }) => {
            const id = message?.author?.id ?? "";
            return esharqTierOf(id) && badgeVisible(id, "tier", "chat")
                ? <EsharqTierChatBadge userId={id} /> : null;
        });
        addMessageDecoration("esharq-custom", ({ message }) => {
            const id = message?.author?.id ?? "";
            return id in EsharqCustomBadges && badgeVisible(id, "custom", "chat")
                ? <EsharqCustomChatBadge userId={id} /> : null;
        });
        addMessageDecoration("esharq-selfserve", ({ message }) => {
            const id = message?.author?.id ?? "";
            return selfServeVisible(id, "chat") ? <EsharqSelfServeChatBadge userId={id} /> : null;
        });
    },

    async stop() {
        clearInterval(intervalId);
        stopLinkCapture();
        // الأسماء هنا يجب أن تطابق ما سُجّل في start() بالضبط. كانت تُزيل زخارف
        // «مطوّر/متبرّع/مساهم» التي زالت مع الرتب القديمة، وتترك «الرتبة» معلّقة.
        removeMessageDecoration("esharq-tier");
        removeMessageDecoration("esharq-custom");
        removeMessageDecoration("esharq-selfserve");
    },

    getBadges(profile: { userId: string; guildId: string; }) {
        if (!profile) return [];

        try {
            return _getBadges(profile);
        } catch (e) {
            new Logger("BadgeAPI#getBadges").error(e);
            return [];
        }
    },

    renderBadgeComponent: ErrorBoundary.wrap((badge: ProfileBadge & BadgeUserArgs) => {
        const Component = badge.component!;
        return <Component {...badge} />;
    }, { noop: true }),

    getBadgeMouseEventHandlers(badge: ProfileBadge & BadgeUserArgs) {
        const handlers = {} as Record<string, (e: React.MouseEvent) => void>;

        if (!badge) return handlers; // sanity check

        const { onClick, onContextMenu } = badge;

        if (onClick) handlers.onClick = e => onClick(e, badge);
        if (onContextMenu) handlers.onContextMenu = e => onContextMenu(e, badge);

        return handlers;
    },

    getDonorBadges(userId: string) {
        return DonorBadges[userId]?.map((badge, idx) => ({
            id: `vencord_donor_badge_${idx}`,
            iconSrc: badge.badge,
            description: badge.tooltip,
            position: BadgePosition.START,
            props: {
                style: {
                    borderRadius: "50%",
                    transform: "scale(0.9)" // The image is a bit too big compared to default badges
                }
            },
            onContextMenu(event, badge) {
                ContextMenuApi.openContextMenu(event, () => <BadgeContextMenu badge={badge} />);
            },
            onClick() {
                return VencordDonorModal();
            },
        } satisfies ProfileBadge));
    },

    getEquicordDonorBadges(userId: string) {
        return EquicordDonorBadges[userId]?.map((badge, idx) => ({
            id: `equicord_donor_badge_${idx}`,
            iconSrc: badge.badge,
            description: badge.tooltip,
            position: BadgePosition.START,
            props: {
                style: {
                    borderRadius: "50%",
                    transform: "scale(0.9)" // The image is a bit too big compared to default badges
                }
            },
            onContextMenu(event, badge) {
                ContextMenuApi.openContextMenu(event, () => <BadgeContextMenu badge={badge} />);
            },
            onClick() {
                return badge.tooltip === "Equicord Translator" ? EquicordTranslatorModal() : EquicordDonorModal();
            },
        } satisfies ProfileBadge));
    }
});
