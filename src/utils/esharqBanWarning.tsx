/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Notice } from "@components/Notice";
import { t } from "@utils/esharqI18n";

/**
 * A reusable bilingual "⚠️ this may get you banned" notice for Esharq plugins whose
 * behaviour can violate Discord's Terms of Service (voice moderation bypass, fake nitro,
 * silent delete/edit, …). Drop it at the top of a plugin's settings via an
 * `OptionType.COMPONENT` entry so the warning is visible before the user enables anything.
 *
 * Pass custom `ar`/`en` text for a plugin-specific message, or omit for the generic one.
 */
export function BanRiskWarning({ ar, en }: { ar?: string; en?: string; } = {}) {
    return (
        <Notice variant="warning">
            {t(
                ar ?? "تحذير: قد يخالف هذا السلوك شروط خدمة Discord ويعرّض حسابك للحظر. استخدمها على مسؤوليتك الخاصة.",
                en ?? "Warning: this behavior may violate Discord's Terms of Service and could get your account banned. Use at your own risk."
            )}
        </Notice>
    );
}
