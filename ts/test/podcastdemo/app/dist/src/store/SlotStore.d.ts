import type { Content } from '../content/content.js';
import type { FileInfo } from '../types.js';
export interface Slot {
    content: Content;
    info: FileInfo;
}
export declare function slotKey(kind: 'show' | 'episode', id: string, slot: string): string;
export declare class SlotStore {
    private slots;
    put(key: string, content: Content, now?: Date): Promise<FileInfo>;
    get(key: string): Slot | undefined;
    info(key: string): FileInfo | undefined;
    deletePrefix(prefix: string): number;
    get count(): number;
}
