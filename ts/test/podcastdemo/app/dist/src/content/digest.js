import { createHash } from 'node:crypto';
const ALGORITHMS = {
    'sha-256': 'sha256',
    'sha-512': 'sha512',
};
export function reprDigest(sha256) {
    return `sha-256=:${sha256.toString('base64')}:`;
}
export function etagOf(sha256) {
    return `"${sha256.subarray(0, 12).toString('base64url')}"`;
}
// RFC 9530 dictionary of byte sequences; null when malformed.
export function parseDigestField(value) {
    const out = new Map();
    for (const member of value.split(',')) {
        const m = /^\s*([a-z][a-z0-9_.*-]*)=:([A-Za-z0-9+/]*={0,2}):\s*$/.exec(member);
        if (!m)
            return null;
        out.set(m[1], Buffer.from(m[2], 'base64'));
    }
    return out;
}
export function checkDigest(value, bytes) {
    const field = parseDigestField(value);
    if (null == field)
        return 'malformed';
    let checked = false;
    for (const [name, expected] of field) {
        const algorithm = ALGORITHMS[name];
        if (!algorithm)
            continue;
        checked = true;
        if (!createHash(algorithm).update(bytes).digest().equals(expected)) {
            return 'mismatch';
        }
    }
    return checked ? 'ok' : 'unsupported';
}
//# sourceMappingURL=digest.js.map