/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./panel.css";

import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { isPluginEnabled } from "@api/PluginManager";
import { t } from "@utils/esharqI18n";
import { useEffect, useReducer, useState } from "@webpack/common";

import { captureNow, hasRealNitro } from "./capture";
import { refresh } from "./restore";
import { clearSnapshot, getSnapshot, isLoaded, mergeSave, onSnapshotChange } from "./store";
import { LookSnapshot } from "./types";

/**
 * بنود الشكل، وصدقُ كلّ بندٍ عمّن يراه.
 *
 * 🔴 **`nobody` تُكتب كما هي.** المؤثّر واللوحة لا يُنتجهما شيءٌ في الشجرة
 * كلّها لأحد، وإخفاء ذلك يجعل المستخدم يظنّ أنّ أصدقاءه يرون شكله. و`modded`
 * تعني أنّ إضافةً أخرى تُوصلها لمن يُشغّلها — ولا نُكرّرها، بل نُسمّيها.
 */
const ITEMS: readonly {
    key: keyof LookSnapshot;
    ar: string;
    en: string;
    seenBy: "self" | "modded" | "nobody";
    covers?: { plugin: string; ar: string; en: string; };
}[] = [
    {
        key: "profileEffect", ar: "مؤثّر الملفّ", en: "Profile effect", seenBy: "nobody"
    },
    {
        key: "nameplate", ar: "لوحة الاسم", en: "Nameplate", seenBy: "nobody"
    },
    {
        key: "themeColors", ar: "ألوان الملفّ", en: "Profile colours", seenBy: "modded",
        covers: {
            plugin: "FakeProfileThemes",
            ar: "لإظهارها لمن يُشغّل إشراق أو فينكورد، فعّل FakeProfileThemes — يُخبّئها في نبذتك.",
            en: "To show these to other modded users, enable FakeProfileThemes — it hides them in your bio."
        }
    },
    {
        key: "avatarDecoration", ar: "إطار الصورة", en: "Avatar decoration", seenBy: "modded",
        covers: {
            plugin: "Decor",
            ar: "لإظهاره لغيرك، Decor يرفعه إلى خدمته ويعرضه لمن يُشغّلها.",
            en: "To show it to others, Decor uploads it to its service and shows it to whoever runs Decor."
        }
    },
    {
        key: "banner", ar: "لافتة الملفّ", en: "Profile banner", seenBy: "modded",
        covers: {
            plugin: "USRBG",
            ar: "لإظهارها لغيرك، USRBG تعرضها لمن يُشغّلها بعد قبول طلبك عندهم.",
            en: "To show it to others, USRBG shows it to whoever runs USRBG, once your request is accepted."
        }
    },
    { key: "accentColor", ar: "لون التمييز", en: "Accent colour", seenBy: "self" }
    // 🔴 لا تُذكر «الصورة الشخصية» هنا. تُلتقط في `capture.ts` لكن `restore.ts`
    // لا يكتبها في السجلّ البتّة، فذِكرها بعلامة ✓ وعدٌ لا يُوفى — وهذه اللوحة
    // وُضعت للصدق عمّا يُستعاد، فإدراجُ ما لا يُستعاد يهدم سببَ وجودها.
];

const SEEN_LABEL = {
    self: () => t("أنت وحدك", "You only"),
    modded: () => t("أنت ومَن يُشغّل الإضافة", "You + modded viewers"),
    nobody: () => t("أنت وحدك — لا بديل", "You only — no alternative")
};

function stamp(at: number): string {
    if (!at) return t("لم تُلتقط بعد", "Not captured yet");
    const days = Math.floor((Date.now() - at) / 86_400_000);
    if (days <= 0) return t("اليوم", "today");
    if (days === 1) return t("أمس", "yesterday");
    return t(`قبل ${days} يوماً`, `${days} days ago`);
}

