/*
 * MicPro — Esharq Voice Lab
 * Copyright (c) 2026 LOSTSTR
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * **مُرقِّع الملفّ** — ما يفعله `patcher.node` في الذاكرة، مطبَّقاً على نسخةٍ من
 * `discord_voice.node` على القرص، بلا تشغيل أيّ شيفرةٍ أصليّة.
 *
 * هذا نقلٌ حرفيّ لـ`ApplyPatches` في patcher.cpp@62de190 (الإصدار المثبَّت في
 * native.ts): يُبنى تخطيط الصورة المحمَّلة (كلّ قسمٍ عند عنوانه الافتراضيّ)، ثمّ
 * المسح بأوّل تطابق، ثمّ النمط البديل، ثمّ ثلاث جولات اشتقاق — فتقع الرقع على
 * المواضع نفسها التي يختارها المُرقِّع في الذاكرة، بالبايتات نفسها.
 *
 * ## لماذا لا نكتب ما يكتبه المُرقِّع وكفى
 *
 * 🔴 **إعادة التموضع**: المُرقِّع يكتب في صورةٍ طبّق عليها المُحمِّل إعادة التموضع؛
 * أمّا الملفّ فيُحمَّل لاحقاً وتُطبَّق عليه. رقعةٌ تقع فوق مدخلٍ في `.reloc` كان
 * المُحمِّل سيُعيد كتابة بايتاتها فيُفسد الشيفرة. فكلّ رقعة تُفحص مقابل جدول
 * إعادة التموضع، وتُرفض النتيجة كلّها إن تقاطعت واحدة (قِيس ٢٠٢٦-٠٩-١٩: صفر
 * تقاطع من ~٢١٦٠٠ مدخل على المستقرّ 9258 وكناري 1185).
 *
 * 🔴 **ملفٌّ مُرقَّع سلفاً ليس أصلاً**: المسح على ملفٍّ مُرقَّع يحلّ ٧ من ١٧ فقط،
 * وثلاثٌ منها على مواضع **أخرى**. فلا يُقبل مصدرٌ إلّا إن وجد كلّ رقعة صوتٍ
 * بايتاتها الأصليّة في مكانها (الحالة `ok` لا `already_patched`).
 */

/** رقعتا الفيديو في المُرقِّع — لا شأن للستيريو بهما، فغيابهما لا يمنع الترقيع. */
export const VIDEO_PATCHES: ReadonlySet<string> = new Set(["DropFrameBypass", "PacerDrainRate"]);

interface Pattern { bytes: number[]; mask: boolean[]; offset: number; }

interface Entry {
    name: string;
    primary: Pattern;
    alt: Pattern;
    deriveFrom: string;
    deriveOffset: number;
    altDeriveOffset: number | null;
    expected: number[];
    patch: number[];
    altExpected: number[];
    altPatch: number[];
    rva: number;
    tier: "" | "primary" | "alt" | "derived" | "derived-alt";
}

export interface FilePatchResult {
    name: string;
    status: string;
    tier: string;
    rva: number;
    fileOffset: number;
    length: number;
    section: string;
}

export interface FilePatchOutcome {
    /** النسخة المُرقَّعة — لا تُعاد إلّا إن كانت صالحة للكتابة كلّها. */
    patched: Buffer | null;
    patches: FilePatchResult[];
    audio: { ok: number; total: number; missing: string[]; };
    /** سبب الرفض بالإنجليزيّة (يُترجَم في الواجهة)، أو null. */
    refusal: string | null;
    bytesChanged: number;
}

// ── دلالات C++ حرفاً بحرف ──────────────────────────────────────────────────────

const trim = (s: string) => s.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");

/** `std::stoll(s, nullptr, 0)`: إشارة، ثمّ 0x ستّ‌عشريّ أو صفرٌ بادئ ثمانيّ أو عشريّ؛ يقرأ البادئة ويترك الباقي. */
function stoll0(s: string): number | null {
    const m = /^[ \t]*([+-]?)(0[xX][0-9a-fA-F]+|0[0-7]*|[1-9][0-9]*)/.exec(s);
    if (m == null) return null;
    const body = m[2];
    const value = /^0[xX]/.test(body) ? parseInt(body.slice(2), 16)
        : body.length > 1 && body[0] === "0" ? parseInt(body, 8)
            : parseInt(body, 10);
    return m[1] === "-" ? -value : value;
}

