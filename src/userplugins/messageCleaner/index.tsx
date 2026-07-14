/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { BanRiskWarning } from "@utils/esharqBanWarning";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { Channel, Message } from "@vencord/discord-types";
import { ChannelStore, Menu, RestAPI, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    warning: {
        type: OptionType.COMPONENT,
        component: () => <BanRiskWarning
            ar="تحذير: الحذف الجماعي للرسائل عبر الواجهة البرمجية قد يصطدم بحدود المعدّل وقد يُعرّض حسابك للتقييد/الحظر رغم التهدئة الذكية. استخدمها بمسؤولية."
            en="Warning: bulk-deleting messages via the API can hit rate limits and may risk account restriction/ban despite the smart throttling. Use responsibly."
        />,
    },
    enabled: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل إضافة MessageCleaner", "Enable the MessageCleaner plugin"),
        default: true
    },
    targetChannelId: {
        type: OptionType.STRING,
        description: t("معرّف القناة المراد تنظيفها (اتركه فارغاً لاستخدام قائمة السياق)", "Channel ID to clean (leave empty to use the context menu)"),
        default: ""
    },
    delayBetweenDeletes: {
        type: OptionType.SLIDER,
        description: t("التأخير بين كل حذف (مللي ثانية) — لتجنّب حدود المعدّل", "Delay between each deletion (ms) — to avoid rate limiting"),
        default: 1000,
        markers: [100, 500, 1000, 2000, 5000],
        minValue: 100,
        maxValue: 10000,
        stickToMarkers: false
    },
    batchSize: {
        type: OptionType.SLIDER,
        description: t("عدد الرسائل المُعالَجة في كل دفعة", "Number of messages to process per batch"),
        default: 50,
        markers: [10, 25, 50, 100],
        minValue: 1,
        maxValue: 100,
        stickToMarkers: false
    },
    showProgress: {
        type: OptionType.BOOLEAN,
        description: t("عرض التقدّم في الوقت الحقيقي", "Show progress in real time"),
        default: true
    },
    debugMode: {
        type: OptionType.BOOLEAN,
        description: t("وضع التصحيح (سجلّات مفصّلة)", "Debug mode (detailed logs)"),
        default: false
    },
    skipSystemMessages: {
        type: OptionType.BOOLEAN,
        description: t("تجاهل رسائل النظام (انضمام/مغادرة، إلخ)", "Ignore system messages (join/leave, etc.)"),
        default: true
    },
    skipReplies: {
        type: OptionType.BOOLEAN,
        description: t("تجاهل الردود على الرسائل", "Ignore message replies"),
        default: false
    },
    maxAge: {
        type: OptionType.SLIDER,
        description: t("أقصى عمر للرسالة المراد حذفها (أيام، 0 = بلا حدّ)", "Maximum message age to delete (days, 0 = no limit)"),
        default: 0,
        markers: [0, 1, 7, 30, 90],
        minValue: 0,
        maxValue: 365,
        stickToMarkers: false
    }
});

let isCleaningInProgress = false;
let shouldStopCleaning = false;
let cleaningStats = { total: 0, deleted: 0, failed: 0, skipped: 0, startTime: 0 };

function log(message: string, level: "info" | "warn" | "error" = "info") {
    const prefix = `[MessageCleaner ${new Date().toLocaleTimeString()}]`;
    switch (level) {
        case "warn": console.warn(prefix, message); break;
        case "error": console.error(prefix, message); break;
        default: console.log(prefix, message);
    }
}

function debugLog(message: string) {
    if (settings.store.debugMode) log(`🔍 ${message}`, "info");
}