function Panel() {
    const [, bump] = useReducer((n: number) => n + 1, 0);
    const [busy, setBusy] = useState(false);
    const [said, setSaid] = useState("");

    useEffect(() => onSnapshotChange(bump), []);

    const snap = getSnapshot();
    const live = hasRealNitro();

    // 🔴 اللوحة تُعرَض من بطاقة الإضافة حتّى وهي مُطفأة. وبلا هذا كانت أزرارها
    // تعمل بلا حسابٍ محمَّل: يُقال «حُفظ» ولا يُحفظ شيء، و«مُحيت» ولا يُمحى.
    const ready = isLoaded();

    const capture = async () => {
        setBusy(true);
        setSaid("");
        try {
            const patch = captureNow();
            if (!patch) {
                setSaid(t("لا شيء يُلتقط الآن. افتح ملفّك الشخصيّ مرّةً ثمّ أعد المحاولة.",
                    "Nothing to capture yet. Open your own profile once, then try again."));
                return;
            }
            await mergeSave(patch);
            refresh();
            setSaid(t("التُقط وحُفظ.", "Captured and saved."));
        } finally {
            setBusy(false);
        }
    };

    const wipe = async () => {
        await clearSnapshot();
        refresh();
        setSaid(t("مُحيت اللقطة.", "Snapshot cleared."));
    };

    return (
        <div className="esharq-pk">
            <div className="esharq-pk-card">
                <div className="esharq-pk-head">
                    <span className="esharq-pk-title">{t("لقطةُ شكلك", "Your saved look")}</span>
                    <span className={"esharq-pk-chip " + (live ? "live" : "gone")}>
                        {live
                            ? t("اشتراكك قائم", "Subscription active")
                            : t("لا اشتراك", "No subscription")}
                    </span>
                </div>

                <p className="esharq-pk-hint">
                    {live
                        ? t("ما دام اشتراكك قائماً لا تلمس هذه الإضافة ملفّك البتّة — تلتقط فقط. وحين ينتهي يظهر المحفوظ مكان ما فُقد، في عميلك أنت.",
                            "While your subscription is active this plugin never touches your profile — it only captures. When it ends, the saved look fills in what was lost, in your client.")
                        : t("اشتراكك منتهٍ، فالمحفوظ يُعرض الآن مكان ما فُقد. وهذا في عميلك أنت وحده — لا يُرسَل إلى ديسكورد ولا يُغيّر ما يراه غيرك.",
                            "Your subscription has ended, so the saved look now fills in what was lost. This is in your client only — nothing is sent to Discord and it does not change what others see.")}
                </p>

                <div className="esharq-pk-actions">
                    <Button size="small" disabled={busy || !ready} onClick={capture}>
                        {busy ? t("جارٍ الالتقاط…", "Capturing…") : t("التقط شكلي الآن", "Capture my look now")}
                    </Button>
                    {snap && (
                        <Button size="small" variant="secondary" disabled={!ready} onClick={wipe}>
                            {t("امحُ اللقطة", "Clear snapshot")}
                        </Button>
                    )}
                    <span className="esharq-pk-said">
                        {!ready
                            ? t("فعّل الإضافة أوّلاً ليُقرأ حسابك.", "Enable the plugin first so your account can be read.")
                            : said || t(`آخر التقاط: ${stamp(snap?.at ?? 0)}`, `Last capture: ${stamp(snap?.at ?? 0)}`)}
                    </span>
                </div>
            </div>

            <div className="esharq-pk-card">
                <div className="esharq-pk-head">
                    <span className="esharq-pk-title">{t("ما المحفوظ، ومَن يراه", "What is saved, and who sees it")}</span>
                </div>

                {ITEMS.map(item => {
                    // 🔴 `Boolean` وحدها تكذب: لونُ تمييزٍ قيمته ٠ (أسود) محفوظٌ
                    // فعلاً ويُستعاد، وكان يُعرَض «غير محفوظ».
                    const value = snap?.[item.key];
                    const saved = value !== null && value !== undefined;
                    const covered = item.covers && !isPluginEnabled(item.covers.plugin);
                    return (
                        <div className="esharq-pk-row" key={String(item.key)}>
                            <span className={"esharq-pk-mark " + (saved ? "yes" : "no")}>{saved ? "✓" : "—"}</span>
                            <span className="esharq-pk-name">
                                {t(item.ar, item.en)}
                                {covered && (
                                    <div className="esharq-pk-covered">{t(item.covers!.ar, item.covers!.en)}</div>
                                )}
                            </span>
                            <span className={"esharq-pk-seen " + item.seenBy}>{SEEN_LABEL[item.seenBy]()}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ErrorBoundary.wrap(Panel, { noop: true });
