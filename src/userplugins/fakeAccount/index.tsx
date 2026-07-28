/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addContextMenuPatch, NavContextMenuPatchCallback, removeContextMenuPatch } from "@api/ContextMenu";
import * as DataStore from "@api/DataStore";
import { addHeaderBarButton, HeaderBarButton, removeHeaderBarButton } from "@api/HeaderBar";
import { t } from "@utils/esharqI18n";
import definePlugin from "@utils/types";
import { findStoreLazy, waitFor } from "@webpack";
import { FluxDispatcher, Menu, React, UserStore } from "@webpack/common";
import { Logger } from "@utils/Logger";

const logger = new Logger("FakeAccount");

const UserProfileStore = findStoreLazy("UserProfileStore") as any;
const DS_KEY = "esharq-fakeAccount-switcher";

interface FakeAccount {
    id: string;
    username: string;
    globalName: string;
    discriminator: string;
    avatar: string | null;
    bio: string;
    banner: string | null;
    accentColor: number | null;
    publicFlags: number;
    flags: number;
    premiumType: number;
}

interface RealSnapshot {
    username: string;
    globalName: string;
    avatar: string | null;
    banner: string | null;
    bio: string;
    accentColor: number | null;
    discriminator: string;
    publicFlags: number;
    flags: number;
    premiumType: number;
}

let fakeAccounts: FakeAccount[] = [];
let activeFakeId: string | null = null;
let realSnapshot: RealSnapshot | null = null;

// The MultiAccountStore we hook, plus the original methods so stop() can restore them.
let store: any = null;
let origGetUsers: (() => any[]) | null = null;
let origGetValidUsers: (() => any[]) | null = null;

// waitFor(["getUsers","getValidUsers","getHasLoggedInAccounts"]) can match several stores
// that share those method names (EmojiStore, permission stores…). Patching the wrong one
// corrupts unrelated UI, so we fingerprint the real MultiAccountStore first: getUsers()
// must return an array of account-shaped objects (string id + tokenStatus/pushSyncToken),
// and it must NOT expose EmojiStore's getFrequentlyUsedEmojis.
function isMultiAccountStore(mod: any): boolean {
    try {
        if (typeof mod.getUsers !== "function") return false;
        if (typeof mod.getValidUsers !== "function" && typeof mod.getHasLoggedInAccounts !== "function") return false;
        if (typeof mod.getFrequentlyUsedEmojis === "function") return false;

        const users = mod.getUsers();
        if (!Array.isArray(users)) return false;

        if (users.length > 0) {
            const first = users[0];
            if (typeof first !== "object" || first === null || typeof first.id !== "string") return false;
            if (!("tokenStatus" in first) && !("pushSyncToken" in first)) {
                if ("type" in first || "permissions" in first || "parentId" in first) return false;
            }
        }
        return true;
    } catch {
        return false;
    }
}

function asSwitcherEntry(f: FakeAccount) {
    return {
        id: f.id,
        username: f.username,
        globalName: f.globalName,
        discriminator: f.discriminator,
        avatar: f.avatar,
        tokenStatus: 2, // 2 = "fake"; keeps Discord from trying to validate a token
        pushSyncToken: null,
    };
}

function patchStore() {
    if (!store || origGetUsers) return;

    origGetUsers = store.getUsers.bind(store);
    origGetValidUsers = store.getValidUsers?.bind(store) ?? (() => []);

    const withFakes = (real: any[]) => {
        const realIds = new Set(real.map(u => u.id));
        const extras = fakeAccounts.filter(f => !realIds.has(f.id)).map(asSwitcherEntry);
        return [...real, ...extras];
    };

    store.getUsers = () => withFakes(origGetUsers?.() ?? []);
    store.getValidUsers = () => withFakes(origGetValidUsers?.() ?? []);
    store.getHasLoggedInAccounts = () => true;
}

function unpatchStore() {
    if (!store || !origGetUsers) return;
    store.getUsers = origGetUsers;
    if (origGetValidUsers) store.getValidUsers = origGetValidUsers;
    origGetUsers = null;
    origGetValidUsers = null;
    store.emitChange?.();
}

