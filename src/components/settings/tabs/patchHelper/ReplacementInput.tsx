/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { t } from "@utils/esharqI18n";
import { Margins } from "@utils/margins";
import { Parser, TextInput, useEffect, useState } from "@webpack/common";

const RegexGuide = {
    "\\i": t("\u062a\u0633\u0644\u0633\u0644 \u0647\u0631\u0648\u0628 \u062e\u0627\u0635 \u064a\u0637\u0627\u0628\u0642 \u0627\u0644\u0645\u0639\u0631\u0651\u0641\u0627\u062a (\u0623\u0633\u0645\u0627\u0621 \u0627\u0644\u0645\u062a\u063a\u064a\u0651\u0631\u0627\u062a \u0648\u0627\u0644\u0623\u0635\u0646\u0627\u0641 \u0648\u063a\u064a\u0631\u0647\u0627)", "Special regex escape sequence that matches identifiers (varnames, classnames, etc.)"),
    "$$": t("\u0625\u062f\u0631\u0627\u062c \u0639\u0644\u0627\u0645\u0629 $", "Insert a $"),
    "$&": t("\u0625\u062f\u0631\u0627\u062c \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629 \u0643\u0627\u0645\u0644\u0629", "Insert the entire match"),
    "$`\u200b": t("\u0625\u062f\u0631\u0627\u062c \u0627\u0644\u0646\u0635 \u0627\u0644\u0630\u064a \u064a\u0633\u0628\u0642 \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629", "Insert the substring before the match"),
    "$'": t("\u0625\u062f\u0631\u0627\u062c \u0627\u0644\u0646\u0635 \u0627\u0644\u0630\u064a \u064a\u0644\u064a \u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629", "Insert the substring after the match"),
    "$n": t("\u0625\u062f\u0631\u0627\u062c \u0645\u062c\u0645\u0648\u0639\u0629 \u0627\u0644\u0627\u0644\u062a\u0642\u0627\u0637 \u0631\u0642\u0645 n ($1\u060c $2...)", "Insert the nth capturing group ($1, $2...)"),
    "$self": t("\u0625\u062f\u0631\u0627\u062c \u0646\u0633\u062e\u0629 \u0627\u0644\u0625\u0636\u0627\u0641\u0629", "Insert the plugin instance"),
} as const;

export function ReplacementInput({ replacement, setReplacement, replacementError }) {
    const [isFunc, setIsFunc] = useState(false);
    const [error, setError] = useState<string>();

    function onChange(v: string) {
        setError(void 0);

        if (isFunc) {
            try {
                const func = (0, eval)(v);
                if (typeof func === "function")
                    setReplacement(() => func);

                else
                    setError(t("يجب أن يكون الاستبدال دالة", "Replacement must be a function"));
            } catch (e) {
                setReplacement(v);
                setError((e as Error).message);
            }
        } else {
            setReplacement(v);
        }
    }

    useEffect(() => {
        if (isFunc)
            onChange(replacement);
        else
            setError(void 0);
    }, [isFunc]);

    return (
        <>
            {/* FormTitle adds a class if className is not set, so we set it to an empty string to prevent that */}
            <Heading className="">{t("الاستبدال", "Replacement")}</Heading>
            <TextInput
                value={replacement?.toString()}
                onChange={onChange}
                error={error ?? replacementError}
            />
            {!isFunc && (
                <div>
                    <Heading className={Margins.top8}>{t("مرجع سريع", "Cheat Sheet")}</Heading>

                    {Object.entries(RegexGuide).map(([placeholder, desc]) => (
                        <Paragraph key={placeholder}>
                            {Parser.parse("`" + placeholder + "`")}: {desc}
                        </Paragraph>
                    ))}
                </div>
            )}

            <FormSwitch
                className={Margins.top16}
                value={isFunc}
                onChange={setIsFunc}
                title={t("معاملة الاستبدال كدالة", "Treat Replacement as function")}
                description={t("سيُقيَّم «الاستبدال» كدالة عند تفعيل هذا الخيار", "\"Replacement\" will be evaluated as a function if this is enabled")}
                hideBorder
            />
        </>
    );
}
