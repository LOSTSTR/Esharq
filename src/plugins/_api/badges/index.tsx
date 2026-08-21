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
import { openContributorModal } from "@components/settings/tabs";
import { Devs } from "@utils/constants";
import { copyWithToast } from "@utils/discord";
import { t } from "@utils/esharqI18n";
import { Logger } from "@utils/Logger";
import { isEsharqDev, setEsharqTeam, shouldShowContributorBadge, shouldShowEquicordContributorBadge, shouldShowEsharqContributorBadge, shouldShowEsharqDeveloperBadge } from "@utils/misc";
import definePlugin from "@utils/types";
import { ContextMenuApi, Menu, Toasts, Tooltip, UserStore } from "@webpack/common";

import Plugins, { PluginMeta } from "~plugins";

import { EquicordDonorModal, EquicordTranslatorModal, VencordDonorModal } from "./modals";

const CONTRIBUTOR_BADGE = "https://cdn.discordapp.com/emojis/1092089799109775453.png?size=64";
const EQUICORD_CONTRIBUTOR_BADGE = "https://equicord.org/assets/favicon.png";
const USERPLUGIN_CONTRIBUTOR_BADGE = "https://equicord.org/assets/icons/misc/userplugin.png";
const ESHARQ_DEVELOPER_BADGE = "https://raw.githubusercontent.com/LOSTSTR/Esharq-Bored/main/badges/developers/esharq.png";
const ESHARQ_CONTRIBUTOR_BADGE = "https://raw.githubusercontent.com/LOSTSTR/Esharq-Bored/main/badges/contributors/Esharq.png";

// Tooltips carry both languages at once. Visual polish (round image, spinning glow ring,
// hover scale) lives in esharqBadges.css, targeted via the aria-label — inline style would
// block the CSS :hover transform.
const EsharqDeveloperBadge: ProfileBadge = {
    id: "esharq_developer_badge",
    description: "مطوّر إشراق · Esharq Developer",
    iconSrc: ESHARQ_DEVELOPER_BADGE,
    position: BadgePosition.START,
    shouldShow: ({ userId }) => shouldShowEsharqDeveloperBadge(userId),
    onClick: (_, { userId }) => openContributorModal(UserStore.getUser(userId)),
    props: { style: { margin: "0 2px" } },
};

// The Developer badge also shows inline next to the name in chat (message decoration).
const EsharqDevChatBadge = () => (
    <span className="esharq-dev-chat-badge" role="img" aria-label="مطوّر إشراق · Esharq Developer">
        <img src={ESHARQ_DEVELOPER_BADGE} alt="" />
    </span>
);

// The Donor badge also shows inline in chat — the member's OWN donor image (per-user,
// from Esharq-Bored/badges.json) with the same Coin-Gleam gold glow as their profile badge.
const EsharqDonorChatBadge = ({ userId }: { userId: string; }) => {
    const badge = EsharqDonorBadges[userId]?.[0]?.badge;
    if (!badge) return null;
    return (
        <span className="esharq-donor-chat-badge" role="img" aria-label="متبرّع إشراق · Esharq Donor">
            <img src={badge} alt="" />
        </span>
    );
};

// The Contributor badge also shows inline in chat (message decoration), same idea as the
// Developer and Donor chat badges. It shows the FULL square art (no circular crop, no ring —
// the art carries its own fire/ice glow). Devs are excluded here since they already show the
// Developer chat badge, so a dev never gets two inline badges.
const EsharqContributorChatBadge = () => (
    <span className="esharq-contributor-chat-badge" role="img" aria-label="مساهم إشراق · Esharq Contributor">
        <img src={ESHARQ_CONTRIBUTOR_BADGE} alt="" />
    </span>
);

// Esharq Custom badges — a per-member image shown AS-IS (no ring/crop/text). Also shown
// inline in chat (message decoration) like the donor/contributor/developer badges; clicking
// opens the Esharq donor modal ("متبرّع إشراق"), and hovering shows ":3".
// Each member's image is mapped by Discord user id in
// Esharq-Bored/badges/custom/custom.json (loaded into EsharqCustomBadges).
const EsharqCustomBadge: ProfileBadge = {
    id: "esharq_custom_badge",
    description: "مخصّص · Esharq Custom",
    position: BadgePosition.START,
    shouldShow: ({ userId }) => userId in EsharqCustomBadges,
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
    // badge (present and future, any member in custom.json) open the Esharq donor modal on click.
};

// The Custom badge also shows inline in chat — the member's OWN image, shown as-is (no ring/
// crop, like its profile badge). Same idea as the donor/dev/contributor chat badges; hover
// reveals ":3" and clicking opens the Esharq donor modal.
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