function canDeleteMessage(message: Message, currentUserId: string): boolean {
    try {
        if (message.author?.id !== currentUserId) return false;
        if (settings.store.skipSystemMessages && message.type !== 0 && message.type !== 19) return false;

        const isReply = message.type === 19 || !!message.messageReference || !!(message as any).message_reference;
        if (isReply && settings.store.skipReplies) return false;

        if (settings.store.maxAge > 0) {
            let messageTime: number;
            if (typeof message.timestamp === "string") messageTime = new Date(message.timestamp).getTime();
            else if (typeof message.timestamp === "number") messageTime = message.timestamp;
            else return false;

            if (isNaN(messageTime) || messageTime <= 0) return false;
            const messageAge = Date.now() - messageTime;
            const maxAgeMs = settings.store.maxAge * 24 * 60 * 60 * 1000;
            if (messageAge > maxAgeMs) return false;
        }

        return true;
    } catch {
        return false;
    }
}

async function deleteMessage(channelId: string, messageId: string): Promise<boolean> {
    try {
        await RestAPI.del({ url: `/channels/${channelId}/messages/${messageId}` });
        return true;
    } catch (error: any) {
        const statusCode = error?.status || error?.statusCode || "N/A";
        debugLog(`❌ Error suppression ${messageId}: status ${statusCode}`);
        return false;
    }
}

async function getChannelMessages(channelId: string, before?: string): Promise<Message[]> {
    try {
        const url = before
            ? `/channels/${channelId}/messages?limit=${settings.store.batchSize}&before=${before}`
            : `/channels/${channelId}/messages?limit=${settings.store.batchSize}`;
        const response = await RestAPI.get({ url });
        if (!response || !response.body) return [];
        return Array.isArray(response.body) ? response.body : [];
    } catch (error: any) {
        const statusCode = error?.status || error?.statusCode || "N/A";
        log(`❌ Error récupération messages: status ${statusCode}`, "error");
        return [];
    }
}

async function cleanChannel(channelId: string) {
    if (!settings.store.enabled || isCleaningInProgress) return;

    try {
        const channel = ChannelStore.getChannel(channelId);
        const currentUserId = UserStore.getCurrentUser()?.id;
        if (!channel || !currentUserId) return;

        const channelName = channel.name || "Private channel";
        log(`🧹 Starting cleanup of "${channelName}"`);

        isCleaningInProgress = true;
        shouldStopCleaning = false;
        cleaningStats = { total: 0, deleted: 0, failed: 0, skipped: 0, startTime: Date.now() };

        let lastMessageId: string | undefined;
        let totalProcessed = 0;

        while (!shouldStopCleaning) {
            try {
                const messages = await getChannelMessages(channelId, lastMessageId);
                if (messages.length === 0) { log("Plus de messages à traiter"); break; }

                const validMessages = messages.filter(msg => canDeleteMessage(msg, currentUserId));
                cleaningStats.total += validMessages.length;

                if (validMessages.length === 0) {
                    lastMessageId = messages[messages.length - 1].id;
                    cleaningStats.skipped += messages.length;
                    if (messages.length < settings.store.batchSize) break;
                    continue;
                }

                for (const message of validMessages) {
                    if (shouldStopCleaning) { log("Arrêt demandé par l'utilisateur"); break; }

                    const success = await deleteMessage(channelId, message.id);
                    if (success) cleaningStats.deleted++;
                    else cleaningStats.failed++;

                    totalProcessed++;
                    if (settings.store.delayBetweenDeletes > 0) {
                        await new Promise(resolve => setTimeout(resolve, settings.store.delayBetweenDeletes));
                    }
                }

                cleaningStats.skipped += messages.filter(msg => !canDeleteMessage(msg, currentUserId)).length;
                lastMessageId = messages[messages.length - 1].id;
                if (messages.length < settings.store.batchSize) break;

            } catch (error: any) {
                const statusCode = error?.status || error?.statusCode || "N/A";
                log(`❌ Error dans la boucle: status ${statusCode}`, "error");
                cleaningStats.failed++;

                if (statusCode === 429) {
                    log("Rate limit atteint, pause 30s...", "warn");
                    await new Promise(resolve => setTimeout(resolve, 30000));
                } else {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }

                if (cleaningStats.failed > 15) { log("Trop d'errors, arrêt", "error"); break; }
            }
        }

        isCleaningInProgress = false;
        const { deleted, failed, skipped } = cleaningStats;
        const totalTime = Date.now() - cleaningStats.startTime;
        const timeStr = totalTime < 60000 ? `${Math.round(totalTime / 1000)}s` : `${Math.round(totalTime / 60000)}min`;
        log(`✅ Nettoyage terminé: ${deleted} supprimés, ${failed} échecs, ${skipped} ignorés — ${timeStr}`);

    } catch (error) {
        isCleaningInProgress = false;
        log(`❌ Error globale: ${error}`, "error");
    }
}

