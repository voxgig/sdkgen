import { Readable } from 'node:stream';
export interface Content {
    readonly size: number;
    readonly type: string;
    read(start: number, end: number): Readable;
    sha256(): Promise<Buffer>;
}
export declare class BufferContent implements Content {
    readonly bytes: Buffer;
    readonly type: string;
    private hash?;
    constructor(bytes: Buffer, type: string);
    get size(): number;
    read(start: number, end: number): Readable;
    sha256(): Promise<Buffer>;
}
export declare function hashStream(stream: Readable, algorithm?: string): Promise<Buffer>;
export declare function collect(stream: Readable): Promise<Buffer>;
