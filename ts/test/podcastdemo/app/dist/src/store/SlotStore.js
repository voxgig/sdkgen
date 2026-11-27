import { etagOf, reprDigest } from '../content/digest.js';
export function slotKey(kind, id, slot) {
    return `${kind}/${id}/${slot}`;
}
// File bytes, by slot; a record carries only the FileInfo read from here.
export class SlotStore {
    slots = new Map();
    async put(key, content, now = new Date()) {
        const sha256 = await content.sha256();
        const info = {
            size: content.size,
            type: content.type,
            etag: etagOf(sha256),
            digest: reprDigest(sha256),
            modified: now.toISOString(),
        };
        this.slots.set(key, { content, info });
        return info;
    }
    get(key) {
        return this.slots.get(key);
    }
    info(key) {
        return this.slots.get(key)?.info;
    }
    deletePrefix(prefix) {
        let count = 0;
        for (const key of [...this.slots.keys()]) {
            if (key.startsWith(prefix)) {
                this.slots.delete(key);
                count++;
            }
        }
        return count;
    }
    get count() {
        return this.slots.size;
    }
}
//# sourceMappingURL=SlotStore.js.map