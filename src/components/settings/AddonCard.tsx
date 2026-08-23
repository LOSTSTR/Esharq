/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import "./AddonCard.css";
import "./esharq/cardState.css";

import { Badge } from "@components/Badge";
import { BaseText } from "@components/BaseText";
import { categoryColor } from "@components/settings/esharq/CategoryFilter";
import { Switch } from "@components/Switch";
import { classNameFactory } from "@utils/css";
import { Tooltip, useRef } from "@webpack/common";
import type { MouseEventHandler, ReactNode } from "react";

const cl = classNameFactory("vc-addon-");

interface Props {
    name: ReactNode;
    description: ReactNode;
    enabled: boolean;
    setEnabled: (enabled: boolean) => void;
    disabled?: boolean;
    isNew?: boolean;
    sourceBadge?: ReactNode;
    tooltip?: string;
    /**
     * تلميحٌ على **المفتاح نفسه**.
     *
     * 🔴 `tooltip` أعلاه مربوطٌ بشارة المصدر (صورة ٢٢ بكسل)، لا بالمفتاح.
     * فمن يرى مفتاحاً رمادياً ويمرّ عليه لا يُفسَّر له شيء — والمفتاح
     * `disabled` فلا يُطلق أحداث تحويم أصلاً. ولو وُضع الشرح في `tooltip`
     * لمحا اسم المصدر («إضافة إشراق») بدل أن يُضيف إليه. لذلك غلافٌ حول
     * المفتاح: هو الذي يحمل التحويم، والمفتاح المُعطَّل بداخله.
     */
    toggleTooltip?: string;
    onMouseEnter?: MouseEventHandler<HTMLDivElement>;
    onMouseLeave?: MouseEventHandler<HTMLDivElement>;

    /** فئات الإضافة — تُعرض شارات على البطاقة نفسها. */
    tags?: readonly string[];

    infoButton?: ReactNode;
    footer?: ReactNode;
    author?: ReactNode;
}

export function AddonCard({ disabled, isNew, sourceBadge, tooltip, toggleTooltip, name, tags, infoButton, footer, author, enabled, setEnabled, description, onMouseEnter, onMouseLeave }: Props) {
    const titleRef = useRef<HTMLDivElement>(null);
    const titleContainerRef = useRef<HTMLDivElement>(null);

    return (
        <div
            // حالة الإضافة تُعرَض لوناً أيضاً لا مفتاحاً وحده — انظر cardState.css.
            className={cl("card", {
                "card-disabled": disabled,
                "card-locked": disabled,
                "card-on": !disabled && enabled,
                "card-off": !disabled && !enabled
            })}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className={cl("header")}>
                <div className={cl("name-author")}>
                    <BaseText size="md" weight="bold" className={cl("name")}>
                        <div ref={titleContainerRef} className={cl("title-container")}>
                            <div
                                ref={titleRef}
                                className={cl("title")}
                                onMouseOver={() => {
                                    const title = titleRef.current!;
                                    const titleContainer = titleContainerRef.current!;

                                    title.style.setProperty("--offset", `${titleContainer.clientWidth - title.scrollWidth}px`);
                                    title.style.setProperty("--duration", `${Math.max(0.5, (title.scrollWidth - titleContainer.clientWidth) / 7)}s`);
                                }}
                            >
                                {name}
                            </div>
                        </div>
                        {isNew && <Badge text="NEW" variant="danger" />}
                    </BaseText>

                    {!!author && (
                        <BaseText size="md" color="text-subtle" className={cl("author")}>
                            {author}
                        </BaseText>
                    )}
                </div>

                <Tooltip text={tooltip}>
                    {({ onMouseEnter, onMouseLeave }) => (
                        <div
                            className={cl("source")}
                            onMouseEnter={onMouseEnter}
                            onMouseLeave={onMouseLeave}
                        >
                            {sourceBadge}
                        </div>
                    )}
                </Tooltip>

                {infoButton}

                {toggleTooltip ? (
                    <Tooltip text={toggleTooltip}>
                        {({ onMouseEnter, onMouseLeave }) => (
                            <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
                                <Switch
                                    checked={enabled}
                                    onChange={setEnabled}
                                    disabled={disabled}
                                />
                            </div>
                        )}
                    </Tooltip>
                ) : (
                    <Switch
                        checked={enabled}
                        onChange={setEnabled}
                        disabled={disabled}
                    />
                )}
            </div>

            {/* 🔴 الفئات على البطاقة لا في المرشِّح وحده: يعرف القارئ نوع
                الإضافة قبل أن يقرأ وصفها، ويجد شبيهاتها بنظرة. */}
            {tags !== undefined && (
                <div className={cl("tags")}>
                    {tags.map(tag => (
                        <span key={tag} className={cl("tag")} style={{ ["--esharq-tag" as any]: categoryColor(tag) }}>
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            <div
                className={cl("note")}
                style={{ lineHeight: "1.25em", fontSize: "small" }}
                title={description ? description.toString() : ""}
            >
                {description}
            </div>

            {footer && <div className={cl("footer")}>{footer}</div>}
        </div>
    );
}
