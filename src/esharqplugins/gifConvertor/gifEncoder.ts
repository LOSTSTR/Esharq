/*
 * GIF89a single-frame encoder
 * Octree colour quantisation + GIF-spec LZW compression
 */

// ─── Types ───────────────────────────────────────────────────────────────────

interface Color { r: number; g: number; b: number; }

// ─── Octree quantiser ────────────────────────────────────────────────────────

class OctreeNode {
    children: Array<OctreeNode | null> = new Array(8).fill(null);
    pixelCount = 0;
    rSum = 0; gSum = 0; bSum = 0;
    paletteIndex = -1;
    isLeaf = false;
    constructor(public level: number) { this.isLeaf = level >= 8; }
}

class OctreeQuantizer {
    private root = new OctreeNode(0);
    private reducible: OctreeNode[][] = Array.from({ length: 8 }, () => []);
    private leaves = new Set<OctreeNode>();

    constructor(private maxColors: number) {}

    addColor(r: number, g: number, b: number) {
        this.insert(this.root, r, g, b, 0);
        while (this.leaves.size > this.maxColors) this.reduce();
    }

    private insert(node: OctreeNode, r: number, g: number, b: number, level: number) {
        if (node.isLeaf) {
            if (node.pixelCount === 0) this.leaves.add(node);
            node.pixelCount++; node.rSum += r; node.gSum += g; node.bSum += b;
            return;
        }
        const shift = 7 - level;
        const idx = ((r >> shift & 1) << 2) | ((g >> shift & 1) << 1) | (b >> shift & 1);
        if (!node.children[idx]) {
            const child = new OctreeNode(level + 1);
            node.children[idx] = child;
            if (!child.isLeaf) this.reducible[level].push(child);
        }
        this.insert(node.children[idx]!, r, g, b, level + 1);
    }

    private reduce() {
        let lvl = 7;
        while (lvl > 0 && !this.reducible[lvl].length) lvl--;
        const node = this.reducible[lvl].pop();
        if (!node) return;
        for (const child of node.children) {
            if (!child) continue;
            node.rSum += child.rSum; node.gSum += child.gSum; node.bSum += child.bSum;
            node.pixelCount += child.pixelCount;
            if (this.leaves.has(child)) this.leaves.delete(child);
        }
        node.children.fill(null);
        node.isLeaf = true;
        this.leaves.add(node);
    }

    buildPalette(): Color[] {
        const palette: Color[] = [];
        this.collectLeaves(this.root, palette);
        while (palette.length < 256) palette.push({ r: 0, g: 0, b: 0 });
        return palette;
    }

    private collectLeaves(node: OctreeNode, pal: Color[]) {
        if (node.isLeaf) {
            if (pal.length >= 256) return;
            node.paletteIndex = pal.length;
            pal.push({
                r: node.pixelCount ? Math.round(node.rSum / node.pixelCount) : 0,
                g: node.pixelCount ? Math.round(node.gSum / node.pixelCount) : 0,
                b: node.pixelCount ? Math.round(node.bSum / node.pixelCount) : 0,
            });
            return;
        }
        for (const c of node.children) if (c) this.collectLeaves(c, pal);
    }

    getIndex(r: number, g: number, b: number): number {
        return this.walk(this.root, r, g, b, 0);
    }

    private walk(node: OctreeNode, r: number, g: number, b: number, level: number): number {
        if (node.isLeaf) return Math.max(0, node.paletteIndex);
        const shift = 7 - level;
        const idx = ((r >> shift & 1) << 2) | ((g >> shift & 1) << 1) | (b >> shift & 1);
        const child = node.children[idx] ?? node.children.find(Boolean);
        return child ? this.walk(child, r, g, b, level + 1) : 0;
    }
}

// ─── Quantisation helper ─────────────────────────────────────────────────────

