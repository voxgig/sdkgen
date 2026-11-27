import { crc32, deflateSync } from 'node:zlib';
export const PNG_TYPE = 'image/png';
export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function chunk(kind, data) {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(kind, 4, 'ascii');
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
    return Buffer.concat([head, data, crc]);
}
export function generatePng(seed, width, height) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    const row = 1 + width * 3;
    const raw = Buffer.alloc(row * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const at = y * row + 1 + x * 3;
            raw[at] = (seed * 37 + x * 16) & 0xff;
            raw[at + 1] = (seed * 91 + y * 16) & 0xff;
            raw[at + 2] = (seed * 53 + (x ^ y) * 8) & 0xff;
        }
    }
    return Buffer.concat([
        PNG_SIGNATURE,
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}
//# sourceMappingURL=png.js.map