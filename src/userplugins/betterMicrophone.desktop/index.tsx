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

import { PluginInfo } from "@plugins/betterMicrophone.desktop/constants";
import { openMicrophoneSettingsModal } from "@plugins/betterMicrophone.desktop/modals";
import { MicrophonePatcher } from "@plugins/betterMicrophone.desktop/patchers";
import { initMicrophoneStore } from "@plugins/betterMicrophone.desktop/stores";
import { addSettingsPanelButton, Emitter, MicrophoneSettingsIcon, removeSettingsPanelButton } from "@plugins/philsPluginLibrary";
import { t } from "@utils/esharqI18n";
import definePlugin, { PluginNative } from "@utils/types";

export const Native = VencordNative.pluginHelpers.BetterMicrophone as PluginNative<typeof import("./native")>;

export default definePlugin({
    name: "BetterMicrophone",
    description: "Allows you to customize microphone settings more deeply.",
    authors: [{ name: "philhk", id: 305288513941667851n }, { name: "LOSTSTR", id: 681465758127226900n }],
    dependencies: ["PhilsPluginLibrary"],
    requiresRestart: true,

    start(): void {
        initMicrophoneStore();
        this.microphonePatcher = new MicrophonePatcher().patch();
        addSettingsPanelButton({
            name: PluginInfo.PLUGIN_NAME,
            icon: MicrophoneSettingsIcon,
            // getter لا سلسلة ثابتة: يُعاد تقييم t() كل عرض للوحة (الـ.map يُفكّك tooltipText)
            // فيتبدّل مع لغة العميل حيّاً، بدل خبزه عند start() على لغة التحميل.
            get tooltipText() { return t("إعدادات الميكروفون", "Microphone Settings"); },
            onClick: openMicrophoneSettingsModal
        });
        try {
            const nativeModules = globalThis.DiscordNative?.nativeModules;
            if (!nativeModules?.requireModule) throw new Error("DiscordNative.nativeModules is unavailable");
            nativeModules.requireModule("discord_voice");
            Native.applyPatches().then(result => {
                if (result.error) { console.error("[BetterMicrophone]", result.error); return; }
                console.log(`[BetterMicrophone] ${result.module_base} | patches: ok:${result.ok} failed:${result.failed} skipped:${result.skipped}`);
            }).catch(e => console.error("[BetterMicrophone]", e));
        } catch (e) {
            console.error("[BetterMicrophone]", e);
        }
    },

    stop(): void {
        this.microphonePatcher?.unpatch();
        Emitter.removeAllListeners(PluginInfo.PLUGIN_NAME);
        removeSettingsPanelButton(PluginInfo.PLUGIN_NAME);
    },

    toolboxActions: {
        // المفتاح إنجليزي (المُعرّف الثابت)؛ يُعرَّب عند العرض عبر overlay الـ toolboxActions.
        "Open Microphone Settings": openMicrophoneSettingsModal
    },
});
