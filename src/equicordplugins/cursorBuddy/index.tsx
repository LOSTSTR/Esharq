/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings, migratePluginSettings } from "@api/Settings";
import { Divider } from "@components/Divider";
import { Heading } from "@components/Heading";
import { Devs, EquicordDevs } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { t } from "@utils/esharqI18n";
import definePlugin, { OptionType } from "@utils/types";
import { Button, ColorPicker, React, useState } from "@webpack/common";

import customBuddy, { CUSTOM_BUDDY_ID } from "./custom";
import fathorse from "./fathorse";
import oneko from "./oneko";

const ONEKO_IMAGE = "https://raw.githubusercontent.com/adryd325/oneko.js/5281d057c4ea9bd4f6f997ee96ba30491aed16c0/oneko.gif";
const FATASS_HORSE_IMAGE = "https://raw.githubusercontent.com/nexpid/fatass-horse/08bc4042750d5f995c55327f7b6c6710158f5263/sheet.png";
const cl = classNameFactory("vc-cursor-buddy-");

function OnekoColorSettings() {
    const { furColor, outlineColor } = settings.use(["furColor", "outlineColor"]);

    const parseHexToNumber = (hex: string): number | null => {
        if (!hex || typeof hex !== "string") return null;
        const cleanHex = hex.replace(/^#/, "");
        if (cleanHex.length !== 6) return null;
        const num = parseInt(cleanHex, 16);
        return isNaN(num) ? null : num;
    };

    const formatNumberToHex = (num: number | null): string => {
        if (num === null) return "#FFFFFF";
        return "#" + num.toString(16).padStart(6, "0").toUpperCase();
    };

    const handleFurColorChange = (value: number | null) => {
        const hex = formatNumberToHex(value);
        settings.store.furColor = hex;
        load();
    };

    const handleOutlineColorChange = (value: number | null) => {
        const hex = formatNumberToHex(value);
        settings.store.outlineColor = hex;
        load();
    };

    return (
        <div>
            <div className={cl("color-modal")}>
                <div>
                    <Heading className="form-subtitle">{t("لون الفراء", "Fur Color")}</Heading>
                    <div className={cl("color")}>
                        <ColorPicker
                            color={parseHexToNumber(furColor) ?? 16777215}
                            onChange={handleFurColorChange}
                            showEyeDropper={true}
                        />
                    </div>
                </div>

                <div>
                    <Heading className="form-subtitle">{t("لون الحدود", "Outline Color")}</Heading>
                    <div className={cl("color")}>
                        <ColorPicker
                            color={parseHexToNumber(outlineColor) ?? 0}
                            onChange={handleOutlineColorChange}
                            showEyeDropper={true}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function CustomImageSettings() {
    const { customImage } = settings.use(["customImage"]);
    const [error, setError] = useState<string | null>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setError(t("يجب أن يكون الملف صورة", "The file must be an image"));
            return;
        }
        if (file.size > 3 * 1024 * 1024) {
            setError(t("حجم الصورة كبير جداً (الحدّ 3 ميغابايت)", "Image is too large (3 MB max)"));
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            settings.store.customImage = reader.result as string;
            setError(null);
            load();
        };
        reader.readAsDataURL(file);
    };

    const clearImage = () => {
        settings.store.customImage = "";
        setError(null);
        if (inputRef.current) inputRef.current.value = "";
        load();
    };

    return (
        <div className={cl("custom")}>
            <Heading className="form-subtitle">
                {t("الصورة المخصّصة (متحرّكة أو ثابتة)", "Custom image (animated or static)")}
            </Heading>
            <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} />
            {customImage ? (
                <div className={cl("custom-preview")}>
                    <img src={customImage} alt="" style={{ maxWidth: "96px", maxHeight: "96px", imageRendering: "auto" }} />
                    <Button color={Button.Colors.RED} size={Button.Sizes.SMALL} onClick={clearImage}>
                        {t("إزالة الصورة", "Remove image")}
                    </Button>
                </div>
            ) : null}
            {error ? <div style={{ color: "var(--text-danger)", marginTop: "8px" }}>{error}</div> : null}
        </div>
    );
}

