import { Readable } from 'node:stream';
import { type Content } from './content.js';
export declare const WAV_TYPE = "audio/wav";
export declare const WAV_HEADER_SIZE = 44;
export declare const SAMPLE_RATE = 16000;
export declare function wavHeader(size: number): Buffer;
export declare function sampleAt(seed: number, i: number): number;
export declare function wavBytes(seed: number, size: number, start: number, end: number): Buffer;
export declare class GeneratedWav implements Content {
    readonly seed: number;
    readonly size: number;
    readonly type = "audio/wav";
    constructor(seed: number, size: number);
    read(start: number, end: number): Readable;
    sha256(): Promise<Buffer>;
}
