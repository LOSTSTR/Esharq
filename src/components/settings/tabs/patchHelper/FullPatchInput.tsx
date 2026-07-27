/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Paragraph } from "@components/Paragraph";
import { t } from "@utils/esharqI18n";
import { Patch, ReplaceFn } from "@utils/types";
import { TextArea, useEffect, useRef, useState } from "@webpack/common";

export interface FullPatchInputProps {
    setFind(v: string): void;
    setParsedFind(v: string | RegExp): void;
    setMatch(v: string): void;
    setReplacement(v: string | ReplaceFn): void;
}

export function FullPatchInput({ setFind, setParsedFind, setMatch, setReplacement }: FullPatchInputProps) {
    const [patch, setPatch] = useState<string>("");
    const [error, setError] = useState<string>("");

    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    function update() {
        if (patch === "") {
            setError("");

            setFind("");
            setParsedFind("");
            setMatch("");
            setReplacement("");
            return;
        }

        try {
            let { find, replacement } = (0, eval)(`([${patch}][0])`) as Patch;

            if (!find) throw new Error(t("لا يوجد حقل 'find'", "No 'find' field"));
            if (!replacement) throw new Error(t("لا يوجد حقل 'replacement'", "No 'replacement' field"));

            if (replacement instanceof Array) {
                if (replacement.length === 0) throw new Error(t("استبدال غير صالح", "Invalid replacement"));

                // Only test the first replacement
                replacement = replacement[0];
            }

            if (!replacement.match) throw new Error(t("لا يوجد حقل 'replacement.match'", "No 'replacement.match' field"));
            if (replacement.replace == null) throw new Error(t("لا يوجد حقل 'replacement.replace'", "No 'replacement.replace' field"));

            setFind(find instanceof RegExp ? `/${find.source}/` : find);
            setParsedFind(find);
            setMatch(replacement.match instanceof RegExp ? replacement.match.source : replacement.match);
            setReplacement(replacement.replace);
            setError("");
        } catch (e) {
            setError((e as Error).message);
        }
    }

    useEffect(() => {
        const { current: textArea } = textAreaRef;
        if (textArea) {
            textArea.style.height = "auto";
            textArea.style.height = `${textArea.scrollHeight}px`;
        }
    }, [patch]);

    return (
        <>
            <TextArea
                inputRef={textAreaRef}
                value={patch}
                onChange={setPatch}
                onBlur={update}
            />
            {error !== "" && <Paragraph style={{ color: "var(--text-feedback-critical)" }}>{error}</Paragraph>}
        </>
    );
}
