/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Esharq contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * كاتب/قارئ asar أدنى — بلا تبعية.
 *
 * صيغة asar (مُتحقَّقة بقراءة أرشيف ديسكورد الحقيقي):
 *
 *   [UInt32LE 4]            حجم حقل الحجم
 *   [UInt32LE payloadLen]   طول حمولة الترويسة
 *   [UInt32LE strPayload]   طول النصّ + 4
 *   [UInt32LE jsonLen]      طول JSON
 *   [json ...]              ترويسة الفهرس
 *   [حشو إلى مضاعف 4]
 *   [محتوى الملفات متتالياً]
 *
 * نحتاج الكتابة لأن طريقة الحقن العاملة على ديسكورد الحديث هي استبدال
 * `app.asar` بأرشيف صغير — لا مجلد بجانبه (أُثبت حيّاً أن المجلد
 * يُتجاهَل).
 */

import { readFileSync, writeFileSync } from "node:fs";

/** يبني أرشيف asar من خريطة `اسم → محتوى`. */
export function packAsar(files) {
    const names = Object.keys(files);
    const buffers = names.map(name =>
        Buffer.isBuffer(files[name]) ? files[name] : Buffer.from(files[name], "utf8"));

    // الفهرس: كل ملف بإزاحته وحجمه داخل كتلة المحتوى.
    const index = { files: {} };
    let offset = 0;
    names.forEach((name, i) => {
        index.files[name] = { size: buffers[i].length, offset: String(offset) };
        offset += buffers[i].length;
    });

    const json = Buffer.from(JSON.stringify(index), "utf8");
    // الحشو إلى مضاعف 4 جزء من الصيغة — بدونه تفشل القراءة.
    const padding = (4 - (json.length % 4)) % 4;

    const header = Buffer.alloc(16);
    header.writeUInt32LE(4, 0);
    header.writeUInt32LE(json.length + padding + 8, 4);
    header.writeUInt32LE(json.length + padding + 4, 8);
    header.writeUInt32LE(json.length, 12);

    return Buffer.concat([
        header, json, Buffer.alloc(padding), ...buffers
    ]);
}

/** يقرأ فهرس أرشيف asar — للتحقّق بعد الكتابة. */
export function readAsarIndex(path) {
    const buffer = readFileSync(path);
    const jsonLength = buffer.readUInt32LE(12);
    return JSON.parse(buffer.subarray(16, 16 + jsonLength).toString("utf8"));
}

/** يستخرج ملفاً من أرشيف asar. */
export function readAsarFile(path, name) {
    const buffer = readFileSync(path);
    const jsonLength = buffer.readUInt32LE(12);
    const index = JSON.parse(buffer.subarray(16, 16 + jsonLength).toString("utf8"));
    const entry = index.files[name];
    if (entry === undefined) return undefined;

    const base = 16 + Math.ceil(jsonLength / 4) * 4;
    const start = base + Number(entry.offset);
    return buffer.subarray(start, start + entry.size);
}

export function writeAsar(path, files) {
    writeFileSync(path, packAsar(files));
}
