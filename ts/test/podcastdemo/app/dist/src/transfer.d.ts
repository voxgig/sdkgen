import type { Readable } from 'node:stream';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Slot } from './store/SlotStore.js';
export interface DownloadOptions {
    ranges: boolean;
    conditional: boolean;
    disposition?: string;
}
export interface Download {
    status: 200 | 206 | 304 | 416;
    headers: Record<string, string>;
    start: number;
    end: number;
    body: boolean;
}
export interface DownloadEvent {
    request: FastifyRequest;
    slot: Slot;
    download: Download;
    stream?: Readable;
}
export interface Intercept {
    request?(request: FastifyRequest, reply: FastifyReply): Promise<boolean>;
    download?(event: DownloadEvent): DownloadEvent | Promise<DownloadEvent>;
}
export declare function planDownload(method: string, headers: Record<string, string | string[] | undefined>, slot: Slot, options: DownloadOptions): Download;
export declare function sendDownload(request: FastifyRequest, reply: FastifyReply, slot: Slot, options: DownloadOptions, intercept: Intercept): Promise<FastifyReply>;