async function cleanGuild(guildId: string) {
    if (!settings.store.enabled || isCleaningInProgress) return;

    try {
        const currentUserId = UserStore.getCurrentUser()?.id;
        if (!currentUserId) return;

        log(`🧹 Starting cleanup of guild ${guildId}`);

        isCleaningInProgress = true;
        shouldStopCleaning = false;
        cleaningStats = { total: 0, deleted: 0, failed: 0, skipped: 0, startTime: Date.now() };

        let maxId: string | undefined;
        let totalProcessed = 0;

        while (!shouldStopCleaning) {
            try {
                let url = `/guilds/${guildId}/messages/search?author_id=${currentUserId}`;
                if (maxId) url += `&max_id=${maxId}`;

                const response = await RestAPI.get({ url });
                if (!response || !response.body || !response.body.messages || response.body.messages.length === 0) {
                    log("Plus de messages à traiter dans le serveur");
                    break;
                }

                let messages: any[] = [];
                for (const group of response.body.messages) {
                    for (const msg of group) {
                        if (msg.author && msg.author.id === currentUserId) {
                            messages.push(msg);
                        }
                    }
                }

                // Unique messages
                const uniqueMsgs: Message[] = [];
                const seen = new Set<string>();
                for (const m of messages) {
                    if (!seen.has(m.id)) {
                        seen.add(m.id);
                        uniqueMsgs.push(m);
                    }
                }
                messages = uniqueMsgs;

                if (messages.length === 0) {
                    log("Aucun message trouvé dans ce lot.");
                    break; // or continue with offset? max_id should guarantee progress if we set it properly
                }

                // Find oldest ID for next pagination
                let oldestId = messages[0].id;
                for (const m of messages) {
                    if (BigInt(m.id) < BigInt(oldestId)) {
                        oldestId = m.id;
                    }
                }
                maxId = (BigInt(oldestId) - 1n).toString();

                const validMessages = messages.filter(msg => canDeleteMessage(msg, currentUserId));
                cleaningStats.total += validMessages.length;

                if (validMessages.length === 0) {
                    cleaningStats.skipped += messages.length;
                    continue;
                }

                for (const message of validMessages) {
                    if (shouldStopCleaning) { log("Arrêt demandé par l'utilisateur"); break; }

                    const channelId = message.channel_id;
                    if (!channelId) continue;

                    const success = await deleteMessage(channelId, message.id);
                    if (success) cleaningStats.deleted++;
                    else cleaningStats.failed++;

                    totalProcessed++;
                    if (settings.store.delayBetweenDeletes > 0) {
                        await new Promise(resolve => setTimeout(resolve, settings.store.delayBetweenDeletes));
                    }
                }

                cleaningStats.skipped += messages.filter(msg => !canDeleteMessage(msg, currentUserId)).length;

            } catch (error: any) {
                const statusCode = error?.status || error?.statusCode || "N/A";
                log(`❌ Error dans la boucle serveur: status ${statusCode}`, "error");
                cleaningStats.failed++;

                if (statusCode === 429) {
                    log("Rate limit atteint, pause 30s...", "warn");
                    await new Promise(resolve => setTimeout(resolve, 30000));
                } else if (statusCode === 403 || statusCode === 400) {
                    log("Impossible de chercher dans ce serveur (permissions ?)", "error");
                    break;
                } else {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }

                if (cleaningStats.failed > 15) { log("Trop d'erreurs, arrêt", "error"); break; }
            }
        }

        isCleaningInProgress = false;
        const { deleted, failed, skipped } = cleaningStats;
        const totalTime = Date.now() - cleaningStats.startTime;
        const timeStr = totalTime < 60000 ? `${Math.round(totalTime / 1000)}s` : `${Math.round(totalTime / 60000)}min`;
        log(`✅ Nettoyage du serveur terminé: ${deleted} supprimés, ${failed} échecs, ${skipped} ignorés — ${timeStr}`);

    } catch (error) {
        isCleaningInProgress = false;
        log(`❌ Error globale serveur: ${error}`, "error");
    }
}

