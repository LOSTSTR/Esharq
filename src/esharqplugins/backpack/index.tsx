/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import {
    BACKPACK_ID,
    BACKPACK_SURFACES,
    BackpackSurface,
    getPinnedKeys,
    isPinned,
    isStealth,
    setBackpackActive,
    setPinned,
    setPinnedKeys,
    setStealth,
    showsInBackpack,
    useBackpackVersion
} from "@api/Backpack";
import { ChatBarButtonMap, getLastChatBarProps } from "@api/ChatButtons";
import { _getChannelToolbarButtons, _getHeaderBarButtons } from "@api/HeaderBar";
import * as DataStore from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { buttons as userAreaButtons, UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import ErrorBoundary from "@components/ErrorBoundary";
import { openPluginModal } from "@components/settings";
import { settingsPanelButtons, SettingsPanelTooltipButton } from "@plugins/philsPluginLibrary";
import { EquicordDevs } from "@utils/constants";
import { t } from "@utils/esharqI18n";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { ContextMenuApi, Menu, Popout, React, showToast, Toasts, Tooltip, useEffect, useRef, useState } from "@webpack/common";

import { comboFromEvent, hasModifier, matchesCombo, prettyCombo } from "./hotkey";

/**
 * **الحقيبة** — واجهة ديسكورد نظيفة، وأزرار الإضافات كلّها خلف زرٍّ واحد.
 *
 * ## المشكلة
 *
 * كل إضافة تُفعّلها تضع زرّها في الواجهة، وليست الأزرار في مكان واحد: خمسة
 * مواضع على الشاشة تتقاسمها. فعشر إضافات ذات أزرار تكفي لتصير النافذة أشبه
 * بلوحة قيادة، ولا حلّ إلّا تعطيل إضافات تريدها.
 *
 * ## الحلّ
 *
 * زرّ واحد في لوحة الحساب — قرب المايك — يبتلعها كلّها ويعرضها في لوحته
 * **تعمل كما هي**: لا صور لها ولا نسخ، بل المكوّنات نفسها. فالزرّ الذي
 * يُشغّل FakeDeafen يُشغّله من داخل الحقيبة تماماً كما من مكانه.
 *
 * 🔴 **ولا يُمسّ زرّ من أزرار ديسكورد.** المايك والسمّاعة والإعدادات والبريد
 * والمثبّتة والأعضاء تبقى كما هي — الحقيبة لا ترى إلّا ما سجّلته إضافاتنا.
 *
 * ## ما يُحفظ هو المُثبَّت، لا المحزوم
 *
 * لو حفظنا «المحزوم» لقفزت كل إضافة جديدة إلى الواجهة يوم يُفعّلها المستخدم،
 * فيعود الزحام. والمحفوظ عندنا **ما اختار إبقاءه ظاهراً**، وما عداه — بما لم
 * يُثبَّت بعد — يذهب إلى الحقيبة وحده. الشرح كاملاً في `api/Backpack.ts`.
 *
 * ## وضع التخفّي
 *
 * اختصار يُخفي **كل شيء** — الحقيبة وصندوق أدوات إشراق معهما — فتبدو النافذة
 * ديسكورد رسمياً. والضغطة الثانية تُعيد كل شيء كما كان.
 *
 * 🔴 ولأنّه يُخفي مفتاحه نفسه، يمتنع تشغيله ما لم يكن هناك اختصار مسجَّل،
 * ويُطفأ من تلقائه إن مُحي الاختصار وهو مُشتغل. وصفحة إعدادات الإضافة تبقى
 * مخرجاً مضموناً في كل حال.
 */

const logger = new Logger("Backpack", "#c9a227");

/** المفاتيح المثبَّتة — قائمة `surface:id`. */
const STORE_KEY = "Esharq_Backpack_pinned_v2";
/** حالة التخفّي تعبر إعادة التشغيل، وإلّا عاد الزحام لمن أراد نافذةً نظيفة دائماً. */
const STEALTH_KEY = "Esharq_Backpack_stealth";

/** صندوق أدوات إشراق يبقى ظاهراً افتراضياً: هو باب الإعدادات كلّه. */
const DEFAULT_PINNED = ["headerBar:EquicordToolbox"];

// ─── الشعار ───────────────────────────────────────────────────────────────────

/**
 * سداسية إشراق وحرف E — **الشعار نفسه** الذي يحمله صندوق الأدوات، بلا فرق.
 *
 * ويأخذ لونه من `currentColor` فيتبع حالة الزرّ في لوحة الحساب (عادي ·
 * مُمرَّر · مفتوح) كبقيّة أزرارها، بلا لون مثبَّت يشذّ عنها.
 */
export function EsharqMark(props: React.SVGProps<SVGSVGElement>) {
    const { width = 20, height = 20, ...rest } = props;
    return (
        <svg viewBox="0 0 24 24" width={width} height={height} {...rest}>
            <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
                d="M12 2.6 20.1 7.3v9.4L12 21.4 3.9 16.7V7.3Z"
            />
            <path
                fill="currentColor"
                d="M15.4 8.2H9.9c-1 0-1.6.5-1.6 1.4v4.8c0 .9.6 1.4 1.6 1.4h5.5v-1.7h-5.2v-1.3h4.6v-1.6H10.2V9.9h5.2Z"
            />
        </svg>
    );
}

// ─── الأسطح الخمسة ────────────────────────────────────────────────────────────

const SURFACE_LABEL: Record<BackpackSurface, () => string> = {
    chatBar: () => t("شريط الكتابة", "Chat bar"),
    headerBar: () => t("ترويسة النافذة", "Window header"),
    channelToolbar: () => t("شريط أدوات القناة", "Channel toolbar"),
    userArea: () => t("لوحة الحساب", "Account panel"),
    voicePanel: () => t("لوحة الصوت", "Voice panel")
};

/** أسماء ما هو مسجَّل الآن في كل سطح — تُقرأ حيّةً عند كل عرض. */
function readSurface(surface: BackpackSurface): string[] {
    switch (surface) {
        case "chatBar": return [...ChatBarButtonMap.keys()];
        case "headerBar": return [..._getHeaderBarButtons().keys()];
        case "channelToolbar": return [..._getChannelToolbarButtons().keys()];
        case "userArea": return [...userAreaButtons.keys()];
        case "voicePanel": return settingsPanelButtons.map(button => button.name);
    }
}

interface SurfaceGroup {
    surface: BackpackSurface;
    ids: string[];
}

function readAllSurfaces(): SurfaceGroup[] {
    return BACKPACK_SURFACES
        .map(surface => ({ surface, ids: readSurface(surface).sort() }))
        .filter(group => group.ids.length > 0);
}

/**
 * يرسم الزرّ الحقيقيّ داخل لوحة الحقيبة.
 *
 * 🔴 أزرار شريط الكتابة وحدها تحتاج خصائص لا تملكها الحقيبة: الشريط يُمرّرها
 * إليها من ديسكورد (القناة · نوع المحرّر · صلاحياته). فبدل تلفيقها — وهي
 * كائن من ثلاثين حقلاً يقرأ منها كل زرّ ما يشاء — يحتفظ `ChatButtons` بآخر
 * ما سلّمه ديسكورد فعلاً، وتُعاد الأزرار به. وإن لم تُفتَح محادثة بعدُ فلا
 * خصائص، فيُقال ذلك بدل أن يُرسَم زرّ ينفجر عند أول نقرة.
 */
function PackedButton({ surface, id, props }: { surface: BackpackSurface; id: string; props: UserAreaRenderProps; }) {
    switch (surface) {
        case "chatBar": {
            const data = ChatBarButtonMap.get(id);
            const chatBarProps = getLastChatBarProps();
            if (data == null) return null;
            if (chatBarProps == null) {
                return (
                    <div className="esharq-backpack-unavailable">
                        {t("افتح محادثة أولاً", "Open a chat first")}
                    </div>
                );
            }
            const Button = data.render;
            return <Button {...chatBarProps} isMainChat isAnyChat />;
        }

        case "headerBar":
        case "channelToolbar": {
            const registry = surface === "headerBar" ? _getHeaderBarButtons() : _getChannelToolbarButtons();
            const entry = registry.get(id);
            if (entry == null) return null;
            const Button = entry.render;
            return <Button />;
        }

        case "userArea": {
            const entry = userAreaButtons.get(id);
            if (entry == null) return null;
            const Button = entry.render;
            return <>{Button(props)}</>;
        }

        case "voicePanel": {
            const button = settingsPanelButtons.find(entry => entry.name === id);
            if (button == null) return null;
            return (
                <SettingsPanelTooltipButton
                    tooltipProps={{ text: button.tooltipText ?? button.name }}
                    icon={button.icon}
                    onClick={button.onClick}
                />
            );
        }
    }
}

// ─── الحفظ ────────────────────────────────────────────────────────────────────

async function loadPinned(): Promise<void> {
    try {
        const stored = await DataStore.get<string[]>(STORE_KEY);
        setPinnedKeys(stored ?? DEFAULT_PINNED);
    } catch (err) {
        logger.error("Failed to load pinned buttons", err);
        setPinnedKeys(DEFAULT_PINNED);
    }
}

async function savePinned(): Promise<void> {
    try {
        await DataStore.set(STORE_KEY, getPinnedKeys());
    } catch (err) {
        logger.error("Failed to save pinned buttons", err);
    }
}

function pin(surface: BackpackSurface, id: string, value: boolean) {
    setPinned(surface, id, value);
    void savePinned();
}

// ─── وضع التخفّي ──────────────────────────────────────────────────────────────

/** التخفّي يُخفي مفتاحه، فلا يُشتغل بلا اختصار يُخرج منه. */
function canStealth(): boolean {
    return settings.store.stealthHotkey !== "";
}

function toggleStealth(next = !isStealth()) {
    if (next && !canStealth()) {
        showToast(t(
            "سجّل اختصاراً أولاً — وإلّا لن تجد ما يُخرجك من التخفّي.",
            "Record a hotkey first — otherwise nothing would bring you back."
        ), Toasts.Type.FAILURE);
        return;
    }

    setStealth(next);
    void DataStore.set(STEALTH_KEY, next).catch(err => logger.error("Failed to save stealth state", err));

    if (next) {
        showToast(t(
            `وضع التخفّي — ${prettyCombo(settings.store.stealthHotkey)} يُعيد كل شيء`,
            `Stealth mode — ${prettyCombo(settings.store.stealthHotkey)} brings everything back`
        ), Toasts.Type.SUCCESS);
    }
}

function onKeyDown(event: KeyboardEvent) {
    if (!matchesCombo(event, settings.store.stealthHotkey)) return;

    event.preventDefault();
    event.stopPropagation();
    toggleStealth();
}

// ─── مسجّل الاختصار ───────────────────────────────────────────────────────────

function HotkeyRecorder() {
    const [recording, setRecording] = useState(false);
    const combo = settings.use(["stealthHotkey"]).stealthHotkey;

    useEffect(() => {
        if (!recording) return;

        const capture = (event: KeyboardEvent) => {
            event.preventDefault();
            event.stopPropagation();

            if (event.code === "Escape") {
                setRecording(false);
                return;
            }

            const next = comboFromEvent(event);
            // مُعدِّلٌ وحده ليس اختصاراً — ننتظر الحرف الذي معه.
            if (next === null) return;

            // 🔴 بلا مُعدِّل يسرق الاختصار كل ضغطة على ذلك الحرف — بما فيها
            // ما يُكتب في مربّع الرسالة.
            if (!hasModifier(next)) {
                showToast(t(
                    "اختر تركيبة فيها Ctrl أو Alt — الحرف وحده يسرق الكتابة.",
                    "Pick a combo with Ctrl or Alt — a bare key would steal your typing."
                ), Toasts.Type.FAILURE);
                return;
            }

            settings.store.stealthHotkey = next;
            setRecording(false);
        };

        window.addEventListener("keydown", capture, true);
        return () => window.removeEventListener("keydown", capture, true);
    }, [recording]);

    return (
        <div className="esharq-backpack-hotkey">
            <button
                className="esharq-backpack-hotkey-field"
                data-recording={recording}
                onClick={() => setRecording(value => !value)}
            >
                {recording
                    ? t("اضغط التركيبة الآن…", "Press the combo now…")
                    : combo === ""
                        ? t("لا اختصار", "No hotkey")
                        : prettyCombo(combo)}
            </button>
            {combo !== "" && !recording && (
                <button
                    className="esharq-backpack-hotkey-clear"
                    onClick={() => {
                        settings.store.stealthHotkey = "";
                        // لا يبقى تخفٍّ بلا مخرج.
                        if (isStealth()) toggleStealth(false);
                    }}
                >
                    {t("امسح", "Clear")}
                </button>
            )}
        </div>
    );
}

const settings = definePluginSettings({
    stealthHotkey: {
        type: OptionType.COMPONENT,
        default: "",
        get description() {
            return t(
                "اختصار وضع التخفّي — يُخفي كل ما تضيفه الإضافات، حتى الحقيبة وصندوق الأدوات، فتبدو النافذة ديسكورد رسمياً. والضغطة الثانية تُعيدها.",
                "Stealth mode hotkey — hides everything the plugins add, the Backpack and the toolbox included, so the window looks like stock Discord. Press it again to bring it all back."
            );
        },
        component: () => <HotkeyRecorder />
    },
    showBadge: {
        type: OptionType.BOOLEAN,
        default: true,
        get description() {
            return t("أظهر عدد الأزرار المحزومة على الحقيبة", "Show the packed button count on the Backpack");
        }
    },
    openWithHover: {
        type: OptionType.BOOLEAN,
        default: false,
        get description() {
            return t("افتح الحقيبة بمرور المؤشّر لا بالنقر", "Open the Backpack on hover instead of a click");
        }
    }
});

// ─── قائمة النقر الأيمن ───────────────────────────────────────────────────────

function BackpackContextMenu() {
    useBackpackVersion();
    const groups = readAllSurfaces();

    const setAll = (value: boolean) => {
        for (const { surface, ids } of groups) {
            for (const id of ids) setPinned(surface, id, value);
        }
        void savePinned();
    };

    return (
        <Menu.Menu navId="esharq-backpack" onClose={ContextMenuApi.closeContextMenu} aria-label={t("الحقيبة", "Backpack")}>
            <Menu.MenuGroup label={t("ما يبقى ظاهراً في الواجهة", "What stays visible in the interface")}>
                {groups.map(({ surface, ids }) => (
                    <Menu.MenuItem
                        key={surface}
                        id={`esharq-backpack-surface-${surface}`}
                        label={`${SURFACE_LABEL[surface]()} (${ids.length})`}
                    >
                        {ids.map(id => (
                            <Menu.MenuCheckboxItem
                                key={id}
                                id={`esharq-backpack-pin-${surface}-${id}`}
                                label={id}
                                checked={isPinned(surface, id)}
                                action={() => pin(surface, id, !isPinned(surface, id))}
                            />
                        ))}
                    </Menu.MenuItem>
                ))}
            </Menu.MenuGroup>

            <Menu.MenuGroup>
                <Menu.MenuItem
                    id="esharq-backpack-pack-all"
                    label={t("احزم كل شيء", "Pack everything")}
                    action={() => setAll(false)}
                />
                <Menu.MenuItem
                    id="esharq-backpack-show-all"
                    label={t("أظهر كل شيء", "Show everything")}
                    action={() => setAll(true)}
                />
                <Menu.MenuItem
                    id="esharq-backpack-reset"
                    label={t("أعد الافتراضي", "Restore the default")}
                    action={() => { setPinnedKeys(DEFAULT_PINNED); void savePinned(); }}
                />
            </Menu.MenuGroup>

            <Menu.MenuGroup>
                <Menu.MenuCheckboxItem
                    id="esharq-backpack-stealth"
                    label={t("وضع التخفّي", "Stealth mode")}
                    checked={isStealth()}
                    disabled={!canStealth()}
                    action={() => toggleStealth()}
                />
                <Menu.MenuItem
                    id="esharq-backpack-settings"
                    label={t("إعدادات الحقيبة", "Backpack settings")}
                    action={() => openPluginModal(Vencord.Plugins.plugins.Backpack)}
                />
            </Menu.MenuGroup>
        </Menu.Menu>
    );
}

// ─── اللوحة ───────────────────────────────────────────────────────────────────

function BackpackPopout({ props }: { props: UserAreaRenderProps; }) {
    useBackpackVersion();
    const [arranging, setArranging] = useState(false);

    // تُقرأ عند كل عرض بلا `useMemo`: السجلّات تتبدّل بتفعيل إضافة أو تعطيلها،
    // وأي قائمة اعتماديات هنا تكون إمّا كاذبة أو أغلى من الحساب نفسه — وهو
    // مرورٌ على بضع عشرات من الأسماء.
    const groups = readAllSurfaces()
        .map(({ surface, ids }) => ({ surface, ids: ids.filter(id => showsInBackpack(surface, id)) }))
        .filter(group => group.ids.length > 0);

    return (
        <div className="esharq-backpack-popout">
            <div className="esharq-backpack-head">
                <span className="esharq-backpack-title">{t("الحقيبة", "Backpack")}</span>
                <button
                    className="esharq-backpack-edit"
                    data-on={arranging}
                    onClick={() => setArranging(value => !value)}
                >
                    {arranging ? t("تمّ", "Done") : t("رتّب", "Arrange")}
                </button>
            </div>

            {arranging
                ? <ArrangeView />
                : groups.length === 0
                    ? (
                        <div className="esharq-backpack-empty">
                            {t(
                                "الحقيبة فارغة — كل الأزرار ظاهرة في الواجهة. اضغط «رتّب» لتُعيد ما تشاء إليها.",
                                "The Backpack is empty — every button is out in the interface. Press “Arrange” to put any of them back."
                            )}
                        </div>
                    )
                    : (
                        <div className="esharq-backpack-icons">
                            {groups.map(({ surface, ids }) => (
                                <div className="esharq-backpack-group" key={surface}>
                                    <div className="esharq-backpack-group-label">{SURFACE_LABEL[surface]()}</div>
                                    <div className="esharq-backpack-row">
                                        {ids.map(id => (
                                            <Tooltip text={id} key={id}>
                                                {tooltipProps => (
                                                    <div className="esharq-backpack-item" {...tooltipProps}>
                                                        <ErrorBoundary noop>
                                                            <PackedButton surface={surface} id={id} props={props} />
                                                        </ErrorBoundary>
                                                    </div>
                                                )}
                                            </Tooltip>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
        </div>
    );
}

/**
 * **وضع الترتيب** — أين يعيش كل زرّ، سطراً سطراً.
 *
 * 🔴 بالأسماء لا بالأيقونات قصداً. الأيقونة قد لا تُرسَم أصلاً في السياق
 * الحاليّ (زرّ يخصّ خادماً وأنت في رسالة خاصّة)، فقائمة أيقونات تُخفي عنك
 * نصف ما تملك. والاسم يظهر دائماً.
 */
function ArrangeView() {
    useBackpackVersion();

    return (
        <div className="esharq-backpack-arrange">
            <div className="esharq-backpack-hint">
                {t(
                    "اضغط أي زرّ لتنقله بين الحقيبة والواجهة. ما تُخرجه يعود إلى مكانه الأصليّ، وما تُعيده يختفي إلى هنا.",
                    "Press any button to move it between the Backpack and the interface. What you take out returns to its original place; what you put back disappears in here."
                )}
            </div>

            {readAllSurfaces().map(({ surface, ids }) => (
                <div className="esharq-backpack-group" key={surface}>
                    <div className="esharq-backpack-group-label">{SURFACE_LABEL[surface]()}</div>
                    {ids.filter(id => id !== BACKPACK_ID).map(id => {
                        const outside = isPinned(surface, id);
                        return (
                            <button
                                key={id}
                                className="esharq-backpack-arrange-row"
                                onClick={() => pin(surface, id, !outside)}
                            >
                                <span className="esharq-backpack-arrange-name">{id}</span>
                                <span className="esharq-backpack-arrange-state" data-outside={outside}>
                                    {outside
                                        ? t("في الواجهة", "In the interface")
                                        : t("في الحقيبة", "In the Backpack")}
                                </span>
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}

// ─── زرّ لوحة الحساب ──────────────────────────────────────────────────────────

function BackpackButton(props: UserAreaRenderProps) {
    useBackpackVersion();
    const { showBadge, openWithHover } = settings.use(["showBadge", "openWithHover"]);
    const [open, setOpen] = useState(false);
    const anchor = useRef<HTMLDivElement>(null);

    /**
     * آخر ما ضُغط عليه — يُلتقط في طور الالتقاط فلا يفوتنا شيء.
     *
     * 🔴 لماذا نحتاجه: `Popout` يُغلق عند النقر خارجه ولا يمرّر الحدث، فلا سبيل
     * إلى معرفة **أين** نُقر إلّا برصده بأنفسنا.
     */
    const lastDown = useRef<Node | null>(null);

    useEffect(() => {
        const onDown = (e: Event) => { lastDown.current = e.target as Node; };
        document.addEventListener("pointerdown", onDown, true);
        return () => document.removeEventListener("pointerdown", onDown, true);
    }, []);

    const count = readAllSurfaces()
        .reduce((total, { surface, ids }) => total + ids.filter(id => showsInBackpack(surface, id)).length, 0);

    return (
        <Popout
            targetElementRef={anchor}
            renderPopout={() => <BackpackPopout props={props} />}
            shouldShow={open}
            onRequestClose={() => {
                /**
                 * 🔴 لا تُغلق الحقيبة على نقرةٍ داخل **لوحة إضافةٍ مُسقَطة**.
                 *
                 * كثيرٌ من الإضافات يفتح لوحته بـ`createPortal(..., document.body)`
                 * — أي **خارج `#app-mount`** بالكامل، قِستُه على FakeDM: القيمة
                 * `root.contains(panel)` كانت `false`. فلمّا كان زرّها داخل
                 * الحقيبة، عدّت النقرةَ في لوحتها «نقرةً خارج الحقيبة» فأُغلقت،
                 * فتفكّك الزرّ ومعه اللوحة — تُفتح ثمّ تختفي عند أوّل لمسة، ولا
                 * يظهر خطأ في أيّ سجلّ. رأيتُ الأزرار تهبط 6 ← 1 عند الإفلات.
                 *
                 * وواجهة ديسكورد كلّها داخل `#app-mount` (طبقاتُه ونوافذُه
                 * أيضاً)، فالاستثناء ضيّقٌ لا يُبطل الإغلاق الطبيعي.
                 */
                const target = lastDown.current;
                const root = document.getElementById("app-mount");
                if (target !== null && root !== null && !root.contains(target)) return;
                setOpen(false);
            }}
            position="top"
            align="left"
            spacing={8}
        >
            {() => (
                <div
                    ref={anchor}
                    className="esharq-backpack-anchor"
                    onMouseEnter={openWithHover ? () => setOpen(true) : undefined}
                >
                    <UserAreaButton
                        tooltipText={props.hideTooltips ? void 0 : t(
                            count > 0 ? `الحقيبة — ${count} زرّاً` : "الحقيبة",
                            count > 0 ? `Backpack — ${count} buttons` : "Backpack"
                        )}
                        icon={<EsharqMark className={props.iconForeground} />}
                        onClick={() => setOpen(value => !value)}
                        onContextMenu={event => {
                            event.preventDefault();
                            ContextMenuApi.openContextMenu(event, () => (
                                <ErrorBoundary noop>
                                    <BackpackContextMenu />
                                </ErrorBoundary>
                            ));
                        }}
                        aria-label={t("الحقيبة", "Backpack")}
                    />
                    {showBadge && count > 0 && <div className="esharq-backpack-badge">{count}</div>}
                </div>
            )}
        </Popout>
    );
}

// ─── الإضافة ──────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "Backpack",
    description: "Sweep every plugin button into one Backpack next to the mic, pin whichever you want to keep out, and hide all of it behind a hotkey.",
    authors: [EquicordDevs.LOSTSTR],
    tags: ["Customisation", "Organisation"],
    dependencies: ["UserAreaAPI"],
    enabledByDefault: true,
    // مطلوبة: الحقيبة تجمع أزرار الإضافات كلّها في شريط المحادثة، فتعطيلها
    // يُعيد الأزرار متناثرةً ويُخفي ما اعتاد المستخدم الوصول إليه من مكان
    // واحد. تُعرَض في «الإضافات المطلوبة» بلا مفتاح تعطيل.
    required: true,
    settings,

    userAreaButton: {
        icon: EsharqMark,
        render: BackpackButton,
        // إلى يمين المايك مباشرةً: أوّل ما تصل إليه اليد بعده.
        priority: 10
    },

    async start() {
        await loadPinned();
        setBackpackActive(true);

        window.addEventListener("keydown", onKeyDown, true);

        // 🔴 تخفٍّ محفوظ بلا اختصار = نافذة لا مخرج منها. يُطفأ قبل أن يُرى.
        try {
            const wasStealth = await DataStore.get<boolean>(STEALTH_KEY);
            if (wasStealth === true && canStealth()) {
                setStealth(true);
                showToast(t(
                    `وضع التخفّي مُفعَّل — ${prettyCombo(settings.store.stealthHotkey)} يُعيد كل شيء`,
                    `Stealth mode is on — ${prettyCombo(settings.store.stealthHotkey)} brings everything back`
                ), Toasts.Type.MESSAGE);
            } else if (wasStealth === true) {
                await DataStore.set(STEALTH_KEY, false);
            }
        } catch (err) {
            logger.error("Failed to restore stealth state", err);
        }
    },

    stop() {
        window.removeEventListener("keydown", onKeyDown, true);
        setBackpackActive(false);
    }
});