// Locally rewrites the current user object so YOUR client renders with the chosen
// appearance. Nothing is sent to Discord; the real account/token are untouched.
function applyFake(fake: FakeAccount) {
    const me = UserStore.getCurrentUser();
    if (!me) return;

    if (!realSnapshot) {
        realSnapshot = {
            username: me.username,
            globalName: (me as any).globalName ?? me.username,
            avatar: me.avatar,
            banner: (me as any).banner ?? null,
            bio: (me as any).bio ?? "",
            accentColor: (me as any).accentColor ?? null,
            discriminator: me.discriminator ?? "0",
            publicFlags: (me as any).publicFlags ?? 0,
            flags: (me as any).flags ?? 0,
            premiumType: (me as any).premiumType ?? 0,
        };
    }

    activeFakeId = fake.id;
    dispatchUser(me.id, {
        username: fake.username,
        global_name: fake.globalName,
        avatar: fake.avatar,
        banner: fake.banner,
        bio: fake.bio,
        accent_color: fake.accentColor,
        discriminator: fake.discriminator,
        public_flags: fake.publicFlags,
        flags: fake.flags,
        premium_type: fake.premiumType,
    });
}

function restoreReal() {
    if (!realSnapshot) return;
    const me = UserStore.getCurrentUser();
    if (!me) return;

    dispatchUser(me.id, {
        username: realSnapshot.username,
        global_name: realSnapshot.globalName,
        avatar: realSnapshot.avatar,
        banner: realSnapshot.banner,
        bio: realSnapshot.bio,
        accent_color: realSnapshot.accentColor,
        discriminator: realSnapshot.discriminator,
        public_flags: realSnapshot.publicFlags,
        flags: realSnapshot.flags,
        premium_type: realSnapshot.premiumType,
    });

    activeFakeId = null;
    realSnapshot = null;
}

function dispatchUser(id: string, fields: Record<string, unknown>) {
    FluxDispatcher.dispatch({ type: "USER_UPDATE", user: { id, ...fields } });
    try {
        const updated = UserStore.getCurrentUser();
        if (updated) FluxDispatcher.dispatch({ type: "CURRENT_USER_UPDATE", user: { ...updated } });
        FluxDispatcher.dispatch({ type: "IDLE" });
    } catch (err) { logger.debug("Ignored error", err); }
    store?.emitChange?.();
}

function persistIds() {
    DataStore.set(DS_KEY, fakeAccounts.map(f => f.id));
}

function buildFake(userId: string): FakeAccount | null {
    const user = UserStore.getUser(userId) as any;
    if (!user) return null;
    const profile = UserProfileStore?.getUserProfile?.(userId) ?? {};
    return {
        id: userId,
        username: user.username,
        globalName: user.globalName ?? user.username,
        discriminator: user.discriminator ?? "0",
        avatar: user.avatar ?? null,
        bio: profile.bio ?? "",
        banner: profile.banner ?? null,
        accentColor: profile.accentColor ?? null,
        publicFlags: user.publicFlags ?? 0,
        flags: user.flags ?? 0,
        premiumType: user.premiumType ?? 0,
    };
}

function addToSwitcher(userId: string) {
    if (fakeAccounts.some(f => f.id === userId)) return;
    const fake = buildFake(userId);
    if (!fake) return;
    fakeAccounts.push(fake);
    persistIds();
    patchStore();
    store?.emitChange?.();
}

function removeFromSwitcher(userId: string) {
    const idx = fakeAccounts.findIndex(f => f.id === userId);
    if (idx === -1) return;
    if (activeFakeId === userId) restoreReal();
    fakeAccounts.splice(idx, 1);
    persistIds();
    store?.emitChange?.();
}

// The switcher click makes Discord attempt a real switch that fails (no token); we catch
// the failure/attempt and apply the local fake instead.
function onSwitch(action: any) {
    const userId = action.userId ?? action.user_id ?? action.id;
    const fake = fakeAccounts.find(f => f.id === userId);
    if (fake) applyFake(fake);
}

