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

import { isSecretKey, REDACTED, redactDataStore, redactPath, redactSecrets, scrubPaths } from "../../src/api/SettingsSync/redact";

let failed = 0;
function check(label: string, ok: boolean, detail?: unknown) {
    if (!ok) failed++;
    console.log(`  ${ok ? "✔" : "✖"} ${label}${detail === undefined ? "" : ` — ${detail}`}`);
}

console.log("── ما يجب أن يُنقّى ──");
for (const name of ["token", "apiKey", "api_key", "groqApiKey", "webhookUrl", "password", "clientSecret", "authToken", "credentials", "key"]) {
    check(name, isSecretKey(name));
}

/*
 * 🔴 كلّ اسمٍ هنا **مأخوذ من المستودع** لا مُختلَق. `ezHostKey` و`pixelVaultKey`
 * و`s3AccessKeyId` في `equicordplugins/fileUpload/settings.tsx`، و`catboxUserHash`
 * و`customHeadersJson` في `esharqplugins/BigFileUploadEnhanced`، و`kagiSession`
 * في `plugins/translate/settings.tsx`، و`steamKey`/`hypixelKey` في
 * `esharqplugins/crossPlatform.desktop/store.ts`. كلّها كانت تخرج سليمة قبل
 * توسيع المِحكّ إلى **نهاية الاسم**.
 */
console.log("── أصنافٌ كانت تُفلت: نهاية الاسم ──");
for (const name of [
    // …Key
    "ezHostKey", "encryptingHostKey", "pixelVaultKey", "pixelDrainKey", "steamKey", "hypixelKey", "serviceKey",
    // …KeyId
    "s3AccessKeyId",
    // …Hash
    "catboxUserHash", "catboxUserhash", "userHash",
    // …Session
    "kagiSession", "userSession",
    // …Cookie
    "sessionCookie", "authCookie",
    // …Token / ترويسات بالجمع
    "gofileToken", "nestToken", "ziplineToken", "oauthToken", "customHeadersJson"
]) {
    check(name, isSecretKey(name));
}

/*
 * 🔴 `keys$` كان في قائمة الاستثناء فيُلغي تنقية `apiKeys` **بعد** أن يلتقطها
 * `api[-_]?key`. حُذف، ولا اسم في المستودع يتضرّر بحذفه.
 *
 * ولم يُوسَّع المِحكّ إلى الجمع (`…Keys`) عمداً: الجمع في ذاته ليس دلالة سرّ —
 * `getAllKeys` فهرس، و`emojiKeys` قائمة. ما يُنقّى منه هو ما يحمل دلالةً
 * أخرى معه (`apiKeys`، `secretKeys`). والتوسّع إلى كلّ جمعٍ يُفقد المستخدم
 * قوائمَ بريئة بلا رسالة تفسّر — وهو الضرر الصامت الذي بُني الملفّ لتجنّبه.
 */
console.log("── ثغرة الجمع ──");
check("apiKeys يُنقّى", isSecretKey("apiKeys"));
check("secretKeys يُنقّى", isSecretKey("secretKeys"));
check("getAllKeys ينجو", !isSecretKey("getAllKeys"));

