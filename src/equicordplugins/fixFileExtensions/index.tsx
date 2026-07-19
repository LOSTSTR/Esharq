/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import anonymiseFileNames, { tarExtMatcher } from "@plugins/anonymiseFileNames";
import { Devs } from "@utils/constants";
import definePlugin, { ReporterTestable } from "@utils/types";
import { CloudUpload } from "@vencord/discord-types";

const extensionMap = {
    "ogg": [".ogv", ".oga", ".ogx", ".ogm", ".spx", ".aac", ".wma"],
    "jpg": [".jpe", ".jif", ".jfi", ".pjpeg", ".pjp", ".bmp", ".tiff", ".tif"],
    "svg": [".svgz", ".ai", ".eps"],
    "mp4": [".m4v", ".m4r", ".m4p", ".avi", ".mkv", ".wmv", ".flv", ".3gp"],
    "m4a": [".m4b", ".aiff"],
    "mov": [".movie", ".qt", ".asf", ".rm", ".rmvb"],
    "png": [".ico", ".cur"],
};

export const reverseExtensionMap = Object.entries(extensionMap).reduce((acc, [target, exts]) => {
    exts.forEach(ext => acc[ext] = `.${target}`);
    return acc;
}, {} as Record<string, string>);

export default definePlugin({
    name: "FixFileExtensions",
    authors: [Devs.thororen],
    description: "Fixes file extensions by renaming them to a supported format when possible",
    tags: ["Media", "Utility"],
    // Patches must be reported on: this was the only plugin in the tree whose patch the
    // reporter never checked, so a break here would have gone unnoticed. start() stays out
    // of scope because it is not what None was guarding against here.
    reporterTestable: ReporterTestable.Patches,
    patches: [
        // Taken from AnonymiseFileNames
        {
            find: "async uploadFiles(",
            replacement: [
                {
                    match: /async uploadFiles\((\i)\){/,
                    replace: "$&$1.forEach($self.fixExt);"
                }
            ],
            predicate: () => !isPluginEnabled(anonymiseFileNames.name),
        },
    ],
    fixExt(upload: CloudUpload) {
        const file = upload.filename;
        const tarMatch = tarExtMatcher.exec(file);
        const extIdx = tarMatch?.index ?? file.lastIndexOf(".");
        const fileName = extIdx !== -1 ? file.substring(0, extIdx) : "";
        const ext = extIdx !== -1 ? file.slice(extIdx) : "";
        const newExt = reverseExtensionMap[ext] || ext;

        upload.filename = fileName + newExt;
    },
});
