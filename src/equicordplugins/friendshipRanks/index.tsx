/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { BadgePosition, BadgeUserArgs } from "@api/Badges";
import { Badges } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { Paragraph } from "@components/Paragraph";
import { Devs, EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { RenderModalProps } from "@vencord/discord-types";
import { Forms, Modal, openModal, RelationshipStore, Tooltip, useStateFromStores } from "@webpack/common";

interface rankInfo {
    title: string;
    description: string;
    requirement: number;
    iconSrc: string;
}

const cl = classNameFactory("vc-friendship-ranks-");

const settings = definePluginSettings({
    showFriendsInChat: {
        type: OptionType.BOOLEAN,
        description: "Show a friend icon on messages from friends.",
        default: false,
    },
});

function daysSince(dateString: string): number {
    const date = new Date(dateString);
    const currentDate = new Date();

    const differenceInMs = currentDate.getTime() - date.getTime();

    const days = differenceInMs / (1000 * 60 * 60 * 24);

    return Math.floor(days);
}

const ranks: rankInfo[] =
    [
        {
            title: t("برعم", "Sprout"),
            description: t("صداقتكما في بدايتها", "Your friendship is just beginning"),
            requirement: 0,
            iconSrc: "https://equicord.org/assets/plugins/friendshipRanks/sprout.png"
        },
        {
            title: t("مُزهِر", "Blooming"),
            description: t("صداقتكما في تقدم! (شهر واحد)", "Your friendship is progressing! (one month)"),
            requirement: 30,
            iconSrc: "https://equicord.org/assets/plugins/friendshipRanks/blooming.png"
        },
        {
            title: t("مُتّقِد", "Burning"),
            description: t("وصلت صداقتكما إلى سرعة قصوى (3 أشهر)", "Your friendship has reached full speed (3 months)"),
            requirement: 90,
            iconSrc: "https://equicord.org/assets/plugins/friendshipRanks/burning.png"
        },
        {
            title: t("مقاتل", "Fighter"),
            description: t("صداقتكما قوية (6 أشهر)", "Your friendship is strong (6 months)"),
            requirement: 182.5,
            iconSrc: "https://equicord.org/assets/plugins/friendshipRanks/fighter.png"
        },
        {
            title: t("نجم", "Star"),
            description: t("استمرت صداقتكما لفترة طويلة (سنة كاملة)", "Your friendship has lasted a long time (a full year)"),
            requirement: 365,
            iconSrc: "https://equicord.org/assets/plugins/friendshipRanks/star.png"
        },
        {
            title: t("ملكي", "Royal"),
            description: t("مرّت صداقتكما بالسرّاء والضرّاء - سنتان كاملتان!", "Your friendship has been through thick and thin - two full years!"),
            requirement: 730,
            iconSrc: "https://equicord.org/assets/plugins/friendshipRanks/royal.png"
        },
        {
            title: t("أعزّ الأصدقاء", "Besties"),
            description: t("كيف تمكنتما من ذلك؟! (5 سنوات)", "How did you manage that?! (5 years)"),
            requirement: 1826.25,
            iconSrc: "https://equicord.org/assets/plugins/friendshipRanks/besties.png"
        }
    ];

function openRankModal(rank: rankInfo) {
    openModal((props: RenderModalProps) => (
        <ErrorBoundary>
            <Modal
                {...props}
                size="sm"
                title={
                    <Flex className={cl("flex")}>
                        <Forms.FormTitle
                            className={cl("img")}
                            tag="h2"
                        >
                            <img src={rank.iconSrc} alt="rank icon" />
                            {rank.title}
                        </Forms.FormTitle>
                    </Flex>
                }
            >
                <div className={cl("text")}>
                    <Paragraph>
                        {rank.description}
                    </Paragraph>
                </div>
            </Modal>
        </ErrorBoundary >
    ));
}

function shouldShowBadge(userId: string, requirement: number, index: number) {
    if (!RelationshipStore.isFriend(userId)) return false;

    const days = daysSince(RelationshipStore.getSince(userId));

    if (ranks[index + 1] == null) return days > requirement;

    return (days > requirement && days < ranks[index + 1].requirement);
}

function getBadgesToApply() {
    return ranks.map((rank, index) => {
        return ({
            id: `friendship_ranks_badge_${index}`,
            description: rank.title,
            iconSrc: rank.iconSrc,
            position: BadgePosition.END,
            onClick: () => openRankModal(rank),
            shouldShow: (info: BadgeUserArgs) => shouldShowBadge(info.userId, rank.requirement, index),
            props: {
                style: {
                    borderRadius: "50%",
                    transform: "scale(0.9)"
                }
            },
        });
    });
}

const FriendDecoration = ErrorBoundary.wrap(({ userId }: { userId: string; }) => {
    const isFriend = useStateFromStores([RelationshipStore], () => RelationshipStore.isFriend(userId), [userId]);
    if (!isFriend) return null;

    return (
        <Tooltip text="Friend">
            {tooltipProps => (
                <span {...tooltipProps} className={cl("decoration")}>
                    <svg className={cl("icon")} aria-hidden="true" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M13 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                        <path fill="currentColor" d="M3 5v-.75C3 3.56 3.56 3 4.25 3s1.24.56 1.33 1.25C6.12 8.65 9.46 12 13 12h1a8 8 0 0 1 8 8 2 2 0 0 1-2 2 .21.21 0 0 1-.2-.15 7.65 7.65 0 0 0-1.32-2.3c-.15-.2-.42-.06-.39.17l.25 2c.02.15-.1.28-.25.28H9a2 2 0 0 1-2-2v-2.22c0-1.57-.67-3.05-1.53-4.37A15.85 15.85 0 0 1 3 5Z" />
                    </svg>
                </span>
            )}
        </Tooltip>
    );
}, { noop: true });

export default definePlugin({
    name: "FriendshipRanks",
    description: "Adds badges that show how long you have been friends with a user",
    tags: ["Friends"],
    authors: [Devs.Samwich, EquicordDevs.lucabeyer],
    settings,
    renderMessageDecoration({ message }) {
        if (!settings.store.showFriendsInChat || !message?.author) return null;
        return <FriendDecoration userId={message.author.id} />;
    },
    start() {
        getBadgesToApply().forEach(b => Badges.addProfileBadge(b));

    },
    stop() {
        getBadgesToApply().forEach(b => Badges.removeProfileBadge(b));
    },
});