/** `(uint8_t)std::stoul(tok, nullptr, 16)` — ورمزٌ بلا أرقام يرمي في C++ فيُتخطّى. */
function byteToken(tok: string): number | null {
    const m = /^[ \t]*([+-]?)(?:0[xX])?([0-9a-fA-F]+)/.exec(tok);
    if (m == null) return null;
    let v = parseInt(m[2], 16);
    if (m[1] === "-") v = (-v) >>> 0;
    return v & 0xff;
}

const tokens = (s: string) => s.split(/[ \t\r\n\v\f]+/).filter(Boolean);

function parsePattern(s: string, into: Pattern) {
    for (const tok of tokens(s)) {
        if (tok === "??") { into.bytes.push(0); into.mask.push(false); continue; }
        const v = byteToken(tok);
        if (v != null) { into.bytes.push(v); into.mask.push(true); }
    }
}

function parseHexBytes(s: string): number[] {
    const out: number[] = [];
    for (const tok of tokens(s)) {
        if (tok === "??") continue;
        const v = byteToken(tok);
        if (v != null) out.push(v);
    }
    return out;
}

function parseIni(text: string): Entry[] {
    const entries: Entry[] = [];
    let section = "";
    let kv: Record<string, string> = {};

    const flush = () => {
        if (!section) return;
        const e: Entry = {
            name: section,
            primary: { bytes: [], mask: [], offset: 0 },
            alt: { bytes: [], mask: [], offset: 0 },
            deriveFrom: "", deriveOffset: 0, altDeriveOffset: null,
            expected: [], patch: [], altExpected: [], altPatch: [],
            rva: 0, tier: ""
        };
        const has = (k: string) => kv[k] != null && kv[k] !== "";
        const num = (k: string) => has(k) ? stoll0(kv[k]) : null;

        if (has("pattern")) parsePattern(kv.pattern, e.primary);
        e.primary.offset = num("sig_offset") ?? e.primary.offset;
        if (has("alt_pattern")) parsePattern(kv.alt_pattern, e.alt);
        e.alt.offset = num("alt_offset") ?? e.alt.offset;
        if (has("derive_from")) e.deriveFrom = kv.derive_from;
        e.deriveOffset = num("derive_offset") ?? e.deriveOffset;
        e.altDeriveOffset = num("alt_derive_offset");
        if (has("expected")) e.expected = parseHexBytes(kv.expected);
        if (has("patch")) e.patch = parseHexBytes(kv.patch);
        if (has("alt_expected")) e.altExpected = parseHexBytes(kv.alt_expected);
        if (has("alt_patch")) e.altPatch = parseHexBytes(kv.alt_patch);

        const locatable = e.primary.bytes.length > 0 || e.alt.bytes.length > 0 || e.deriveFrom !== "";
        if (locatable && (e.patch.length > 0 || e.altPatch.length > 0)) entries.push(e);
        section = "";
        kv = {};
    };

    for (const raw of text.split("\n")) {
        const line = trim(raw);
        if (!line || line[0] === ";" || line[0] === "#") continue;
        if (line[0] === "[") {
            flush();
            const close = line.indexOf("]");
            if (close >= 0) section = trim(line.slice(1, close));
            continue;
        }
        const eq = line.indexOf("=");
        if (eq < 0) continue;
        let value = line.slice(eq + 1);
        const comment = value.indexOf(";");
        if (comment >= 0) value = value.slice(0, comment);
        kv[trim(line.slice(0, eq)).toLowerCase()] = trim(value);
    }
    flush();
    return entries;
}

// ── صورة PE ─────────────────────────────────────────────────────────────────

interface Section { name: string; va: number; vsize: number; rawSize: number; rawPtr: number; characteristics: number; }

const IMAGE_SCN_MEM_EXECUTE = 0x20000000;

