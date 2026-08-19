/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
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

import { CodeBlock } from "@components/CodeBlock";
import { Flex } from "@components/Flex";
import { Card } from "@components/settings/esharq/Card";
import { CopyButton } from "@components/settings/esharq/CopyButton";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import { Span } from "@components/Span";
import { debounce } from "@shared/debounce";
import { t } from "@utils/esharqI18n";
import { Margins } from "@utils/margins";
import { stripIndent } from "@utils/text";
import { ReplaceFn } from "@utils/types";
import { search } from "@webpack";
import { React, TextInput, useMemo, useState } from "@webpack/common";

import { FullPatchInput } from "./FullPatchInput";
import { PatchPreview } from "./PatchPreview";
import { ReplacementInput } from "./ReplacementInput";

const findCandidates = debounce(function ({ find, setModule, setError }) {
    const candidates = search(find);
    const keys = Object.keys(candidates);
    const len = keys.length;

    if (len === 0)
        setError(t("لا تطابق. ربما تلك الوحدة تُحمَّل عند الطلب؟", "No match. Perhaps that module is lazy loaded?"));
    else if (len !== 1)
        setError(t("تطابقات متعددة. رجاءً ضيّق نطاق البحث", "Multiple matches. Please refine your filter"));
    else
        setModule([keys[0], candidates[keys[0]]]);
});

function PatchHelper() {
    const [find, setFind] = useState("");
    const [match, setMatch] = useState("");
    const [replacement, setReplacement] = useState<string | ReplaceFn>("");

    const [parsedFind, setParsedFind] = useState<string | RegExp>("");

    const [findError, setFindError] = useState<string>();
    const [matchError, setMatchError] = useState<string>();
    const [replacementError, setReplacementError] = useState<string>();

    const [module, setModule] = useState<[number, Function]>();

    const code = useMemo(() => {
        const find = parsedFind instanceof RegExp ? parsedFind.toString() : JSON.stringify(parsedFind);
        const replace = typeof replacement === "function" ? replacement.toString() : JSON.stringify(replacement);

        return stripIndent`
            {
                find: ${find},
                replacement: {
                    match: /${match.replace(/(?<!\\)\//g, "\\/")}/,
                    replace: ${replace}
                }
            }
        `;
    }, [parsedFind, match, replacement]);

    function onFindChange(v: string) {
        setFind(v);

        try {
            let parsedFind = v as string | RegExp;
            if (/^\/.+?\/$/.test(v)) parsedFind = new RegExp(v.slice(1, -1));

            setFindError(void 0);
            setParsedFind(parsedFind);

            if (v.length) {
                findCandidates({ find: parsedFind, setModule, setError: setFindError });
            }
        } catch (e: any) {
            setFindError((e as Error).message);
        }
    }

    function onMatchChange(v: string) {
        setMatch(v);

        try {
            new RegExp(v);
            setMatchError(void 0);
        } catch (e: any) {
            setMatchError((e as Error).message);
        }
    }

    return (
        <SettingsTab>
            <Card
                index={0}
                title={t("مساعد الترقيع", "Patch helper")}
                subtitle={t(
                    "أداة للمطوّرين تساعدك على تجهيز الرقع لإضافات إشراق.",
                    "A developer tool to help you create patches for Esharq plugins."
                )}
                badge={module
                    ? t("وحدة مطابقة", "Module matched")
                    : t("لا وحدة بعد", "No module yet")}
                badgeTone={module ? "ok" : "warn"}
            />

            <Card
                index={1}
                title={t("الرقعة الكاملة", "Full patch")}
                subtitle={t("الصق رقعة JSON كاملة هنا لتُملأ الحقول تلقائياً", "Paste your full JSON patch here to fill out the fields")}
            >
                <FullPatchInput
                    setFind={onFindChange}
                    setParsedFind={setParsedFind}
                    setMatch={onMatchChange}
                    setReplacement={setReplacement}
                />
            </Card>

            <Card
                index={2}
                title={t("الحقول", "Fields")}
                subtitle={t(
                    "‏`find` يختار الوحدة، و`match` يعمل على مصدرها بعد الرقع السابقة.",
                    "`find` selects the module; `match` operates on its source after earlier patches."
                )}
            >
                <div>
                    <Span size="md" weight="medium" color="text-strong">{t("البحث", "Find")}</Span>
                    <TextInput
                        type="text"
                        value={find}
                        onChange={onFindChange}
                        error={findError}
                    />
                </div>
                <div className={Margins.top20}>
                    <Span size="md" weight="medium" color="text-strong">{t("المطابقة", "Match")}</Span>
                    <TextInput
                        type="text"
                        value={match}
                        onChange={onMatchChange}
                        error={matchError}
                    />
                </div>

                <div className={Margins.top20}>
                    <ReplacementInput
                        replacement={replacement}
                        setReplacement={setReplacement}
                        replacementError={replacementError}
                    />
                </div>
            </Card>

            {module && (
                <Card index={3} title={t("معاينة", "Preview")}>
                    <PatchPreview
                        module={module}
                        match={match}
                        replacement={replacement}
                        setReplacementError={setReplacementError}
                    />
                </Card>
            )}

            {!!(find && match && replacement) && (
                <Card index={4} title={t("الكود المُولَّد", "Generated code")}>
                    <CodeBlock lang="js" content={code} />
                    <Flex className={Margins.top8} gap="8px">
                        <CopyButton text={code} label={t("نسخ إلى الحافظة", "Copy to clipboard")} />
                        <CopyButton
                            text={() => "```ts\n" + code + "\n```"}
                            label={t("نسخ ككتلة كود", "Copy as codeblock")}
                        />
                    </Flex>
                </Card>
            )}
        </SettingsTab>
    );
}

export default !IS_STANDALONE ? wrapTab(PatchHelper, "PatchHelper") : null;
