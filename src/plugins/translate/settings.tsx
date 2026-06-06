/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
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

import { definePluginSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { t } from "@utils/esharqI18n";
import { OptionType } from "@utils/types";

import { openTranslateModal } from "./TranslateModal";

export const settings = definePluginSettings({
    receivedInput: {
        type: OptionType.STRING,
        description: t("اللغة التي تُترجم منها الرسائل الواردة", "The language to translate received messages from"),
        default: "auto",
        hidden: true
    },
    receivedOutput: {
        type: OptionType.STRING,
        description: t("اللغة التي تُترجم إليها الرسائل الواردة", "The language to translate received messages to"),
        default: "en",
        hidden: true
    },
    sentInput: {
        type: OptionType.STRING,
        description: t("اللغة التي تُترجم منها رسائلك", "The language to translate your messages from"),
        default: "auto",
        hidden: true
    },
    sentOutput: {
        type: OptionType.STRING,
        description: t("اللغة التي تُترجم إليها رسائلك", "The language to translate your messages to"),
        default: "en",
        hidden: true
    },
    service: {
        type: OptionType.SELECT,
        description: IS_WEB ? t("مزود الترجمة (غير متاح على الويب)", "Translation provider (not available on web)") : t("مزود الترجمة", "Translation provider"),
        hidden: IS_WEB,
        options: [
            { label: t("Google Translate", "Google Translate"), value: "google", default: true },
            { label: t("DeepL Free — يتطلّب مفتاح API", "DeepL Free — API key required"), value: "deepl" },
            { label: t("DeepL Pro — يتطلّب مفتاح API", "DeepL Pro — API key required"), value: "deepl-pro" },
            { label: t("Kagi Translate — يتطلّب مفتاح API", "Kagi Translate — API key required"), value: "kagi" }
        ] as const,
        onChange: resetLanguageDefaults
    },
    deeplApiKey: {
        type: OptionType.STRING,
        description: t("مفتاح DeepL API الخاص بك (من deepl.com/your-account)", "Your DeepL API key (from deepl.com/your-account)"),
        default: ""
    },
    kagiSession: {
        type: OptionType.STRING,
        description: t("رمز جلسة Kagi الخاص بك (من kagi.com/settings?p=user_details)", "Your Kagi session token (from kagi.com/settings?p=user_details)"),
        default: ""
    },
    autoTranslate: {
        type: OptionType.BOOLEAN,
        description: t("ترجمة رسائلك تلقائياً قبل الإرسال. يمكنك أيضاً الضغط مع Shift أو النقر بالزر الأيمن على زر الترجمة لتبديل هذا الخيار", "Automatically translate your messages before sending. You can also Shift-click or right-click the translate button to toggle this option"),
        default: false
    },
    showAutoTranslateTooltip: {
        type: OptionType.BOOLEAN,
        description: t("إظهار تلميح على زر شريط الدردشة عند ترجمة رسالة تلقائياً", "Show a tooltip on the chat bar button when a message is auto-translated"),
        default: true
    },
    manageTranslateSettings: {
        type: OptionType.COMPONENT,
        component: () => (
            <Button onClick={openTranslateModal}>{t("تخصيص لغات الترجمة والترجمة التلقائية", "Customize translation languages & Auto-Translate")}</Button>
        )
    }
}, {
    deeplApiKey: {
        hidden() { return this.store.service !== "deepl" && this.store.service !== "deepl-pro"; }
    },
    kagiSession: {
        hidden() { return this.store.service !== "kagi"; }
    }
}).withPrivateSettings<{
    dismissedAutoTranslateAlert?: boolean;
}>();

export function resetLanguageDefaults() {
    if (IS_WEB || settings.store.service === "google" || settings.store.service === "kagi") {
        settings.store.receivedInput = "auto";
        settings.store.receivedOutput = "en";
        settings.store.sentInput = "auto";
        settings.store.sentOutput = "en";
    } else {
        settings.store.receivedInput = "";
        settings.store.receivedOutput = "en-us";
        settings.store.sentInput = "";
        settings.store.sentOutput = "en-us";
    }
}
