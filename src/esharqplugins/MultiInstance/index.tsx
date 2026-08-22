/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType, type PluginNative } from "@utils/types";
import { Button, Forms, React, showToast, Toasts, useEffect, useState } from "@webpack/common";

const Native = IS_DISCORD_DESKTOP
    ? (VencordNative.pluginHelpers.MultiInstance as PluginNative<typeof import("./native")>)
    : null;

const MAX_INSTANCES = 5;
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,23}$/i;

/**
 * أسماء النسخ تُحفظ في الإعدادات — **أسماءٌ فقط**. لا توكن ولا معرّف حساب ولا
 * أيّ بيان دخول: هذه الإضافة لا ترى شيئاً من ذلك أصلاً.
 */
const settings = definePluginSettings({
    info: {
        type: OptionType.COMPONENT,
        component: () => (
            <Forms.FormText style={{ lineHeight: 1.8 }}>
                {t(
                    "كلّ نسخة نافذة ديسكورد مستقلّة بجلستها الخاصّة — تسجّل الدخول فيها بنفسك كما في متصفّح بملفّ تعريف جديد. لا تقرأ هذه الإضافة توكنك ولا تحفظه ولا تنقله بين النوافذ.",
                    "Each instance is a separate Discord window with its own session — you sign in there yourself, like a fresh browser profile. This plugin never reads, stores or moves your token."
                )}
            </Forms.FormText>
        )
    },
    names: {
        type: OptionType.STRING,
        description: t("أسماء النسخ، مفصولة بفاصلة.", "Instance names, comma separated."),
        default: "second",
        hidden: true
    }
});

const readNames = (): string[] =>
    (settings.store.names ?? "")
        .split(",")
        .map(s => s.trim())
        .filter(s => NAME_RE.test(s))
        .slice(0, MAX_INSTANCES);

const writeNames = (list: string[]) => {
    settings.store.names = [...new Set(list)].slice(0, MAX_INSTANCES).join(",");
};

function InstancePanel() {
    const [names, setNames] = useState(readNames);
    const [open, setOpen] = useState<string[]>([]);
    const [draft, setDraft] = useState("");

    const refresh = React.useCallback(() => {
        Native?.listOpen().then(setOpen).catch(() => setOpen([]));
    }, []);

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, 4000);
        return () => clearInterval(id);
    }, [refresh]);

    if (!Native) {
        return <Forms.FormText>{t("متاح على تطبيق سطح المكتب فقط.", "Desktop app only.")}</Forms.FormText>;
    }

    const act = async (fn: Promise<{ ok: boolean; error?: string; }>, okMsg: string) => {
        const r = await fn.catch(e => ({ ok: false, error: String(e) }));
        showToast(r.ok ? okMsg : (r.error ?? t("تعذّر التنفيذ.", "Failed.")),
            r.ok ? Toasts.Type.SUCCESS : Toasts.Type.FAILURE);
        refresh();
    };

    const add = () => {
        const name = draft.trim();
        if (!NAME_RE.test(name)) {
            showToast(t("اسم غير صالح — حروف وأرقام وشرطة فقط.", "Invalid name — letters, digits and dashes only."), Toasts.Type.FAILURE);
            return;
        }
        if (names.length >= MAX_INSTANCES) {
            showToast(t(`الحدّ ${MAX_INSTANCES} نسخ.`, `Limit is ${MAX_INSTANCES} instances.`), Toasts.Type.FAILURE);
            return;
        }
        const next = [...new Set([...names, name])];
        setNames(next);
        writeNames(next);
        setDraft("");
    };

    const remove = async (name: string) => {
        const next = names.filter(n => n !== name);
        setNames(next);
        writeNames(next);
        await act(Native.forgetInstance(name), t("مُسحت الجلسة.", "Session cleared."));
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {names.map(name => (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ flex: 1, fontWeight: 600 }}>
                        {name}
                        {open.includes(name) && (
                            <span style={{ marginInlineStart: 8, fontSize: 12, color: "var(--text-muted)" }}>
                                {t("مفتوحة", "open")}
                            </span>
                        )}
                    </span>
                    <Button size={Button.Sizes.SMALL}
                        onClick={() => act(Native.openInstance(name), t("فُتحت النسخة.", "Instance opened."))}>
                        {t("افتح", "Open")}
                    </Button>
                    <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY}
                        onClick={() => act(Native.closeInstance(name), t("أُغلقت.", "Closed."))}>
                        {t("أغلق", "Close")}
                    </Button>
                    <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={() => remove(name)}>
                        {t("احذف وامسح الجلسة", "Delete & clear session")}
                    </Button>
                </div>
            ))}

            <div style={{ display: "flex", gap: 8 }}>
                <input
                    value={draft}
                    onChange={e => setDraft(e.currentTarget.value)}
                    placeholder={t("اسم نسخة جديدة", "New instance name")}
                    style={{
                        flex: 1, padding: "6px 10px", borderRadius: 8,
                        border: "1px solid var(--background-modifier-accent)",
                        background: "var(--input-background)", color: "var(--text-normal)"
                    }}
                />
                <Button size={Button.Sizes.SMALL} onClick={add}>{t("أضف", "Add")}</Button>
            </div>
        </div>
    );
}

export default definePlugin({
    name: "MultiInstance",
    description: t(
        "افتح نوافذ ديسكورد إضافية، لكلٍّ جلستها المستقلّة — بلا قراءة توكنك ولا حفظه.",
        "Open extra Discord windows, each with its own independent session — without reading or storing your token."
    ),
    authors: [EquicordDevs.LOSTSTR],
    tags: ["Utility"],
    settings,

    settingsAboutComponent: () => <InstancePanel />
});
