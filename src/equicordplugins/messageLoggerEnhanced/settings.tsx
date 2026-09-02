/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, Settings } from "@api/Settings";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { t } from "@utils/esharqI18n";
import { OptionType } from "@utils/types";
import { useState } from "@webpack/common";

import { Native } from ".";
import { ClearLogsButton } from "./components/ClearLogsButton";
import { ImageCacheDir, LogsDir } from "./components/FolderSelectInput";
import { openLogModal } from "./components/LogsModal";
import { blockedExts } from "./list";
import { DEFAULT_IMAGE_CACHE_DIR } from "./utils/constants";
import { exportLogs, importLogs } from "./utils/settingsUtils";

function ImportLogsButton() {
    const [loading, setLoading] = useState(false);

    return (
        <Button
            disabled={loading}
            onClick={async () => {
                setLoading(true);
                try {
                    await importLogs();
                } finally {
                    setLoading(false);
                }
            }}
        >
            {loading ? "Importing..." : "Import Logs"}
        </Button>
    );
}

function ExportLogsButton() {
    const [loading, setLoading] = useState(false);

    return (
        <Button
            disabled={loading}
            onClick={async () => {
                setLoading(true);
                try {
                    await exportLogs();
                } finally {
                    setLoading(false);
                }
            }}
        >
            {loading ? "Exporting..." : "Export Logs"}
        </Button>
    );
}

