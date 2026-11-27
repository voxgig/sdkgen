import { Readable } from 'node:stream';
import { hashStream } from './content.js';
export const WAV_TYPE = 'audio/wav';
export const WAV_HEADER_SIZE = 44;
export const SAMPLE_RATE = 16000;
const CHUNK = 64 * 1024;
const MAX_WAV_SIZE = 0xffffffff + 8;
const digestCache = new Map();
export function wavHeader(size) {
    const header = Buffer.alloc(WAV_HEADER_SIZE);
    header.write('RIFF', 0, 'ascii');
    header.writeUInt32LE(size - 8, 4);
    header.write('WAVE', 8, 'ascii');
    header.write('fmt ', 12, 'ascii');
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(SAMPLE_RATE, 24);
    header.writeUInt32LE(SAMPLE_RATE * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36, 'ascii');
    header.writeUInt32LE(size - WAV_HEADER_SIZE, 40);
    return header;
}
function noise(seed, i) {
    let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(i, 0xc2b2ae35);
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    return ((h ^ (h >>> 16)) & 0x1ff) - 0x100;
}
export function sampleAt(seed, i) {
    const freq = 220 + (seed % 8) * 55;
    const tone = Math.round(Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE) * 8000);
    return tone + noise(seed, i);
}
// Each byte is a function of (seed, size, position), so any range is
// produced without producing what precedes it.
export function wavBytes(seed, size, start, end) {
    const out = Buffer.alloc(end - start);
    const header = start < WAV_HEADER_SIZE ? wavHeader(size) : undefined;
    let pos = start;
    while (pos < end && pos < WAV_HEADER_SIZE) {
        out[pos - start] = header[pos];
        pos++;
    }
    while (pos < end) {
        const d = pos - WAV_HEADER_SIZE;
        const sample = sampleAt(seed, d >> 1) & 0xffff;
        out[pos - start] = 0 === (d & 1) ? sample & 0xff : sample >> 8;
        pos++;
    }
    return out;
}
export class GeneratedWav {
    seed;
    size;
    type = WAV_TYPE;
    constructor(seed, size) {
        this.seed = seed;
        this.size = size;
        if (!Number.isSafeInteger(size) || size < WAV_HEADER_SIZE || size > MAX_WAV_SIZE) {
            throw new Error(`WAV size out of range: ${size}`);
        }
        if (!Number.isSafeInteger(seed)) {
            throw new Error(`WAV seed is not an integer: ${seed}`);
        }
    }
    read(start, end) {
        const { seed, size } = this;
        function* chunks() {
            for (let at = start; at < end; at += CHUNK) {
                yield wavBytes(seed, size, at, Math.min(end, at + CHUNK));
            }
        }
        return Readable.from(chunks(), { objectMode: false });
    }
    sha256() {
        const key = `${this.seed}:${this.size}`;
        let hash = digestCache.get(key);
        if (!hash) {
            hash = hashStream(this.read(0, this.size));
            digestCache.set(key, hash);
        }
        return hash;
    }
}
//# sourceMappingURL=wav.js.map