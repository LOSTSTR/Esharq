/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginI18n } from "@utils/i18n/types";

export default definePluginI18n({
    "description": {
        "ar": "طيّ عناصر الواجهة الأصلية: قائمة القنوات، والأعضاء، وزرّ الدردشة، ومنطقة المستخدم.",
        "en": "Native collapsible channel, member, chat button, and user area surfaces."
    },
    "options": {
        "detachUserArea": {
            "ar": "فصل منطقة المستخدم لتتمكّن من تحريكها بحرّية عندما لا تكون مطويّة.",
            "en": "Detach the user area so it can be moved freely when it is not collapsed."
        }
    }
});