export const settings = definePluginSettings({
    saveMessages: {
        default: true,
        type: OptionType.BOOLEAN,
        description: t("حفظ الرسائل المحذوفة والمعدّلة", "Save deleted and edited messages"),
    },

    saveImages: {
        type: OptionType.BOOLEAN,
        description: t("حفظ المرفقات المحذوفة.", "Save deleted attachments."),
        default: false
    },

    sortNewest: {
        default: true,
        type: OptionType.BOOLEAN,
        description: t("ترتيب السجلات من الأحدث إلى الأقدم.", "Sort logs from newest to oldest."),
    },

    cacheMessagesFromServers: {
        default: false,
        type: OptionType.BOOLEAN,
        description: t("عادةً يسجّل مسجّل الرسائل من المعرّفات المدرجة في القائمة البيضاء والرسائل المباشرة فقط، وتفعيل هذا الخيار سيجعله يسجّل الرسائل من جميع السيرفرات أيضاً. لاحظ أن هذا قد يؤدي إلى تجاوز حد الذاكرة المؤقتة مما قد يتسبب في تفويت بعض الرسائل. إذا كنت في عدد كبير من السيرفرات فقد يزيد هذا بشكل ملحوظ من حجم السجلات.", "By default MessageLogger only logs from whitelisted IDs and DMs, enabling this will also log from all servers. Note this may cause the cache limit to be exceeded causing some messages to be missed. If you are in a lot of servers this may increase log size significantly."),
    },

    ignoreBots: {
        type: OptionType.BOOLEAN,
        description: t("تجاهل رسائل البوتات", "Ignore bot messages"),
        default: false,
        onChange() {
            // we will be handling the ignoreBots now (enabled or not) so the original messageLogger shouldnt
            Settings.plugins.MessageLogger.ignoreBots = false;
        }
    },

    ignoreWebhooks: {
        type: OptionType.BOOLEAN,
        description: t("تجاهل رسائل Webhooks", "Ignore Webhook messages"),
        default: false,
    },

    ignoreSelf: {
        type: OptionType.BOOLEAN,
        description: t("تجاهل رسائلك أنت", "Ignore your own messages"),
        default: false,
        onChange() {
            Settings.plugins.MessageLogger.ignoreSelf = false;
        }
    },

    ignoreMutedGuilds: {
        default: false,
        type: OptionType.BOOLEAN,
        description: t("لن تُسجَّل الرسائل في السيرفرات المكتومة. سيظل المستخدمون/القنوات في القائمة البيضاء داخل السيرفرات المكتومة مسجَّلين.", "Messages in muted servers will not be logged. Users/channels in the whitelist inside muted servers will still be logged.")
    },

    ignoreMutedCategories: {
        default: false,
        type: OptionType.BOOLEAN,
        description: t("لن تُسجَّل الرسائل في القنوات التابعة للتصنيفات المكتومة. سيظل المستخدمون/القنوات في القائمة البيضاء مسجَّلين.", "Messages in channels under muted categories will not be logged. Users/channels in the whitelist will still be logged.")
    },

    ignoreMutedChannels: {
        default: false,
        type: OptionType.BOOLEAN,
        description: t("لن تُسجَّل الرسائل في القنوات المكتومة. سيظل المستخدمون/القنوات في القائمة البيضاء مسجَّلين.", "Messages in muted channels will not be logged. Users/channels in the whitelist will still be logged."),
    },

    alwaysLogDirectMessages: {
        default: true,
        type: OptionType.BOOLEAN,
        description: t("تسجيل الرسائل المباشرة دائماً", "Always log direct messages"),
    },

    alwaysLogCurrentChannel: {
        default: true,
        type: OptionType.BOOLEAN,
        description: t("تسجيل القناة المحددة حالياً دائماً. ستظل القنوات/المستخدمون في القائمة السوداء مستثنين.", "Always log the currently selected channel. Channels/users in the blacklist will still be excluded."),
    },

    permanentlyRemoveLogByDefault: {
        default: false,
        type: OptionType.BOOLEAN,
        description: t("زر حذف السجل الأصلي في MessageLogger سيحذف السجلات بشكل دائم", "The original MessageLogger delete log button will permanently delete logs"),
    },

    hideMessageFromMessageLoggers: {
        default: false,
        type: OptionType.BOOLEAN,
        description: t("عند التفعيل، سيُضاف زر في قائمة السياق للرسائل يتيح لك حذفها دون تسجيلها بواسطة مسجّلات أخرى. قد لا يكون آمناً، استخدمه على مسؤوليتك.", "When enabled, adds a button to the message context menu to delete messages without them being logged by other loggers. May not be safe, use at your own risk.")
    },

    ShowLogsButton: {
        default: true,
        type: OptionType.BOOLEAN,
        description: t("تبديل إظهار صندوق الأدوات أو إخفائه", "Toggle showing or hiding the toolbox"),
        restartNeeded: true,
    },

    ShowWhereMessageIsFrom: {
        default: false,
        type: OptionType.BOOLEAN,
        description: t("إظهار اسم القناة/المؤلف واسم السيرفر للرسالة", "Show channel/author name and server name for the message"),
    },

    messagesToDisplayAtOnceInLogs: {
        default: 100,
        type: OptionType.NUMBER,
        description: t("عدد الرسائل المعروضة في السجلات دفعةً واحدة وعدد الرسائل التي تُحمَّل عند تحميل المزيد.", "Number of messages displayed in logs at once and the number loaded when loading more."),
    },

    hideMessageFromMessageLoggersDeletedMessage: {
        default: "redacted eh",
        type: OptionType.STRING,
        description: t("محتوى الرسالة الذي سيحل محل الرسالة الأصلية عند استخدام ميزة إخفاء الرسائل عن المسجّلات.", "The message content that will replace the original message when using the hide message from loggers feature."),
    },

    messageLimit: {
        default: 200,
        type: OptionType.NUMBER,
        description: t("الحد الأقصى لعدد الرسائل المحفوظة. تُحذف الرسائل القديمة عند بلوغ الحد. 0 يعني بلا حد", "Maximum number of messages to save. Old messages are deleted when the limit is reached. 0 means no limit")
    },

    attachmentSizeLimitInMegabytes: {
        default: 12,
        type: OptionType.NUMBER,
        description: t("الحد الأقصى لحجم المرفق بالميغابايت للحفظ. لن تُحفظ المرفقات التي تتجاوز هذا الحجم.", "Maximum attachment size in megabytes to save. Attachments exceeding this size will not be saved.")
    },

    attachmentFileExtensions: {
        default: "png,jpg,jpeg,gif,webp,mp4,webm,mp3,ogg,wav",
        type: OptionType.STRING,
        description: t("قائمة امتدادات الملفات المفصولة بفواصل للحفظ. لن تُحفظ المرفقات ذات الامتدادات غير الموجودة في القائمة. اتركها فارغة لحفظ جميع المرفقات.", "Comma-separated list of file extensions to save. Attachments with extensions not in the list will not be saved. Leave empty to save all attachments."),
        onChange: (value: string) => {
            let processedValue = "";

            if (value) {
                const exts = value.split(",").map(ext => ext.trim().toLowerCase());
                const invalid = exts.filter(ext => blockedExts.includes(ext));

                if (invalid.length > 0) {
                    console.warn("Rejected invalid file extensions:", invalid);
                    processedValue = exts.filter(ext => !blockedExts.includes(ext)).join(",");
                } else {
                    processedValue = exts.join(",");
                }
            }

            Native.updateAllowedExtensions(processedValue).catch((err: any) => {
                console.error("Failed to sync attachment extensions natively:", err);
            });

            return processedValue;
        }
    },
    cacheLimit: {
        default: 1000,
        type: OptionType.NUMBER,
        description: t("الحد الأقصى لعدد الرسائل المخزّنة في الذاكرة المؤقتة. تُحذف الرسائل القديمة عند بلوغ الحد. هذا يساعد في تقليل استخدام الذاكرة وتحسين الأداء. 0 يعني بلا حد", "Maximum number of messages stored in cache. Old messages are deleted when the limit is reached. This helps reduce memory usage and improve performance. 0 means no limit"),
    },

    timeBasedCleanupMinutes: {
        default: 0,
        type: OptionType.NUMBER,
        description: t("حذف الرسائل تلقائياً من السيرفرات التي مضى عليها هذا العدد من الدقائق. اضبطه على 0 لتعطيل التنظيف المبني على الوقت.", "Automatically delete messages from servers older than this many minutes. Set to 0 to disable time-based cleanup."),
    },

    preserveCurrentChannel: {
        default: true,
        type: OptionType.BOOLEAN,
        description: t("عند التفعيل، لن تتأثر رسائل القناة المحددة حالياً بالتنظيف المبني على الوقت.", "When enabled, messages in the currently selected channel will not be affected by time-based cleanup."),
    },

    whitelistedIds: {
        default: "",
        type: OptionType.STRING,
        description: t("معرّفات السيرفرات أو القنوات أو المستخدمين في القائمة البيضاء.", "Server, channel, or user IDs in the whitelist.")
    },

    blacklistedIds: {
        default: "",
        type: OptionType.STRING,
        description: t("معرّفات السيرفرات أو القنوات أو المستخدمين في القائمة السوداء.", "Server, channel, or user IDs in the blacklist.")
    },

    imageCacheDir: {
        type: OptionType.COMPONENT,
        description: t("اختيار مجلد حفظ الصور", "Choose image save folder"),
        component: ErrorBoundary.wrap(ImageCacheDir) as any
    },

    logsDir: {
        type: OptionType.COMPONENT,
        description: t("اختيار مجلد السجلات", "Choose logs folder"),
        component: ErrorBoundary.wrap(LogsDir) as any
    },

    importLogs: {
        type: OptionType.COMPONENT,
        description: t("استيراد السجلات من ملف", "Import logs from a file"),
        component: ImportLogsButton
    },

    exportLogs: {
        type: OptionType.COMPONENT,
        description: t("تصدير السجلات من IndexedDB", "Export logs from IndexedDB"),
        component: ExportLogsButton
    },

    clearLogsOnRestart: {
        type: OptionType.BOOLEAN,
        description: t("مسح السجلات عند إعادة تشغيل Discord.", "Clear logs on Discord restart."),
        default: false,
        restartNeeded: true,
    },

    openLogs: {
        type: OptionType.COMPONENT,
        description: t("فتح السجلات", "Open logs"),
        component: () =>
            <Button onClick={() => openLogModal()}>{t("فتح السجلّات", "Open Logs")}</Button>
    },
    openImageCacheFolder: {
        type: OptionType.COMPONENT,
        description: t("فتح مجلد ذاكرة التخزين المؤقت للصور", "Open image cache folder"),
        component: () =>
            <Button
                disabled={
                    IS_WEB
                    || settings.store.imageCacheDir == null
                    || settings.store.imageCacheDir === DEFAULT_IMAGE_CACHE_DIR
                }
                onClick={() => Native.showItemInFolder()}
            >{t("فتح مجلّد ذاكرة الصور المؤقّتة", "Open Image Cache Folder")}</Button>
    },

    clearLogs: {
        type: OptionType.COMPONENT,
        description: t("مسح السجلات", "Clear Logs"),
        component: () => <ClearLogsButton />
    },

});
