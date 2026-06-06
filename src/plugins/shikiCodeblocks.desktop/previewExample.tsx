/* eslint-disable simple-header/header */
import { t } from "@utils/esharqI18n";
import React from "react";

const handleClick = async () =>
    console.log((await import("@utils/clipboard")).copyToClipboard("\u200b"));

export const Example: React.FC<{
    real: boolean,
    shigged?: number,
}> = ({ real, shigged }) => <>
    <p>{`Shigg${real ? `ies${shigged === 0x1B ? "t" : ""}` : "y"}`}</p>
    <button onClick={handleClick}>{t("انقرني", "Click Me")}</button>
</>;