function loadImage(file: Buffer) {
    if (file.length < 0x40 || file.readUInt16LE(0) !== 0x5a4d) throw new Error("discord_voice.node is not a PE file");
    const pe = file.readUInt32LE(0x3c);
    if (file.readUInt32LE(pe) !== 0x4550) throw new Error("discord_voice.node has no PE signature");
    const sectionCount = file.readUInt16LE(pe + 6);
    const optionalSize = file.readUInt16LE(pe + 20);
    const opt = pe + 24;
    if (file.readUInt16LE(opt) !== 0x20b) throw new Error("discord_voice.node is not a 64-bit module");

    const sizeOfImage = file.readUInt32LE(opt + 56);
    const sizeOfHeaders = file.readUInt32LE(opt + 60);
    const sections: Section[] = [];
    for (let i = 0; i < sectionCount; i++) {
        const s = opt + optionalSize + i * 40;
        sections.push({
            name: file.toString("latin1", s, s + 8).replace(/\0+$/, ""),
            vsize: file.readUInt32LE(s + 8),
            va: file.readUInt32LE(s + 12),
            rawSize: file.readUInt32LE(s + 16),
            rawPtr: file.readUInt32LE(s + 20),
            characteristics: file.readUInt32LE(s + 36)
        });
    }

    const image = Buffer.alloc(sizeOfImage);
    file.copy(image, 0, 0, Math.min(sizeOfHeaders, file.length));
    for (const s of sections) {
        if (s.va >= sizeOfImage) continue;
        file.copy(image, s.va, s.rawPtr, Math.min(s.rawPtr + s.rawSize, s.rawPtr + (sizeOfImage - s.va), file.length));
    }

    // مداخل إعادة التموضع: [rva, طول]
    const relocations: [number, number][] = [];
    const dirRva = file.readUInt32LE(opt + 112 + 5 * 8);
    const dirSize = file.readUInt32LE(opt + 112 + 5 * 8 + 4);
    for (let p = dirRva; dirSize > 0 && p + 8 <= dirRva + dirSize && p + 8 <= image.length;) {
        const page = image.readUInt32LE(p);
        const size = image.readUInt32LE(p + 4);
        if (size < 8) break;
        for (let q = p + 8; q + 2 <= p + size; q += 2) {
            const entry = image.readUInt16LE(q);
            const type = entry >> 12;
            if (type === 0) continue; // IMAGE_REL_BASED_ABSOLUTE: حشو
            relocations.push([page + (entry & 0xfff), type === 10 ? 8 : type === 3 ? 4 : 2]);
        }
        p += size;
    }

    const sectionOf = (rva: number) => sections.find(s => rva >= s.va && rva < s.va + Math.max(s.vsize, s.rawSize));
    /** موضع البايت في الملفّ، أو null إن لم يكن له بايتٌ في الملفّ (منطقةٌ تُصفَّر عند التحميل). */
    const fileOffset = (rva: number) => {
        const s = sectionOf(rva);
        return s != null && rva - s.va < s.rawSize ? s.rawPtr + (rva - s.va) : null;
    };
    const overlapsRelocation = (rva: number, length: number) => relocations.some(([r, l]) => r < rva + length && rva < r + l);

    return { image, sectionOf, fileOffset, overlapsRelocation };
}

// ── الخوارزمية نفسها ────────────────────────────────────────────────────────

/**
 * يُطبّق أنماط `iniText` على `original` في الذاكرة ويُعيد النسخة المُرقَّعة. لا يكتب شيئاً
 * على القرص — الكتابة لمن استدعاه بعد أن يقرأ `refusal`.
 */