function stopCleaning() {
    if (isCleaningInProgress) {
        shouldStopCleaning = true;
        log("⏹️ Arrêt du nettoyage demandé");
    }
}

const ChannelContextMenuPatch: NavContextMenuPatchCallback = (children, ctx: { channel?: Channel; } = {}) => {
    const { channel } = ctx;
    if (!channel) return;

    const group = findGroupChildrenByChildId("mark-channel-read", children) ?? children;
    if (!group) return;

    const menuItems: any[] = [<Menu.MenuSeparator key="separator" />];

    if (isCleaningInProgress) {
        const { total, deleted, failed, skipped } = cleaningStats;
        const processed = deleted + failed + skipped;
        const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

        menuItems.push(
            <Menu.MenuItem key="cleaning-status" id="vc-cleaning-status"
                label={t(`جارٍ التنظيف: % (/)`, `Cleaning: % (/)`)}
                color="brand" disabled={true} />,
            <Menu.MenuItem key="stop-cleaning" id="vc-stop-cleaning"
                label={t("إيقاف التنظيف", "Stop cleaning")} color="danger" action={stopCleaning} />
        );
    } else {
        menuItems.push(
            <Menu.MenuItem key="clean-messages" id="vc-clean-messages"
                label={t("تنظيف الرسائل", "Clean messages")} color="danger"
                action={() => cleanChannel(channel.id)} />
        );
    }

    group.push(...menuItems);
};

const GuildContextMenuPatch: NavContextMenuPatchCallback = (children, ctx: { guild?: any; } = {}) => {
    const { guild } = ctx;
    if (!guild) return;

    // Discord uses various IDs for guild context menus. We look for a common group like "mark-guild-read" or just append to children.
    const group = findGroupChildrenByChildId("mark-guild-read", children) ?? findGroupChildrenByChildId("hide-muted-channels", children) ?? children;
    if (!group) return;

    const menuItems: any[] = [<Menu.MenuSeparator key="separator-guild" />];

    if (isCleaningInProgress) {
        const { total, deleted, failed, skipped } = cleaningStats;
        const processed = deleted + failed + skipped;
        const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

        menuItems.push(
            <Menu.MenuItem key="cleaning-status-guild" id="vc-cleaning-status-guild"
                label={t(`جارٍ التنظيف: % (/)`, `Cleaning: % (/)`)}
                color="brand" disabled={true} />,
            <Menu.MenuItem key="stop-cleaning-guild" id="vc-stop-cleaning-guild"
                label={t("إيقاف التنظيف", "Stop cleaning")} color="danger" action={stopCleaning} />
        );
    } else {
        menuItems.push(
            <Menu.MenuItem key="clean-guild-messages" id="vc-clean-guild-messages"
                label={t("تنظيف كل رسائلي", "Clean all my messages")} color="danger"
                action={() => cleanGuild(guild.id)} />
        );
    }

    group.push(...menuItems);
};

export default definePlugin({
    name: "MessageCleaner",
    description: "Cleans all messages in a channel with smart rate limiting and statistics",
    authors: [{ name: "Bash", id: 1327483363518582784n }],
    dependencies: ["ContextMenuAPI"],
    settings,

    contextMenus: {
        "channel-context": ChannelContextMenuPatch,
        "gdm-context": ChannelContextMenuPatch,
        "user-context": ChannelContextMenuPatch,
        "guild-context": GuildContextMenuPatch
    },

    start() {
        log("🚀 Plugin MessageCleaner démarré");
    },

    stop() {
        log("🛑 Plugin MessageCleaner arrêté");
        if (isCleaningInProgress) shouldStopCleaning = true;
    }
});
