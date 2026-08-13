/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * اختبار تنقية النسخة الاحتياطية — **الخطأ هنا يُسرّب مفتاحاً**.
 *
 *   pnpm testRedact
 *
 * خطآن ممكنان، وكلاهما صامت:
 *   • **تنقية ناقصة** ⇒ يُشارك المستخدم ملفاً فيه مفتاحه وهو يظنّه تفضيلات.
 *   • **تنقية زائدة** ⇒ تُمحى اختصاراته وكلماته المرصودة لأن اسمها يحوي
 *     `key`، فيستعيد نسخته ويجدها ناقصة بلا رسالة تفسّر.
 *
 * ولذلك الحالات أدناه أكثرها **سالبة**: ما يجب أن ينجو.
 */

import { isSecretKey, REDACTED, redactSecrets } from "../../src/api/SettingsSync/redact";

let failed = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failed++;
    console.log(`  ${ok ? "✔" : "✖"} ${label}${detail === undefined ? "" : ` — ${detail}`}`);
}

console.log("── ما يجب أن يُنقّى ──");
for (const name of ["token", "apiKey", "api_key", "groqApiKey", "webhookUrl", "password", "clientSecret", "authToken", "credentials", "key"]) {
    check(name, isSecretKey(name));
}

console.log("── ما يجب أن ينجو ──");
for (const name of ["keybind", "keybinds", "hotkey", "keyword", "keywords", "keyboardShortcut", "monkeyMode", "author", "authors", "monkey"]) {
    check(name, !isSecretKey(name));
}

console.log("── السلوك على كائن حقيقي ──");
const settings = {
    plugins: {
        EsharqAI: { enabled: true, groqApiKey: "gsk_realsecret123", model: "llama" },
        Keybinds: { enabled: true, keybind: "ctrl+q", keywords: "hello,world" },
        Webhook: { enabled: false, webhookUrl: "https://discord.com/api/webhooks/1/x" }
    },
    cloud: { authenticated: true, url: "https://cloud.example/" }
};
const { value, redacted } = redactSecrets(settings);

check("المفتاح الحسّاس استُبدل", (value as any).plugins.EsharqAI.groqApiKey === REDACTED);
check("الخطّاف استُبدل", (value as any).plugins.Webhook.webhookUrl === REDACTED);
check("الاختصار نجا", (value as any).plugins.Keybinds.keybind === "ctrl+q");
check("الكلمات المرصودة نجت", (value as any).plugins.Keybinds.keywords === "hello,world");
check("القيم غير النصّية لا تُمَسّ", (value as any).cloud.authenticated === true && (value as any).plugins.EsharqAI.enabled === true);
check("الأسماء تُبلَّغ للمستخدم", redacted.length === 2, JSON.stringify(redacted));

// 🔴 الأصل لا يُعدَّل: التنقية للملف، وتعديل المخزن يُفقد المستخدم مفتاحه من عميله.
check("الأصل سليم بعد التنقية", settings.plugins.EsharqAI.groqApiKey === "gsk_realsecret123");

console.log(failed === 0 ? "\nredact self-test: 0 error(s)" : `\nredact self-test: ${failed} error(s)`);
process.exit(failed === 0 ? 0 : 1);