export function patchVoiceModuleFile(original: Buffer, iniText: string): FilePatchOutcome {
    const { image, sectionOf, fileOffset, overlapsRelocation } = loadImage(original);
    const entries = parseIni(iniText);

    const sigScan = (p: Pattern): number => {
        if (p.bytes.length === 0 || p.bytes.length !== p.mask.length) return 0;
        const len = p.bytes.length;
        const first = p.mask.indexOf(true);
        if (first < 0) return 0;
        const needle = p.bytes[first];
        for (let i = 0; i + len <= image.length; i++) {
            if (image[i + first] !== needle) continue;
            let match = true;
            for (let j = 0; j < len; j++) {
                if (p.mask[j] && image[i + j] !== p.bytes[j]) { match = false; break; }
            }
            if (match) {
                const site = i + p.offset;
                if (site >= 0 && site < image.length) return site;
            }
        }
        return 0;
    };
    const bytesEqual = (rva: number, bytes: number[]) => bytes.every((b, k) => image[rva + k] === b);
    const verifyAt = (rva: number, bytes: number[]) =>
        bytes.length === 0 || (rva < image.length && bytes.length <= image.length - rva && bytesEqual(rva, bytes));
    const isAlt = (tier: string) => tier === "alt" || tier === "derived-alt";
    const expectedFor = (e: Entry, tier: string) => isAlt(tier) && e.altExpected.length ? e.altExpected : e.expected;
    const patchFor = (e: Entry, tier: string) => isAlt(tier) && e.altPatch.length ? e.altPatch : e.patch;

    // المرحلة ١: المسح
    for (const e of entries) {
        if (e.primary.bytes.length) { e.rva = sigScan(e.primary); if (e.rva) { e.tier = "primary"; continue; } }
        if (e.alt.bytes.length) { e.rva = sigScan(e.alt); if (e.rva) { e.tier = "alt"; continue; } }
    }
    // المرحلة ٢: الاشتقاق — ثلاث جولات للسلاسل
    const byName = new Map(entries.map(e => [e.name, e]));
    for (let pass = 0; pass < 3; pass++) {
        for (const e of entries) {
            if (!e.deriveFrom || e.rva) continue;
            const anchor = byName.get(e.deriveFrom)?.rva ?? 0;
            if (!anchor) continue;
            const rva = anchor + e.deriveOffset;
            if (rva > 0 && rva < image.length && verifyAt(rva, expectedFor(e, "derived"))) { e.rva = rva; e.tier = "derived"; continue; }
            if (e.altDeriveOffset != null) {
                const alt = anchor + e.altDeriveOffset;
                if (alt > 0 && alt < image.length && verifyAt(alt, expectedFor(e, "derived-alt"))) { e.rva = alt; e.tier = "derived-alt"; }
            }
        }
    }

    // المرحلة ٣: الحكم على كلّ رقعة، ثمّ الكتابة في نسخة
    const out = Buffer.from(original);
    const patches: FilePatchResult[] = [];
    const hazards: string[] = [];
    let bytesChanged = 0;
    for (const e of entries) {
        const expected = expectedFor(e, e.tier);
        const patch = patchFor(e, e.tier);
        let status: string;
        if (!e.rva) status = "not_resolved";
        else if (patch.length === 0) status = "no_patch_bytes";
        else if (patch.length > image.length - e.rva) status = "patch_out_of_bounds";
        else if (bytesEqual(e.rva, patch)) status = "already_patched";
        else if (expected.length && !bytesEqual(e.rva, expected)) status = "expected_mismatch";
        else status = "ok";

        const section = e.rva ? sectionOf(e.rva) : undefined;
        const at = e.rva ? fileOffset(e.rva) : null;
        if (status === "ok") {
            const contiguous = at != null && fileOffset(e.rva + patch.length - 1) === at + patch.length - 1;
            if (!contiguous) hazards.push(`${e.name}: not backed by file bytes`);
            else if (section == null || !(section.characteristics & IMAGE_SCN_MEM_EXECUTE)) hazards.push(`${e.name}: outside executable code`);
            else if (overlapsRelocation(e.rva, patch.length)) hazards.push(`${e.name}: overlaps a base relocation`);
            else {
                for (let k = 0; k < patch.length; k++) {
                    if (out[at + k] !== patch[k]) bytesChanged++;
                    out[at + k] = patch[k];
                }
            }
        }
        patches.push({ name: e.name, status, tier: e.tier, rva: e.rva, fileOffset: at ?? -1, length: patch.length, section: section?.name ?? "" });
    }

    const audio = patches.filter(p => !VIDEO_PATCHES.has(p.name));
    const audioOk = audio.filter(p => p.status === "ok");
    // الفيديو: يُقبل غيابه (not_resolved)، ولا يُقبل أن يكون مُرقَّعاً سلفاً أو مختلف البايتات.
    const videoBad = patches.filter(p => VIDEO_PATCHES.has(p.name) && p.status !== "ok" && p.status !== "not_resolved");

    let refusal: string | null = null;
    if (audio.length === 0) refusal = "The pinned patterns contain no audio patches";
    else if (audio.some(p => p.status === "already_patched") || videoBad.some(p => p.status === "already_patched"))
        refusal = "This voice module is already patched (some sites already hold the patched bytes) — it is not an original to patch from";
    else if (audioOk.length !== audio.length || videoBad.length)
        refusal = `The stereo patterns do not match this voice module (${audioOk.length}/${audio.length} audio patches)`;
    else if (hazards.length) refusal = `Unsafe to patch on disk: ${hazards.join("; ")}`;

    return {
        patched: refusal == null ? out : null,
        patches,
        audio: { ok: audioOk.length, total: audio.length, missing: audio.filter(p => p.status !== "ok").map(p => p.name) },
        refusal,
        bytesChanged
    };
}
