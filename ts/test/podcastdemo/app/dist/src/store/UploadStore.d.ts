import type { Upload } from '../types.js';
export type AppendResult = {
    kind: 'appended';
    upload: Upload;
} | {
    kind: 'complete';
    upload: Upload;
    bytes: Buffer;
} | {
    kind: 'conflict';
    offset: number;
} | {
    kind: 'too-large';
};
export declare class UploadStore {
    private readonly ttlMs;
    private sessions;
    constructor(ttlMs: number);
    private sweep;
    count(now?: number): number;
    create(spec: Omit<Upload, 'id' | 'offset' | 'complete' | 'expires'>, now?: number): Upload;
    get(id: string, now?: number): Upload | undefined;
    append(id: string, offset: number, bytes: Buffer): AppendResult | undefined;
    restart(id: string): void;
    delete(id: string): boolean;
    deleteWhere(test: (u: Upload) => boolean): void;
}
