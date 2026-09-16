/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DeleteIcon } from "@components/Icons";
import { classNameFactory } from "@utils/css";
import { t } from "@utils/esharqI18n";
import { React, useCallback, useEffect, useRef, useState } from "@webpack/common";

import { Entry, getFile, Group, Kind } from "../library";

export const cl = classNameFactory("vc-bie-");

const SQUARE = new Set(["AVATAR", "AVATAR_DECORATION", "GUILD_ICON", "PERSONAL_WIDGET_FIELD"]);

// 🔴 أزواجٌ خامّ [عربي، إنجليزي] لا نصوص t(): الثابت يُقيَّم عند تحميل الوحدة، وقد يسبق prefsReady
// فتُقرأ اللغة قبل جاهزية الإعدادات؛ لذا تُحلّ لحظة الاستدعاء. وهي خامّ لأنّ t() تعزل اتجاهياً،
// فتُبنى كلّ جملة من نصف لغتها مباشرةً بلا عزلٍ مزدوج
const KIND_NAMES: Record<string, readonly [ar: string, en: string]> = {
    AVATAR: ["الصور الرمزية", "avatars"],
    BANNER: ["اللافتات", "banners"],
    GUILD_ICON: ["أيقونات الخوادم", "server icons"],
    GUILD_BANNER: ["لافتات الخوادم", "server banners"],
    SCHEDULED_EVENT_IMAGE: ["أغلفة الفعاليات", "event covers"],
    HOME_HEADER: ["ترويسات الصفحة الرئيسية", "home headers"],
    AVATAR_DECORATION: ["الزينات", "decorations"],
    PERSONAL_WIDGET_COVER: ["أغلفة الأدوات", "widget covers"],
    PERSONAL_WIDGET_FIELD: ["صور الأدوات", "widget images"]
};

// نوعٌ لا نعرفه يُسمّى «الصور» بالعربية، لا بمعرّفه اللاتينيّ وسط جملة عربية
const kindName = (kind: Kind) => KIND_NAMES[kind] ?? ["الصور", kind.toLowerCase().replace(/_/g, " ")] as const;

const isAnimated = (entry: Entry) => entry.type === "image/gif" || entry.name.toLowerCase().endsWith(".gif");
export const croppedLabel = (kind: Kind) => {
    const [ar, en] = kindName(kind);
    return t(`${ar} المقصوصة`, `Cropped ${en}`);
};

const PinIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
        <path d="M15 4V9l3 3v2h-5v7l-1 1-1-1v-7H6v-2l3-3V4H8V2h8v2z" />
    </svg>
);

export function Shelf({ kind, group, entries, thumbs, activeId, wornId, onGroup, onPick, onPin, onForget, onPutBack }: {
    kind: Kind;
    group: Group;
    entries: Entry[];
    thumbs: Record<string, string>;
    activeId: string | null;
    wornId: string | null;
    onGroup(group: Group): void;
    onPick(entry: Entry): void;
    onPin(entry: Entry): void;
    onForget(entry: Entry, immediate: boolean): void;
    onPutBack?(): void;
}) {
    const shape = SQUARE.has(kind) ? "square" : "wide";

    const [hovered, setHovered] = useState<string | null>(null);
    const [playing, setPlaying] = useState<Record<string, string>>({});
    const played = useRef<string[]>([]);

    useEffect(() => () => played.current.forEach(URL.revokeObjectURL), []);

    const play = useCallback(async (entry: Entry) => {
        setHovered(entry.id);
        if (!isAnimated(entry) || playing[entry.id]) return;

        const blob = await getFile(entry.id);
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        played.current.push(url);
        setPlaying(current => ({ ...current, [entry.id]: url }));
    }, [playing]);

    return (
        <div className={cl("panel", shape)}>
            <div className={cl("tabs")} role="tablist">
                <button
                    type="button"
                    role="tab"
                    aria-selected={group === "original"}
                    className={cl("tab", { on: group === "original" })}
                    onClick={() => onGroup("original")}
                >{t("الأصلية", "Originals")}</button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={group === "cropped"}
                    className={cl("tab", { on: group === "cropped" })}
                    onClick={() => onGroup("cropped")}
                >{croppedLabel(kind)}</button>

                {onPutBack && (
                    <button type="button" className={cl("action")} onClick={onPutBack}>
                        {t("أعِد السابقة", "Put back the last one")}
                    </button>
                )}

            </div>

            <div className={cl("strip")} role="group" aria-label={t("الصور المحفوظة", "Saved pictures")}>
                {entries.map(entry => (
                    <div
                        key={entry.id}
                        className={cl("item", { pinned: entry.pinned, worn: entry.id === wornId })}
                        onMouseEnter={() => play(entry)}
                        onMouseLeave={() => setHovered(null)}
                    >
                        <button
                            type="button"
                            aria-label={entry.name}
                            title={entry.id === wornId ? `${entry.name}
${t("مستخدَمة حالياً", "You are wearing this")}` : entry.name}
                            className={cl("thumb", { active: activeId === entry.id })}
                            style={{ backgroundImage: `url(${(hovered === entry.id && playing[entry.id]) || thumbs[entry.id]})` }}
                            onClick={() => onPick(entry)}
                            onContextMenu={event => {
                                event.preventDefault();
                                onForget(entry, event.shiftKey);
                            }}
                        />
                        <button
                            type="button"
                            className={cl("remove")}
                            aria-label={t(`إزالة ${entry.name}`, `Remove ${entry.name}`)}
                            title={t("إزالة. اضغط مع Shift لتخطّي التأكيد", "Remove. Hold Shift to skip the confirmation")}
                            onClick={event => onForget(entry, event.shiftKey)}
                        >
                            <DeleteIcon width={10} height={10} />
                        </button>
                        <button
                            type="button"
                            aria-pressed={!!entry.pinned}
                            className={cl("pin", { on: entry.pinned })}
                            aria-label={entry.pinned ? t(`إلغاء تثبيت ${entry.name}`, `Unpin ${entry.name}`) : t(`تثبيت ${entry.name}`, `Pin ${entry.name}`)}
                            title={entry.pinned
                                ? t("مثبّتة، فلن تسقط من الرفّ أبداً", "Pinned, so it never drops off the shelf")
                                : t("ثبّتها كي لا تسقط من الرفّ أبداً", "Pin so it never drops off the shelf")}
                            onClick={() => onPin(entry)}
                        >
                            <PinIcon width={10} height={10} />
                        </button>
                    </div>
                ))}

                {!entries.length && (
                    <span className={cl("empty")}>
                        {group === "original"
                            ? t("تظهر هنا الصور التي تختارها أو تلصقها أو تسحبها", "Pictures you pick, paste or drop land here")
                            : t("تظهر هنا الصور التي تقصّها", "Pictures you crop land here")}
                    </span>
                )}
            </div>
        </div>
    );
}