// Esharq Contributor badge — a shared circular EA image with a spinning RGB ring. Granted to
// everyone in EsharqContributors (seeded with the whole dev team). Profile only. Uses iconSrc
// (not component) so Discord shows the description tooltip ("مساهم إشراق · Esharq Contributor"),
// same as the Developer badge; the RGB ring is applied via the aria-label CSS selector.
const EsharqContributorBadge: ProfileBadge = {
    id: "esharq_contributor_badge",
    description: "مساهم إشراق · Esharq Contributor",
    iconSrc: ESHARQ_CONTRIBUTOR_BADGE,
    position: BadgePosition.START,
    shouldShow: ({ userId }) => shouldShowEsharqContributorBadge(userId),
    onClick: (_, { userId }) => openContributorModal(UserStore.getUser(userId)),
    props: { style: { margin: "0 2px" } },
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
let EquicordDonorBadges = {} as Record<string, Array<Record<"tooltip" | "badge", string>>>;
// Esharq's own donors only (from Esharq-Bored). The merged set above is used to render badges;
// this one decides who sees the "thank you for donating" card, so Equicord donors don't trigger it.
let EsharqDonorBadges = {} as Record<string, Array<Record<"tooltip" | "badge", string>>>;
// Esharq Custom badges: Discord user id → { image, tooltip } (from Esharq-Bored/custom.json).
// Data-driven so a member's image AND hover text can change with NO rebuild (edit the JSON).
let EsharqCustomBadges = {} as Record<string, { image: string; tooltip?: string; }>;

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
export function getSelfServeBadge(userId: string) {
    const live = EsharqSelfServeBadges[userId]?.live;
    if (!live?.image) return null;
    return {
        image: live.image,
        tooltip: live.tooltip ?? "",
        effect: live.effect ?? "none",
        surfaces: {
            profile: live.surfaces?.profile !== false,
            chat: live.surfaces?.chat !== false
        }
    };
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
    // Esharq's own donor badges only. Equicord's donors are intentionally not pulled in to avoid
    // flooding Esharq with ~100 unrelated badges; Equicord devs/contributors keep their original
    // badges via the devs lists, which are untouched.
    const esharqBadges = await loadBadges("https://raw.githubusercontent.com/LOSTSTR/Esharq-Bored/main/badges.json", noCache);
    // Per-member Esharq Custom badge images (user id → image url).
    const esharqCustom = await loadBadges("https://raw.githubusercontent.com/LOSTSTR/Esharq-Bored/main/badges/custom/custom.json", noCache);
    // Esharq team ids (developers + extra contributors). Lets the Developer/Contributor
    // tiers be granted or revoked by editing team.json — no rebuild — same idea as the
    // donor/custom JSONs. Isolated with catch so a missing/malformed file leaves the
    // compiled seed in place (setEsharqTeam falls back) without breaking the other loads.
    const esharqTeam = await loadBadges("https://raw.githubusercontent.com/LOSTSTR/Esharq-Bored/main/team.json", noCache).catch(() => null);
    // Self-service supporter badges. Isolated with catch because this file does not exist until
    // the first badge is approved — a 404 must leave the other badge sets working.
    const esharqSelfServe = await loadBadges("https://raw.githubusercontent.com/LOSTSTR/Esharq-Bored/main/badges/selfserve.json", noCache).catch(() => null);

    DonorBadges = vencordBadges;
    EquicordDonorBadges = esharqBadges;
    EsharqDonorBadges = esharqBadges;
    EsharqCustomBadges = esharqCustom;
    EsharqSelfServeBadges = esharqSelfServe ?? {};
    setEsharqTeam(esharqTeam);
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
                />
            )}
            {badge.iconSrc && (
                <Menu.MenuItem
                    id="vc-badge-copy-link"
                    label={t("نسخ رابط صورة الشارة", "Copy Badge Image Link")}
                    action={() => copyWithToast(badge.iconSrc!)}
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
    userProfileBadges: [UserPluginContributorBadge, EquicordContributorBadge, ContributorBadge, EsharqContributorBadge, EsharqSelfServeBadge, EsharqCustomBadge, EsharqDeveloperBadge],

    async start() {
        await loadAllBadges();
        clearInterval(intervalId);
        intervalId = setInterval(loadAllBadges, 1000 * 60 * 30); // 30 minutes

        addMessageDecoration("esharq-dev", ({ message }) =>
            isEsharqDev(message?.author?.id ?? "") ? <EsharqDevChatBadge /> : null
        );
        addMessageDecoration("esharq-donor", ({ message }) => {
            const id = message?.author?.id ?? "";
            return EsharqDonorBadges[id]?.length ? <EsharqDonorChatBadge userId={id} /> : null;
        });
        addMessageDecoration("esharq-contributor", ({ message }) => {
            const id = message?.author?.id ?? "";
            return shouldShowEsharqContributorBadge(id) && !isEsharqDev(id) ? <EsharqContributorChatBadge /> : null;
        });
        addMessageDecoration("esharq-custom", ({ message }) => {
            const id = message?.author?.id ?? "";
            return id in EsharqCustomBadges ? <EsharqCustomChatBadge userId={id} /> : null;
        });
        addMessageDecoration("esharq-selfserve", ({ message }) => {
            const id = message?.author?.id ?? "";
            return selfServeVisible(id, "chat") ? <EsharqSelfServeChatBadge userId={id} /> : null;
        });
    },

    async stop() {
        clearInterval(intervalId);
        removeMessageDecoration("esharq-dev");
        removeMessageDecoration("esharq-donor");
        removeMessageDecoration("esharq-contributor");
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
