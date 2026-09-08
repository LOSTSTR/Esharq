/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { Constants, RestAPI } from "@webpack/common";

const logger = new Logger("ScamLinkDetector", "#ff4444");

const SCAM_LIST_URL = "https://raw.githubusercontent.com/Discord-AntiScam/scam-links/main/list.txt";

let scamLinks: Set<string> = new Set();
let lastFetchTime = 0;
let lastFailureTime = 0;
let fetchPromise: Promise<void> | null = null;
const CACHE_DURATION = 15 * 60 * 1000;
// A failed fetch must not disable the plugin for the rest of the session — but it must not
// re-hit the network on every single message either.
const RETRY_DELAY = 60 * 1000;

interface IMessageCreate {
    type: "MESSAGE_CREATE";
    optimistic: boolean;
    channelId: string;
    message: Message;
}

const urlRegex = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*)/gi;

const settings = definePluginSettings({
    enableDebugLogs: {
        type: OptionType.BOOLEAN,
        description: "Enable detailed debug logging in console",
        default: false
    },
    blockMessage: {
        type: OptionType.BOOLEAN,
        description: "Delete the message containing scam links",
        default: false
    },
    notifyInDMs: {
        type: OptionType.BOOLEAN,
        description: "Send warning notification in DMs instead of channel",
        default: false
    }
});

async function fetchScamList(): Promise<void> {
    const now = Date.now();
    // Fresh enough — nothing to do.
    if (scamLinks.size > 0 && now - lastFetchTime < CACHE_DURATION) return;
    // Failed recently — back off, but come back to it.
    if (now - lastFailureTime < RETRY_DELAY) return;

    if (fetchPromise) {
        if (settings.store.enableDebugLogs) {
            logger.debug("Fetch already in progress, waiting...");
        }
        await fetchPromise;
        return;
    }

    fetchPromise = (async () => {
        try {
            logger.info("Fetching scam link database...");
            const response = await fetch(SCAM_LIST_URL);

            if (!response.ok) {
                logger.error(`Failed to fetch scam list: ${response.status} ${response.statusText}`);
                lastFailureTime = Date.now();
                return;
            }

            const text = await response.text();
            const lines = text.split("\n")
                .map(line => line.trim().toLowerCase())
                .filter(line => line && !line.startsWith("#"));

            scamLinks = new Set(lines);
            lastFetchTime = Date.now();
            lastFailureTime = 0;

            logger.info(`Successfully loaded ${scamLinks.size} scam domains from AntiScam database`);
        } catch (error) {
            logger.error("Error fetching scam list:", error);
            lastFailureTime = Date.now();
        } finally {
            fetchPromise = null;
        }
    })();

    await fetchPromise;
}

