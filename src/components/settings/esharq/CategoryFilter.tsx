/*
 * Esharq, a Discord client mod
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./motion.css";

import { t } from "@utils/esharqI18n";
import { React, useEffect, useRef, useState } from "@webpack/common";

import { ACCENT, RADIUS, SURFACE, UNIT } from "./tokens";

/**
 * مرشِّح الفئات — **لوحة تُعرض فيها كل الفئات بعدّاداتها**، لا قائمة تُفتح
 * وتُغلق على مهل.
 *
 * القائمة المنسدلة العادية تُظهر الفئات واحدةً واحدة، فلا يعرف المستخدم أن
 * «الأدوات» فيها 168 إضافة و«التفاعلات» فيها 3 إلّا بعد أن يختار ويرى.
 * والعدّاد بجانب الاسم يُجيب قبل الضغط، فيعرف أين ينظر.
 *
 * 🔴 **اختيار متعدّد بمعنى «أو»**: من اختار «الصوت» و«الخصوصية» يريد
 * إضافات أيٍّ منهما، لا ما يجمع الاثنين — الأخير يُنتج قائمة فارغة غالباً
 * فيظنّ المستخدم أن المرشِّح معطوب.
 */

/** لون ثابت لكل فئة — مشتقّ من اسمها فلا يتبدّل بين جلسة وأخرى. */
export function categoryColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return `hsl(${hash % 360} 70% 62%)`;
}

interface Props {
    categories: readonly string[];
    /** كم إضافة في كل فئة — يُحسب مرّة في الصفحة لا هنا. */
    counts: Record<string, number>;
    selected: readonly string[];
    onChange(next: string[]): void;
    /** ترجمة اسم الفئة للعرض؛ الاسم نفسه يبقى مفتاح الترشيح. */
    label(name: string): string;
}

export function CategoryFilter({ categories, counts, selected, onChange, label }: Props) {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);

    // الإغلاق بالنقر خارجها: لوحة تبقى مفتوحة فوق المحتوى تحجب ما جاء
    // المستخدم ليراه.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    const toggle = (name: string) => {
        onChange(selected.includes(name)
            ? selected.filter(x => x !== name)
            : [...selected, name]);
    };

    return (
        <div ref={root} style={{ position: "relative" }}>
            <button
                onClick={() => setOpen(v => !v)}
                style={{
                    all: "unset",
                    boxSizing: "border-box",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: UNIT,
                    width: "100%",
                    padding: `${UNIT}px ${UNIT * 1.5}px`,
                    borderRadius: RADIUS / 2,
                    background: SURFACE[2],
                    border: `1px solid ${open ? ACCENT : "transparent"}`,
                    fontSize: 14
                }}
            >
                <span>{t("الفئات", "Categories")}</span>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {selected.length === 0 ? t("الكل", "All") : selected.length}
                </span>
            </button>

            {open && (
                <div className="esharq-rise" style={{
                    position: "absolute",
                    insetInlineStart: 0,
                    top: "calc(100% + 6px)",
                    zIndex: 10,
                    width: "max(100%, 520px)",
                    maxHeight: 340,
                    overflowY: "auto",
                    padding: UNIT * 2,
                    borderRadius: RADIUS,
                    background: SURFACE[1],
                    border: `1px solid ${SURFACE[3]}`,
                    boxShadow: "0 10px 28px rgb(0 0 0 / 35%)"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: UNIT }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{t("فئات الإضافات", "Plugin categories")}</div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                {t("تُعرض الإضافات التي تنتمي لأيٍّ من الفئات المختارة.",
                                    "Shows plugins belonging to any of the selected categories.")}
                            </div>
                        </div>
                        {selected.length > 0 && (
                            <button
                                onClick={() => onChange([])}
                                style={{ all: "unset", cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}
                            >
                                {t("مسح", "Clear")}
                            </button>
                        )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: `${UNIT / 2}px ${UNIT}px` }}>
                        {categories.map(name => {
                            const on = selected.includes(name);
                            return (
                                <label key={name} style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: UNIT,
                                    padding: `${UNIT / 2}px ${UNIT}px`,
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    background: on ? SURFACE[3] : "transparent"
                                }}>
                                    <input type="checkbox" checked={on} onChange={() => toggle(name)} style={{ cursor: "pointer" }} />
                                    <span style={{
                                        width: 7, height: 7, borderRadius: "50%",
                                        background: categoryColor(name), flexShrink: 0
                                    }} />
                                    <span style={{ fontSize: 13, flex: 1 }}>{label(name)}</span>
                                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{counts[name] ?? 0}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