console.log("── ما يجب أن ينجو ──");
for (const name of [
    "keybind", "keybinds", "hotkey", "keyword", "keywords", "keyboardShortcut", "monkeyMode", "author", "authors", "monkey",
    // أسماء حقيقية من المستودع تنتهي بـ«key» أو تحمل «header» مفرداً — لا أسرار
    "monkeypatch", "stealthHotkey", "enableHotkeys", "getAllKeys", "closeTabKeybind", "customKeybind", "keyframeInterval",
    "userHeader", "notifHeader", "showInputDeviceHeader", "userProfileHeader", "textHeader",
    // «key» في الوسط لا في الطرف
    "numberKeySwitchCount", "enableNumberKeySwitching", "keyBind"
]) {
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

/*
 * ── مخزن IndexedDB ──────────────────────────────────────────────────────────
 *
 * 🔴 شكله **مصفوفة أزواج** لا كائن. فاسم المفتاح يقع قيمةً في الموضع صفر، ولا
 * تراه `redactSecrets` التي تُطابق أسماء الحقول. والحالة الحاسمة أدناه هي
 * `ThemeLibrary_uniqueToken`: توكن **نصّ مسطَّح** تحت مفتاح أعلى — لو مُرّرت
 * المصفوفة إلى `redactSecrets` لخرج حرفياً، ولنجح كلّ اختبارٍ آخر وهو يُسرّب.
 */
console.log("── مخزن IndexedDB: مفاتيح عليا مسطَّحة ──");
const store: [IDBValidKey, unknown][] = [
    ["ThemeLibrary_uniqueToken", "tl_flat_secret"],
    ["Vencord_cloudSecret", { "https://cloud.example/": "cs_flat_secret" }],
    ["decor-auth", "{\"state\":{\"tokens\":{\"1\":\"dc_secret\"}}}"],
    ["rdb-auth", { token: "rdb_secret" }],
    ["songspotlight-auth", { tokens: { "1": { access: "ss_secret", refresh: "ss_refresh" } } }],
    ["vc-streaks-auth", "vs_flat_secret"],
    // اسمٌ بريء وقيمته تحمل الأسرار في حقولها ⇒ يُنزَل إليها بالتكرار
    ["CrossPlatform_creds", { steamKey: "st_secret", steamId: "76561198", hypixelKey: "hp_secret", twitchToken: "tw_secret", twitchUserId: "42" }],
    ["TempMail_accounts", [{ id: "a1", address: "x@y.z", token: "tm_secret" }]],
    // لا سرّ فيه بحال ⇒ يخرج كما هو، وإلّا كانت التنقية زائدة تُفقد المستخدم بياناته
    ["ChannelTabs_bookmarks", [{ name: "عام", channelId: "1" }]],
    ["Calendar_notes", { "2026-09-08": "موعد" }]
];
const ds = redactDataStore(store);
const at = (k: string) => ds.value.find(([key]) => key === k)?.[1] as any;
const flat = JSON.stringify(ds.value);

check("توكن نصّ مسطَّح استُبدل", at("ThemeLibrary_uniqueToken") === REDACTED);
check("سرّ السحابة استُبدل", at("Vencord_cloudSecret") === REDACTED);
check("مخزن decor استُبدل", at("decor-auth") === REDACTED);
check("مخزن reviewDB استُبدل", at("rdb-auth") === REDACTED);
check("مخزن songSpotlight استُبدل", at("songspotlight-auth") === REDACTED);
check("مخزن streaks استُبدل", at("vc-streaks-auth") === REDACTED);
check("مفاتيح المنصّات في اسمٍ بريء", at("CrossPlatform_creds").steamKey === REDACTED && at("CrossPlatform_creds").hypixelKey === REDACTED && at("CrossPlatform_creds").twitchToken === REDACTED);
check("المعرّفات غير السرّية نجت", at("CrossPlatform_creds").steamId === "76561198" && at("CrossPlatform_creds").twitchUserId === "42");
check("توكن داخل مصفوفة استُبدل", at("TempMail_accounts")[0].token === REDACTED && at("TempMail_accounts")[0].address === "x@y.z");
check("البيانات البريئة لم تُمَسّ", JSON.stringify(at("ChannelTabs_bookmarks")) === "[{\"name\":\"عام\",\"channelId\":\"1\"}]" && at("Calendar_notes")["2026-09-08"] === "موعد");
check("عدد المفاتيح لم يتغيّر", ds.value.length === store.length);

// 🔴 المِحكّ القاطع: لا سرٌّ واحد نجا في النصّ المُصدَّر كلّه.
for (const secret of ["tl_flat_secret", "cs_flat_secret", "dc_secret", "rdb_secret", "ss_secret", "ss_refresh", "vs_flat_secret", "st_secret", "hp_secret", "tw_secret", "tm_secret"]) {
    check(`لا أثر لـ${secret} في المُخرَج`, !flat.includes(secret));
}

// والأصل — كالإعدادات — لا يُمَسّ.
check("أصل المخزن سليم", (store[0][1] as string) === "tl_flat_secret" && (store[6][1] as any).steamKey === "st_secret");
check("أسماء المخزن تُبلَّغ", ds.redacted.includes("ThemeLibrary_uniqueToken") && ds.redacted.includes("CrossPlatform_creds.steamKey"));

/*
 * ── المسارات ────────────────────────────────────────────────────────────────
 *
 * 🔴 حزمة الدعم تَعِد ألّا تُخرج «مسارات جهازك»، وكانت تُخرج مساراً فيه اسم
 * مستخدم النظام. و«USERNAME» أدناه هو ما يجب ألّا يبقى له أثر.
 */
console.log("── المسارات: الوعد يجب أن يصدق ──");
const WIN = "C:\\Users\\USERNAME\\AppData\\Roaming\\Esharq\\settings\\settings.json";
const NIX = "/home/USERNAME/.config/Esharq/settings/settings.json";

check("مسار ويندوز يُختصر", redactPath(WIN) === "<userData>/settings/settings.json");
check("مسار يونكس يُختصر", redactPath(NIX) === "<userData>/settings/settings.json");
check("المسار الفارغ لا يُكسر", redactPath(null) === null && redactPath("") === null);

const fsErrors = [
    `EACCES: permission denied, open '${WIN}'`,
    `EACCES: permission denied, open '${NIX}'`,
    `ENOENT: no such file or directory, open "${WIN}"`,
    `EBUSY: resource busy or locked, open '${NIX}' — استُعيدت من النسخة الاحتياطية`,
    `من الواجهة: Error at file:///${WIN.replace(/\\/g, "/")}:12:3`
];
for (const err of fsErrors) {
    const out = scrubPaths(err)!;
    check(`لا اسم مستخدم في: ${err.slice(0, 34)}…`, !out.includes("USERNAME"), out);
}
check("اسم الملفّ يبقى للتشخيص", scrubPaths(fsErrors[0])!.includes("settings.json"));
check("رمز الخطأ يبقى", scrubPaths(fsErrors[0])!.startsWith("EACCES: permission denied"));

// 🔴 الروابط ليست مسار أحد: ابتلاعها يُعمي التشخيص بلا أن يحمي شيئاً.
const withUrl = "Patch by X errored at https://discord.com/assets/web.abc123.js:4:9";
check("الروابط تنجو", scrubPaths(withUrl) === withUrl);
check("نصٌّ بلا مسار لا يتغيّر", scrubPaths("EPERM: operation not permitted") === "EPERM: operation not permitted");
check("النصّ الفارغ لا يُكسر", scrubPaths(null) === null && scrubPaths("") === null);

console.log(failed === 0 ? "\nredact self-test: 0 error(s)" : `\nredact self-test: ${failed} error(s)`);
process.exit(failed === 0 ? 0 : 1);