function extractDomains(content: string): string[] {
    const urls = content.match(urlRegex) || [];
    const domains: string[] = [];

    if (settings.store.enableDebugLogs) {
        logger.debug(`Found ${urls.length} URL(s) in message:`, urls);
    }

    for (const url of urls) {
        try {
            let cleanedUrl = url.replace(/[)>.,;:!?'"]+$/, "");

            // Add protocol if missing for URL parsing
            if (!cleanedUrl.startsWith("http://") && !cleanedUrl.startsWith("https://")) {
                cleanedUrl = "https://" + cleanedUrl;
            }

            const hostname = new URL(cleanedUrl).hostname.toLowerCase();

            // Remove www. prefix if present
            const domain = hostname.replace(/^www\./, "");

            domains.push(domain);
            if (settings.store.enableDebugLogs) {
                logger.debug(`Extracted domain: ${domain} from ${url}`);
            }
        } catch (error) {
            if (settings.store.enableDebugLogs) {
                logger.debug(`Failed to parse URL: ${url}`, error);
            }
            continue;
        }
    }

    return domains;
}

function checkForScamLinks(content: string): string[] {
    if (!content) {
        if (settings.store.enableDebugLogs) {
            logger.debug("Message has no content, skipping");
        }
        return [];
    }

    if (scamLinks.size === 0) {
        if (settings.store.enableDebugLogs) {
            logger.debug("Scam list is empty, skipping check");
        }
        return [];
    }

    const domains = extractDomains(content);

    if (domains.length === 0) {
        if (settings.store.enableDebugLogs) {
            logger.debug("No domains extracted from message");
        }
        return [];
    }

    const detectedScams: string[] = [];

    for (const domain of domains) {
        if (scamLinks.has(domain)) {
            detectedScams.push(domain);
            logger.warn(`MATCH FOUND: ${domain} is in the scam database!`);
        } else {
            if (settings.store.enableDebugLogs) {
                logger.debug(`✓ ${domain} is not in scam database`);
            }
        }
    }

    return detectedScams;
}

export default definePlugin({
    name: "ScamLinkDetector",
    description: "Detects and warns about scam links using the Discord AntiScam database",
    tags: ["Privacy", "Chat"],
    authors: [{ name: "irritably", id: 928787166916640838n }],
    settings,

    flux: {
        async MESSAGE_CREATE({ optimistic, type, message, channelId }: IMessageCreate) {
            if (optimistic || type !== "MESSAGE_CREATE") return;
            if (message.state === "SENDING") return;
            if (!message.content) return;
            if (message.author?.bot) return;

            if (scamLinks.size === 0) {
                // The fetch in start() can fail (offline at launch). Retry here rather than
                // staying silently disabled for the whole session.
                await fetchScamList();
                if (scamLinks.size === 0) {
                    if (settings.store.enableDebugLogs) {
                        logger.debug("Scam list not loaded yet, skipping check");
                    }
                    return;
                }
            } else {
                // No-op until the 15-minute cache expires — what CACHE_DURATION was written for.
                void fetchScamList();
            }

            if (settings.store.enableDebugLogs) {
                logger.debug(`Processing message from ${message.author.username}#${message.author.discriminator} in channel ${channelId}`);
            }

            const scamDomains = checkForScamLinks(message.content);

            if (scamDomains.length === 0) {
                return;
            }

            logger.warn(`🚨 SCAM LINKS DETECTED! Found ${scamDomains.length} scam domain(s): ${scamDomains.join(", ")}`);
            logger.warn(`Author: ${message.author.username}#${message.author.discriminator} (${message.author.id})`);
            logger.warn(`Channel: ${channelId}`);

            const domainList = scamDomains.map(d => `\`${d}\``).join(", ");
            const warningMessage = t(
                `⚠️ **رابط احتيالي مكتشَف**\n\nرسالة **${message.author.username}** تحتوي روابط احتيال/خبيثة معروفة:\n${domainList}\n\nهذه النطاقات مُعلَّمة في قاعدة Discord AntiScam. لا تضغط عليها!`,
                `⚠️ **Scam Link Detected**\n\nThis message from **${message.author.username}** contains known scam/malicious links:\n${domainList}\n\nThese domains are flagged in the Discord AntiScam database. Do not click them!`
            );

            // RestAPI, not fetch(): a bare fetch carries no Authorization header, and it only
            // rejects on network failure — a 401/403 would resolve and be reported as success.
            let deleteFailure: string | null = null;
            if (settings.store.blockMessage) {
                try {
                    logger.info(`Attempting to delete scam message ${message.id}...`);
                    await RestAPI.del({ url: Constants.Endpoints.MESSAGE(channelId, message.id) });
                    logger.info(`Successfully deleted scam message ${message.id}`);
                } catch (error: any) {
                    deleteFailure = String(error?.status ?? error?.statusCode ?? "N/A");
                    logger.error(`Failed to delete scam message ${message.id} (status ${deleteFailure}):`, error);
                }
            }

            const failureNote = deleteFailure === null ? "" : "\n\n" + t(
                `⚠️ تعذّر حذف هذه الرسالة (الرمز ${deleteFailure}) — تحقّق من امتلاكك صلاحية «إدارة الرسائل» في هذه القناة.`,
                `⚠️ Could not delete this message (status ${deleteFailure}) — check that you have the Manage Messages permission in this channel.`
            );

            sendBotMessage(channelId, {
                content: warningMessage + failureNote
            });
        }
    },

    async start() {
        await fetchScamList();
    }
});
