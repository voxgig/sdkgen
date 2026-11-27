import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
export class BufferContent {
    bytes;
    type;
    hash;
    constructor(bytes, type) {
        this.bytes = bytes;
        this.type = type;
    }
    get size() {
        return this.bytes.length;
    }
    read(start, end) {
        return Readable.from([this.bytes.subarray(start, end)], { objectMode: false });
    }
    async sha256() {
        if (!this.hash) {
            this.hash = createHash('sha256').update(this.bytes).digest();
        }
        return this.hash;
    }
}
export async function hashStream(stream, algorithm = 'sha256') {
    const hash = createHash(algorithm);
    for await (const chunk of stream) {
        hash.update(chunk);
    }
    return hash.digest();
}
export async function collect(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}
//# sourceMappingURL=content.js.map