function quantize(rgba: Uint8ClampedArray, totalPixels: number) {
    // Fast path: ≤ 256 unique colours
    const colorMap = new Map<number, number>();
    for (let i = 0; i < rgba.length; i += 4) {
        const key = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
        colorMap.set(key, (colorMap.get(key) ?? 0) + 1);
    }

    if (colorMap.size <= 256) {
        const palette: Color[] = [];
        const toIndex = new Map<number, number>();
        for (const k of colorMap.keys()) {
            toIndex.set(k, palette.length);
            palette.push({ r: (k >> 16) & 0xFF, g: (k >> 8) & 0xFF, b: k & 0xFF });
        }
        while (palette.length < 256) palette.push({ r: 0, g: 0, b: 0 });

        const indices = new Uint8Array(totalPixels);
        for (let i = 0, j = 0; i < rgba.length; i += 4, j++)
            indices[j] = toIndex.get((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2])!;
        return { palette, indices };
    }

    // Octree quantisation (≤ 256 colours)
    const q = new OctreeQuantizer(256);
    for (let i = 0; i < rgba.length; i += 4) q.addColor(rgba[i], rgba[i + 1], rgba[i + 2]);
    const palette = q.buildPalette();

    const indices = new Uint8Array(totalPixels);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j++)
        indices[j] = q.getIndex(rgba[i], rgba[i + 1], rgba[i + 2]);
    return { palette, indices };
}

// ─── LZW encoder ─────────────────────────────────────────────────────────────

function lzwEncode(pixels: Uint8Array, minCode: number): Uint8Array {
    const clearCode = 1 << minCode;
    const eofCode  = clearCode + 1;

    let codeSize = minCode + 1;
    let maxCode  = 1 << codeSize;
    let nextCode = eofCode + 1;

    const table = new Map<string, number>();
    const init = () => {
        table.clear();
        for (let i = 0; i < clearCode; i++) table.set(String.fromCharCode(i), i);
        codeSize = minCode + 1; maxCode = 1 << codeSize; nextCode = eofCode + 1;
    };

    // Bit packer
    let bitBuf = 0, bitLen = 0;
    const bytes: number[] = [];
    const emit = (code: number) => {
        bitBuf |= code << bitLen; bitLen += codeSize;
        while (bitLen >= 8) { bytes.push(bitBuf & 0xFF); bitBuf >>>= 8; bitLen -= 8; }
    };

    init(); emit(clearCode);

    let prefix = String.fromCharCode(pixels[0]);
    for (let i = 1; i < pixels.length; i++) {
        const s = String.fromCharCode(pixels[i]);
        const ps = prefix + s;
        if (table.has(ps)) { prefix = ps; continue; }
        emit(table.get(prefix)!);
        if (nextCode < 4096) {
            table.set(ps, nextCode++);
            if (nextCode > maxCode && codeSize < 12) { codeSize++; maxCode <<= 1; }
        } else { emit(clearCode); init(); }
        prefix = s;
    }
    emit(table.get(prefix)!); emit(eofCode);
    if (bitLen > 0) bytes.push(bitBuf & 0xFF);

    // Pack into sub-blocks (≤ 255 bytes)
    const out: number[] = [minCode];
    for (let i = 0; i < bytes.length;) {
        const sz = Math.min(255, bytes.length - i);
        out.push(sz);
        for (let j = 0; j < sz; j++) out.push(bytes[i++]);
    }
    out.push(0); // block terminator
    return new Uint8Array(out);
}

// ─── GIF stream builder ───────────────────────────────────────────────────────