function onRemoveAccount(action: any) {
    const userId = action.userId ?? action.user_id ?? action.id;
    if (userId) removeFromSwitcher(userId);
}

// ── UI ──────────────────────────────────────────────────────────────────────
function RestoreIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
        </svg>
    );
}

function FakeIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
        </svg>
    );
}

function RestoreButton() {
    const [active, setActive] = React.useState(!!activeFakeId);
    React.useEffect(() => {
        const timer = setInterval(() => setActive(!!activeFakeId), 2000);
        return () => clearInterval(timer);
    }, []);
    if (!active) return null;
    return (
        <HeaderBarButton
            icon={RestoreIcon}
            tooltip={t("حساب وهمي مُفعّل — انقر لاستعادة حسابك الحقيقي", "Fake account active — click to restore your real account")}
            onClick={() => { restoreReal(); setActive(false); }}
        />
    );
}

const ctxPatch: NavContextMenuPatchCallback = (children, props) => {
    const user = (props as any)?.user;
    if (!Array.isArray(children) || !user) return;
    if (user.id === UserStore.getCurrentUser()?.id) return;

    const already = fakeAccounts.some(f => f.id === user.id);
    children.push(
        <Menu.MenuItem
            id="esharq-fake-account"
            label={already
                ? t("إزالة من مبدّل الحسابات الوهمي", "Remove from Fake Switcher")
                : t("إضافة إلى مبدّل الحسابات الوهمي", "Add to Fake Switcher")}
            icon={FakeIcon}
            action={() => already ? removeFromSwitcher(user.id) : addToSwitcher(user.id)}
        />
    );
};

export default definePlugin({
    name: "FakeAccount",
    description: "Add users to your account switcher and locally take on their appearance. Purely visual — only you see it; your real account and token are never touched, and nothing is sent to Discord.",
    authors: [{ name: t("مؤلف غير معروف", "Unknown"), id: 0n }],
    dependencies: ["HeaderBarAPI"],

    async start() {
        FluxDispatcher.subscribe("MULTI_ACCOUNT_SWITCH_FAILURE", onSwitch);
        FluxDispatcher.subscribe("MULTI_ACCOUNT_SWITCH_ATTEMPT", onSwitch);
        FluxDispatcher.subscribe("MULTI_ACCOUNT_REMOVE_ACCOUNT", onRemoveAccount);

        addContextMenuPatch("user-context", ctxPatch);
        addContextMenuPatch("user-profile-actions", ctxPatch);
        addHeaderBarButton("esharq-fake-account-restore", () => <RestoreButton />, 5);

        waitFor(["getUsers", "getValidUsers", "getHasLoggedInAccounts"], async (mod: any) => {
            if (store || !isMultiAccountStore(mod)) return;
            store = mod;

            const savedIds: string[] = (await DataStore.get(DS_KEY)) ?? [];
            for (const id of savedIds) {
                if (fakeAccounts.some(f => f.id === id)) continue;
                const fake = buildFake(id);
                if (fake) fakeAccounts.push(fake);
            }

            patchStore();
            setTimeout(() => mod.emitChange?.(), 500);
        });
    },

    stop() {
        FluxDispatcher.unsubscribe("MULTI_ACCOUNT_SWITCH_FAILURE", onSwitch);
        FluxDispatcher.unsubscribe("MULTI_ACCOUNT_SWITCH_ATTEMPT", onSwitch);
        FluxDispatcher.unsubscribe("MULTI_ACCOUNT_REMOVE_ACCOUNT", onRemoveAccount);
        removeContextMenuPatch("user-context", ctxPatch);
        removeContextMenuPatch("user-profile-actions", ctxPatch);
        removeHeaderBarButton("esharq-fake-account-restore");

        if (activeFakeId) restoreReal();
        fakeAccounts = [];
        unpatchStore();
        store = null;
    },
});
