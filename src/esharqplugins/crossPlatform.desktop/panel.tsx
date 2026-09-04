/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./panel.css";

import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { Link } from "@components/Link";
import { t } from "@utils/esharqI18n";
import { RelationshipStore, useEffect, useMemo, useReducer, UserStore, useState } from "@webpack/common";

import { buildPlatforms, PlatformModule } from "./platforms";
import { Credentials, getCredentials, getLinks, onStoreChange, setCredential, setLink } from "./store";
import { PlatformId, ProbeResult } from "./types";

/** أكثر ما يُعرض من الأصدقاء دفعةً واحدة؛ البحث يصل إلى البقيّة. */
const MAX_ROWS = 40;

/** الحقول التي يُدخلها المستخدم لكل منصّة، بترتيب العرض. */
const fieldsFor = (id: PlatformId): readonly { key: keyof Credentials; label: string; }[] => {
    switch (id) {
        case "steam":
            return [
                { key: "steamKey", label: t("مفتاح الواجهة", "API key") },
                { key: "steamId", label: t("معرّفك (SteamID64)", "Your SteamID64") }
            ];
        case "hypixel":
            return [{ key: "hypixelKey", label: t("مفتاح الواجهة", "API key") }];
        case "twitch":
            return [
                { key: "twitchClientId", label: "Client ID" },
                { key: "twitchToken", label: t("توكن OAuth", "OAuth token") },
                { key: "twitchUserId", label: t("معرّف حسابك الرقميّ", "Your numeric user id") }
            ];
    }
};

function PlatformCard({ platform }: { platform: PlatformModule; }) {
    const [result, setResult] = useState<ProbeResult | null>(null);
    const [busy, setBusy] = useState(false);
    const creds = getCredentials();

    const test = async () => {
        setBusy(true);
        setResult(null);
        try {
            setResult(await platform.probe(creds));
        } catch (e) {
            setResult({ ok: false, message: `${t("فشل الاختبار:", "The test failed:")} ${String(e)}` });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="esharq-xp-card">
            <div className="esharq-xp-head">
                <span className="esharq-xp-name">{platform.label}</span>
                <Link href={platform.keyUrl}>{t("من أين المفتاح؟", "Where do I get the key?")}</Link>
            </div>

            {fieldsFor(platform.id).map(field => (
                <label className="esharq-xp-field" key={field.key}>
                    <span>{field.label}</span>
                    <input
                        className="esharq-xp-input"
                        type="password"
                        value={creds[field.key]}
                        spellCheck={false}
                        onChange={e => setCredential(field.key, e.currentTarget.value)}
                    />
                </label>
            ))}

            <div className="esharq-xp-actions">
                <Button size="small" disabled={busy} onClick={test}>
                    {busy ? t("جارٍ الاختبار…", "Testing…") : t("اختبر الاتصال", "Test the connection")}
                </Button>
                {result && (
                    <span className={result.ok ? "esharq-xp-ok" : "esharq-xp-bad"}>{result.message}</span>
                )}
            </div>
        </div>
    );
}

function FriendLinks({ platforms }: { platforms: readonly PlatformModule[]; }) {
    const [query, setQuery] = useState("");
    const links = getLinks();

    const friendIds = RelationshipStore.getFriendIDs();
    const named = useMemo(
        () => friendIds
            .map(id => ({ id, user: UserStore.getUser(id) }))
            .filter(row => row.user !== undefined)
            .map(row => ({ id: row.id, name: row.user.globalName || row.user.username }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        [friendIds.join(",")]
    );

    const needle = query.toLowerCase();
    const rows = named.filter(row => row.name.toLowerCase().includes(needle)).slice(0, MAX_ROWS);

    return (
        <div className="esharq-xp-card">
            <div className="esharq-xp-head">
                <span className="esharq-xp-name">{t("اربط أصدقاءك", "Link your friends")}</span>
            </div>
            <p className="esharq-xp-hint">
                {t(
                    "لا توجد طريقة تعرف وحدها أنّ حساب صديقك على ستيم هو حسابه على ديسكورد، فالربط يدويّ. اترك الحقل فارغاً لفكّ الربط.",
                    "Nothing can tell on its own that a Steam account belongs to your Discord friend, so linking is manual. Leave a field empty to unlink."
                )}
            </p>

            <input
                className="esharq-xp-input esharq-xp-search"
                placeholder={t("ابحث في أصدقائك…", "Search your friends…")}
                value={query}
                onChange={e => setQuery(e.currentTarget.value)}
            />

            {rows.length === 0 && (
                <p className="esharq-xp-hint">{t("لا أحد يطابق البحث.", "Nobody matches that search.")}</p>
            )}

            {rows.map(row => (
                <div className="esharq-xp-friend" key={row.id}>
                    <span className="esharq-xp-friend-name">{row.name}</span>
                    <div className="esharq-xp-friend-fields">
                        {platforms.map(platform => (
                            <label className="esharq-xp-field" key={platform.id}>
                                <span>{platform.label}</span>
                                <input
                                    className="esharq-xp-input"
                                    placeholder={platform.linkHint}
                                    spellCheck={false}
                                    value={links[row.id]?.[platform.id] ?? ""}
                                    onChange={e => setLink(row.id, platform.id, e.currentTarget.value)}
                                />
                            </label>
                        ))}
                    </div>
                </div>
            ))}

            {named.length > rows.length && (
                <p className="esharq-xp-hint">
                    {`${t("يُعرض", "Showing")} ${rows.length} ${t("من", "of")} ${named.length}. ${t("استعمل البحث للوصول إلى البقيّة.", "Use the search to reach the rest.")}`}
                </p>
            )}
        </div>
    );
}

function Panel() {
    // المتجر خارج رياكت، فنُعيد الرسم عند كلّ تغيّر فيه.
    const [, bump] = useReducer((n: number) => n + 1, 0);
    useEffect(() => onStoreChange(bump), []);

    const platforms = buildPlatforms();

    return (
        <div className="esharq-xp">
            {platforms.map(platform => <PlatformCard platform={platform} key={platform.id} />)}
            <FriendLinks platforms={platforms} />
        </div>
    );
}

export default ErrorBoundary.wrap(Panel, { noop: true });
