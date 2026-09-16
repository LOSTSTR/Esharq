/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { isPluginEnabled } from "@api/PluginManager";
import ErrorBoundary from "@components/ErrorBoundary";
import showMeYourName from "@plugins/showMeYourName";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin from "@utils/types";
import type { ReactionEmoji, User } from "@vencord/discord-types";
import { GuildMemberStore, RelationshipStore } from "@webpack/common";

interface ReactionEvent {
    optimistic?: boolean;
    channelId: string;
    messageId: string;
    userId: string;
    emoji: ReactionEmoji;
}

interface ReactionUserRowProps {
    user?: User;
    guildId?: string | null;
    isHovered?: boolean;
    channelId?: string;
    messageId?: string;
    message?: {
        id: string;
        channel_id?: string;
        channelId?: string;
    };
    emoji?: ReactionEmoji;
    reaction?: {
        emoji?: ReactionEmoji;
    };
}

const MAX_TIMESTAMPS = 2000;

const timestamps = new Map<string, number>();
const formatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "medium"
});

function getEmojiKey(emoji: ReactionEmoji) {
    return `${emoji.name}:${emoji.id ?? ""}`;
}

function getKey(channelId: string, messageId: string, userId: string, emoji: ReactionEmoji) {
    return `${channelId}:${messageId}:${userId}:${getEmojiKey(emoji)}`;
}

function rememberTimestamp(channelId: string, messageId: string, userId: string, emoji: ReactionEmoji) {
    timestamps.set(getKey(channelId, messageId, userId, emoji), Date.now());

    if (timestamps.size <= MAX_TIMESTAMPS) return;

    const oldestKey = timestamps.keys().next().value;
    if (oldestKey) timestamps.delete(oldestKey);
}

function getTimestamp(props: ReactionUserRowProps) {
    const userId = props.user?.id;
    const channelId = props.channelId ?? props.message?.channel_id ?? props.message?.channelId;
    const messageId = props.messageId ?? props.message?.id;
    const emoji = props.emoji ?? props.reaction?.emoji;
    if (!userId || !channelId || !messageId || !emoji) return;

    const timestamp = timestamps.get(getKey(channelId, messageId, userId, emoji));
    return timestamp ? formatter.format(timestamp) : undefined;
}

// 🔴 الاسم الذي كانت ديسكورد سترسمه: بلا لقب الخادم يظهر الاسم العامّ مكان ما يعرفه الأعضاء،
// ولقب الصديق يُعتبَر خارج الخوادم فقط كما في typingTweaks
function getFallbackName(user: User, guildId?: string | null) {
    return (guildId && GuildMemberStore.getNick(guildId, user.id))
        || (!guildId && RelationshipStore.getNickname(user.id))
        || user.globalName
        || user.username;
}

// 🔴 مكوّنٌ مستقلّ لأنّ دالّة ShowMeYourName تنادي settings.use: تبديل تفعيلها يُبدّل نوع العنصر
// فيُعاد تركيبه بدل أن يتغيّر عدد الخطافات في المكوّن نفسه
function ShowMeYourNameReactionName({ user, guildId, isHovered }: { user: User; guildId?: string | null; isHovered?: boolean; }) {
    const element = showMeYourName.getTypingMemberListProfilesReactionsVoiceNameElement({
        user,
        guildId: guildId ?? undefined,
        type: "reactionsPopout",
        isHovered
    });

    // null يعني أنّ ShowMeYourName لا تغيّر أسماء النافذة (إعداد reactions مطفأ)
    return element ?? <span>{getFallbackName(user, guildId)}</span>;
}

function ReactionName(props: ReactionUserRowProps) {
    const timestamp = getTimestamp(props);
    const { user, guildId, isHovered } = props;
    if (!user) return null;

    return (
        <div className="vc-reaction-timestamps-name">
            {isPluginEnabled(showMeYourName.name)
                ? <ShowMeYourNameReactionName user={user} guildId={guildId} isHovered={isHovered} />
                : <span>{getFallbackName(user, guildId)}</span>}
            {timestamp ? <span className="vc-reaction-timestamps-time">
                {t(`${user.username ?? user.id} في ${timestamp}`, `${user.username ?? user.id} at ${timestamp}`)}
            </span> : null}
        </div>
    );
}

const ReactionNameBoundary = ErrorBoundary.wrap(ReactionName, { noop: true });

export default definePlugin({
    name: "ReactionTimestamps",
    description: "Shows each reaction time in the reaction popout.",
    authors: [EquicordDevs.Kurt],
    tags: ["Reactions", "Chat"],

    patches: [
        {
            find: ".MESSAGE,userId:",
            replacement: {
                match: /(?<=Child,{className:\i\.\i,children:)/,
                // 🔴 الناتج عنصرٌ دائماً ولا يكون nullish أبداً: لو سقط `??` إلى استدعاء ShowMeYourName
                // المُدرَج بعده لنادى خطافاتها مشروطاً داخل صفّ ديسكورد فيرمي React «Rendered fewer hooks».
                // لذا نرسم اسمها داخل مكوّننا، ونمرّر smynHovered الذي تعرّفه رقعتها في الصفّ نفسه
                // (typeof تحمي حين تكون مطفأة فلا يوجد المتغيّر)
                replace: "$self.renderReactionName(arguments[0],typeof smynHovered!==\"undefined\"&&smynHovered)??"
            }
        }
    ],

    flux: {
        MESSAGE_REACTION_ADD(event: ReactionEvent) {
            if (event.optimistic) return;

            rememberTimestamp(event.channelId, event.messageId, event.userId, event.emoji);
        },

        MESSAGE_REACTION_REMOVE(event: ReactionEvent) {
            timestamps.delete(getKey(event.channelId, event.messageId, event.userId, event.emoji));
        }
    },

    renderReactionName(props: ReactionUserRowProps, isHovered: boolean) {
        return <ReactionNameBoundary {...props} isHovered={isHovered} />;
    },

    stop() {
        timestamps.clear();
    }
});
