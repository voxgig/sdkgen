import { type BuildOptions, type PodcastApp } from '../src/server.js';
export declare const TOKEN = "podcastdemo-local-token";
type Init = Omit<RequestInit, 'body'> & {
    body?: BodyInit | Buffer | null;
};
export interface Running extends PodcastApp {
    base: string;
    call(path: string, init?: Init): Promise<Response>;
    close(): Promise<void>;
}
export declare function start(options?: BuildOptions): Promise<Running>;
export declare const sha256: (bytes: Uint8Array) => NonSharedBuffer;
export declare const reprOf: (bytes: Uint8Array) => string;
export declare function bytesOf(res: Response): Promise<Buffer>;
export declare function wavFile(size: number, fill?: number): Buffer;
export declare function multipart(parts: {
    headers: string[];
    body: Buffer | string;
}[], boundary?: string): {
    body: Buffer<ArrayBuffer>;
    contentType: string;
};
export {};
