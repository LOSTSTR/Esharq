/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getQuestifySettings } from "./access";
import { defaultAutoCompleteQuestsSimultaneously, defaultAutoCompleteQuestTypes, defaultCompleteVideoQuestsQuicker, defaultMakeMobileVideoQuestsDesktopCompatible, defaultPreventVideoQuestsPausing, defaultResumeInterruptedQuests } from "./def";

export function resetDangerousSettings(): void {
    const settings = getQuestifySettings();

    // Explicitly false rather than `defaultAllowChangingDangerousSettings`: this fork
    // ships that default as `true`, and callers such as the one-time notice's
    // "Disable Dangerous Questify Settings" action must actually close the gate.
    settings.allowChangingDangerousSettings = false;
    settings.autoCompleteQuestsSimultaneously = defaultAutoCompleteQuestsSimultaneously;
    settings.completeVideoQuestsQuicker = defaultCompleteVideoQuestsQuicker;
    settings.makeMobileVideoQuestsDesktopCompatible = defaultMakeMobileVideoQuestsDesktopCompatible;
    settings.preventVideoQuestsPausing = defaultPreventVideoQuestsPausing;
    settings.resumeInterruptedQuests = defaultResumeInterruptedQuests;
    settings.autoCompleteQuestTypes = { ...defaultAutoCompleteQuestTypes };
}
