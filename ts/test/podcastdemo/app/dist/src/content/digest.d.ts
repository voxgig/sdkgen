export declare function reprDigest(sha256: Buffer): string;
export declare function etagOf(sha256: Buffer): string;
export declare function parseDigestField(value: string): Map<string, Buffer> | null;
export type DigestCheck = 'ok' | 'mismatch' | 'unsupported' | 'malformed';
export declare function checkDigest(value: string, bytes: Buffer): DigestCheck;
