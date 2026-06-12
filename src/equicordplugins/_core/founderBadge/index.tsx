/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addProfileBadge, BadgePosition, BadgeUserArgs, ProfileBadge, removeProfileBadge } from "@api/Badges";
import definePlugin from "@utils/types";

import { FOUNDERS_IMAGE } from "./image";

const BADGE_ID = "esharq-founder";
const NAME = "Esharq Staff · إدارة إِشراق";

// ─── Authorized IDs — هذه الشارة الخاصة تظهر فقط لهؤلاء ──────────────────────
const FOUNDER_IDS: ReadonlySet<string> = new Set([
    "681465758127226900",
    "1072961475125182564",
    "538699316232060938",
    "1046545292100653177",
    "683031548672606264",
    "1161389239112568902",
    "1295464673264664747",
]);

const profileBadge: ProfileBadge = {
    id: BADGE_ID,
    key: BADGE_ID,
    description: NAME,
    // Discord 1.0.9241 broke Equicord's component-badge render patch in the profile
    // popout, so we render via iconSrc (Discord's native <img>). Only `style` reliably
    // reaches that <img> (Discord overrides className), but inline styles block CSS
    // :hover — so spacing stays here and all visual polish (glow/hover/transition/conic
    // frame) lives in styles.css, targeted via the badge's aria-label. The crest's ring
    // is part of the image. The in-chat MessageDecoration is a separate path.
    iconSrc: FOUNDERS_IMAGE,
    props: { style: { margin: "0 2px" } },
    position: BadgePosition.START,
    shouldShow: ({ userId }: BadgeUserArgs) => FOUNDER_IDS.has(userId),
};

// required: true → cannot be disabled; hidden: true → not listed in settings
export default definePlugin({
    name: "EsharqFounderBadge",
    description: "Special Esharq staff badge",
    authors: [],
    required: true,
    hidden: true,
    dependencies: ["BadgeAPI"],

    start() {
        addProfileBadge(profileBadge);
    },

    stop() {
        removeProfileBadge(profileBadge);
    },
});