const settings = definePluginSettings({
    buddy: {
        description: "Choose your cursor buddy character",
        type: OptionType.SELECT,
        options: [
            {
                label: "Oneko",
                value: "oneko",
                default: true
            },
            {
                label: t("حصان سمين", "Fatass Horse"),
                value: "fathorse"
            },
            {
                label: t("صورة مخصّصة", "Custom Image"),
                value: "custom"
            }
        ],
        onChange: load,
    },
    speed: {
        description: "Character speed",
        type: OptionType.NUMBER,
        default: 10,
        isValid: (value: number) => value >= 0 || "Speed must be bigger than 0",
        onChange: load,
    },
    fps: {
        description: "Character framerate",
        type: OptionType.NUMBER,
        default: 24,
        isValid: (value: number) => value > 0 || "Framerate must be bigger than 0",
        onChange: load
    },
    // Oneko Specific
    onekoSection: {
        type: OptionType.COMPONENT,
        component: () => (
            <div>
                <Heading style={{ fontSize: "1.6em", marginTop: "10px" }}>Oneko</Heading>
                <Divider style={{ marginBottom: "-10px" }}></Divider>
            </div>
        ),
    },
    onekoColorSettings: {
        type: OptionType.COMPONENT,
        component: OnekoColorSettings,
    },
    furColor: {
        description: "Oneko fur color in hex",
        type: OptionType.STRING,
        default: "#FFFFFF",
        onChange: load,
        hidden: true,
    },
    outlineColor: {
        description: "Oneko outline color in hex",
        type: OptionType.STRING,
        default: "#000000",
        onChange: load,
        hidden: true,
    },
    // Fatass Horse Specific
    fathorseSection: {
        type: OptionType.COMPONENT,
        component: () => (
            <div>
                <Heading style={{ fontSize: "1.6em", marginTop: "10px" }}>Fatass Horse</Heading>
                <Divider style={{ marginBottom: "-10px" }}></Divider>
            </div>
        ),
    },
    size: {
        description: "Horse size",
        type: OptionType.NUMBER,
        default: 120,
        isValid: (value: number) => value > 0 || "Size must be bigger than 0",
        onChange: load
    },
    fade: {
        description: "Fade the horse when cursor is nearby",
        type: OptionType.BOOLEAN,
        default: true,
        onChange: load
    },
    freeroam: {
        description: "Horse roams freely when idle",
        type: OptionType.BOOLEAN,
        default: true,
        onChange: load
    },
    shake: {
        description: "Shake the window while the horse walks",
        type: OptionType.BOOLEAN,
        default: false,
        onChange: load,
    },
    // Custom Image Specific
    customSection: {
        type: OptionType.COMPONENT,
        component: () => (
            <div>
                <Heading style={{ fontSize: "1.6em", marginTop: "10px" }}>{t("صورة مخصّصة", "Custom Image")}</Heading>
                <Divider style={{ marginBottom: "-10px" }}></Divider>
            </div>
        ),
    },
    customImageSettings: {
        type: OptionType.COMPONENT,
        component: CustomImageSettings,
    },
    customImage: {
        description: "Custom image data (base64 data URL or image URL)",
        type: OptionType.STRING,
        default: "",
        hidden: true,
    },
    customSize: {
        description: "Custom image size",
        type: OptionType.NUMBER,
        default: 64,
        isValid: (value: number) => value > 0 || "Size must be bigger than 0",
        onChange: load,
    },
    customFlip: {
        description: "Flip the image horizontally when moving left",
        type: OptionType.BOOLEAN,
        default: true,
        onChange: load,
    },
}, {
    // Oneko Specific
    furColor: {
        disabled() { return this.store.buddy !== "oneko"; }
    },
    outlineColor: {
        disabled() { return this.store.buddy !== "oneko"; }
    },
    // Fatass Horse Specific
    size: {
        disabled() { return this.store.buddy !== "fathorse"; },
    },
    fade: {
        disabled() { return this.store.buddy !== "fathorse"; },
    },
    freeroam: {
        disabled() { return this.store.buddy !== "fathorse"; },
    },
    shake: {
        disabled() { return this.store.buddy !== "fathorse"; },
    },
    // Custom Image Specific
    customSize: {
        disabled() { return this.store.buddy !== "custom"; },
    },
    customFlip: {
        disabled() { return this.store.buddy !== "custom"; },
    }
});

function unload() {
    document.getElementById("oneko")?.remove();
    document.getElementById("fathorse")?.remove();
    document.getElementById(CUSTOM_BUDDY_ID)?.remove();
}

function load() {
    if (!isPluginEnabled("CursorBuddy")) return;
    unload();

    switch (settings.store.buddy) {
        case "oneko": {
            oneko({
                speed: settings.store.speed,
                fps: settings.store.fps,
                image: ONEKO_IMAGE,
                persistPosition: false,
                furColor: settings.store.furColor,
                outlineColor: settings.store.outlineColor
            });
            break;
        }
        case "fathorse": {
            fathorse({
                speed: settings.store.speed,
                fps: settings.store.fps,
                size: settings.store.size,
                fade: settings.store.fade,
                freeroam: settings.store.freeroam,
                shake: settings.store.shake,
                image: FATASS_HORSE_IMAGE
            });
            break;
        }
        case "custom": {
            customBuddy({
                image: settings.store.customImage,
                size: settings.store.customSize,
                speed: settings.store.speed,
                flip: settings.store.customFlip,
            });
            break;
        }
    }
}

migratePluginSettings("CursorBuddy", "Oneko", "oneko");
export default definePlugin({
    name: "CursorBuddy",
    description: "Adds an animated character that follows your cursor",
    tags: ["Appearance", "Customisation", "Fun"],
    authors: [Devs.Ven, Devs.adryd, EquicordDevs.nexpid, EquicordDevs.ZcraftElite],
    searchTerms: ["Oneko", "FatassHorse", "Pet", "Custom", "Image"],
    settings,
    isModified: true,

    start: load,
    stop: unload,
});