function buildGIF(w: number, h: number, frames: { palette: Color[], indices: Uint8Array, delayMs?: number }[]): Uint8Array {
    const buf: number[] = [];
    const u16 = (v: number) => [v & 0xFF, (v >> 8) & 0xFF];

    // Header
    buf.push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61); // GIF89a

    if (frames.length === 1) {
        // Logical Screen Descriptor
        buf.push(...u16(w), ...u16(h), 0b11110111, 0, 0); // GCT, 256 colours
        // Global Color Table
        for (let i = 0; i < 256; i++) {
            const c = frames[0].palette[i] ?? { r: 0, g: 0, b: 0 };
            buf.push(c.r, c.g, c.b);
        }
        // Image Descriptor
        buf.push(0x2C, ...u16(0), ...u16(0), ...u16(w), ...u16(h), 0);
        // LZW image data
        const lzw = lzwEncode(frames[0].indices, 8);
        buf.push(...lzw);
    } else {
        // Logical Screen Descriptor
        buf.push(...u16(w), ...u16(h), 0b01110000, 0, 0); // No GCT

        // Netscape Application Extension for looping
        buf.push(0x21, 0xFF, 0x0B);
        buf.push(..."NETSCAPE2.0".split("").map(c => c.charCodeAt(0)));
        buf.push(0x03, 0x01, 0x00, 0x00, 0x00); // Loop infinitely

        for (const frame of frames) {
            // Graphic Control Extension
            buf.push(0x21, 0xF9, 0x04);
            buf.push(0x04); // Disposal Method = 1 (Do not dispose)
            const delay = Math.round((frame.delayMs || 100) / 10);
            buf.push(...u16(delay));
            buf.push(0x00, 0x00);

            // Image Descriptor
            buf.push(0x2C, ...u16(0), ...u16(0), ...u16(w), ...u16(h));
            buf.push(0b10000111); // LCT, 256 colors

            // Local Color Table
            for (let i = 0; i < 256; i++) {
                const c = frame.palette[i] ?? { r: 0, g: 0, b: 0 };
                buf.push(c.r, c.g, c.b);
            }

            // LZW image data
            const lzw = lzwEncode(frame.indices, 8);
            buf.push(...lzw);
        }
    }

    // Trailer
    buf.push(0x3B);

    return new Uint8Array(buf);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Maximum dimension for the output GIF (preserves aspect ratio). */
const MAX_DIM = 512;
const VIDEO_MAX_DIM = 320;
const MAX_DURATION = 15;
const FPS = 10;

export async function encodeGIF(source: File | Blob, onProgress?: (pct: number) => void): Promise<Uint8Array> {
    const isVideo = source.type.startsWith("video/");

    if (!isVideo) {
        const bitmap = await createImageBitmap(source);
        let { width: w, height: h } = bitmap;

        // Resize if too large
        if (w > MAX_DIM || h > MAX_DIM) {
            const s = MAX_DIM / Math.max(w, h);
            w = Math.round(w * s); h = Math.round(h * s);
        }

        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
        ctx.drawImage(bitmap, 0, 0, w, h);
        bitmap.close();

        const { data } = ctx.getImageData(0, 0, w, h);
        const { palette, indices } = quantize(data, w * h);
        onProgress?.(1);
        return buildGIF(w, h, [{ palette, indices }]);
    }

    const video = document.createElement("video");
    const url = URL.createObjectURL(source);
    video.src = url;
    video.muted = true;
    video.crossOrigin = "anonymous";
    
    await new Promise((resolve, reject) => {
        video.onloadeddata = resolve;
        video.onerror = reject;
    });

    let { videoWidth: w, videoHeight: h } = video;
    if (w > VIDEO_MAX_DIM || h > VIDEO_MAX_DIM) {
        const s = VIDEO_MAX_DIM / Math.max(w, h);
        w = Math.round(w * s); h = Math.round(h * s);
    }

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
    
    const frames: { palette: Color[], indices: Uint8Array, delayMs: number }[] = [];
    const rawDuration = isFinite(video.duration) && video.duration > 0 ? video.duration : MAX_DURATION;
    const duration = Math.min(rawDuration, MAX_DURATION);
    const delayMs = 1000 / FPS;
    
    for (let t = 0; t < duration; t += 1 / FPS) {
        const seekPromise = new Promise(resolve => { video.onseeked = resolve; });
        video.currentTime = t;
        await seekPromise;
        
        ctx.drawImage(video, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        const { palette, indices } = quantize(data, w * h);
        frames.push({ palette, indices, delayMs });
        
        onProgress?.(t / duration);
    }
    
    URL.revokeObjectURL(url);
    onProgress?.(1);
    
    return buildGIF(w, h, frames);
}
