/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { BadgePosition, BadgeUserArgs } from "@api/Badges";
import { Badges } from "@api/index";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { Paragraph } from "@components/Paragraph";
import { Devs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { t } from "@utils/esharqI18n";
import definePlugin from "@utils/types";
import { RenderModalProps } from "@vencord/discord-types";
import { Forms, Modal,openModal, RelationshipStore } from "@webpack/common";

interface rankInfo {
    title: string;
    description: string;
    requirement: number;
    iconSrc: string;
}

const cl = classNameFactory("vc-friendship-ranks-");

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

export default definePlugin({
    name: "FriendshipRanks",
    description: "Adds badges that show how long you have been friends with a user",
    tags: ["Friends"],
    authors: [Devs.Samwich],
    start() {
        getBadgesToApply().forEach(b => Badges.addProfileBadge(b));

    },
    stop() {
        getBadgesToApply().forEach(b => Badges.removeProfileBadge(b));
    },
});
