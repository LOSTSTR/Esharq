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
            {/* 🔴 الشكل مأخوذ من صندوق ديسكورد المجاور بقياس حقيقي لا بتقدير:
                ارتفاع 40 · خلفية سوداء بشفافية 12% · حدّ 1px بشفافية 20% ·
                نصف قطر 8 · خطّ 16. صندوقان متجاوران بشكلين مختلفين يبدو
                أحدهما معطّلاً — وهو ما حدث: بدت «الفئات» كأنها مخفيّة. */}
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
                    height: 40,
                    padding: `0 ${UNIT * 1.5}px`,
                    borderRadius: 8,
                    background: "rgb(0 0 0 / 12%)",
                    border: `1px solid ${open ? ACCENT : "rgb(160 168 178 / 20%)"}`,
                    fontSize: 16,
                    color: "var(--text-normal)"
                }}
            >
                <span>
                    {t("الفئات", "Categories")}
                    {selected.length > 0 && (
                        <span style={{
                            marginInlineStart: UNIT,
                            fontSize: 12,
                            padding: "1px 7px",
                            borderRadius: 999,
                            background: ACCENT,
                            color: "#000"
                        }}>
                            {selected.length}
                        </span>
                    )}
                </span>
                {/* سهم كسهم الصندوق المجاور، ينقلب عند الفتح فيقول إن اللوحة مفتوحة. */}
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
                    style={{ transition: "transform 140ms", transform: open ? "rotate(180deg)" : "none", opacity: 0.6 }}>
                    <path fill="currentColor" d="M5.3 8.3a1 1 0 0 1 1.4 0l5.3 5.3 5.3-5.3a1 1 0 1 1 1.4 1.4l-6 6a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1 0-1.4Z" />
                </svg>
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
