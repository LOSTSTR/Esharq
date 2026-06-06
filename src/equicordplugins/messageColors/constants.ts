/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { t } from "@utils/esharqI18n";
import { OptionType } from "@utils/types";

export const enum RenderType {
    BLOCK,
    FOREGROUND,
    BACKGROUND,
}

export const enum BlockDisplayType {
    LEFT,
    RIGHT,
    BOTH
}

export const settings = definePluginSettings({
    renderType: {
        type: OptionType.SELECT,
        description: t("طريقة عرض الألوان", "Color display method"),
        options: [
            {
                label: t("لون النصّ", "Text color"),
                value: RenderType.FOREGROUND,
                default: true,
            },
            {
                label: t("حظر القريب", "Block nearby"),
                value: RenderType.BLOCK,
            },
            {
                label: t("لون الخلفية", "Background color"),
                value: RenderType.BACKGROUND
            },
        ]
    },
    enableShortHexCodes: {
        type: OptionType.BOOLEAN,
        description: t("تفعيل أكواد hex المكونة من 3 أحرف مثل #39f", "Enable 3-character hex codes like #39f"),
        default: true,
        // Regex are created on the start, so without restart nothing would change
        restartNeeded: true
    },
    blockView: {
        type: OptionType.SELECT,
        disabled: () => settings.store.renderType !== RenderType.BLOCK,
        description: t("مكان عرض الكتلة الملونة", "Where to display the color block"),
        options: [
            {
                label: t("الجانب الأيمن", "Right side"),
                value: BlockDisplayType.RIGHT,
                default: true
            },
            {
                label: t("الجانب الأيسر", "Left side"),
                value: BlockDisplayType.LEFT
            },
            {
                label: t("كلا الجانبين", "Both sides"),
                value: BlockDisplayType.BOTH
            }
        ]
    }
});

export const enum ColorType {
    RGB,
    RGBA,
    HEX,
    HSL
}

// It's sooo hard to read regex without this, it makes it at least somewhat bearable
export const replaceRegexp = (reg: string) => {
    const n = new RegExp(reg
        // \c - 'comma'
        // \v - 'value'
        // \f - 'float'
        .replaceAll("\\f", "[+-]?([0-9]*[.])?[0-9]+")
        .replaceAll("\\c", "(?:,|\\s)")
        .replaceAll("\\v", "\\s*?\\d+?\\s*?"), "g");

    return n;
};

export const regex = [
    { reg: /rgb\(\v\c\v\c\v\)/g, type: ColorType.RGB },
    { reg: /rgba\(\v\c\v\c\v(\c|\/?)\s*\f\)/g, type: ColorType.RGBA },
    { reg: /hsl\(\v°?\c\s*?\d+%?\s*?\c\s*?\d+%?\s*?\)/g, type: ColorType.HSL },
].map(v => { v.reg = replaceRegexp(v.reg.source); return v; });
