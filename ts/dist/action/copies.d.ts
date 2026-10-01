import type { ActionContext } from '../types';
import type { Source } from './resolve';
declare const COPY_LOG = "log/copies.jsonl";
type CopyItem = {
    package?: string;
    version?: string;
};
type CopyRecord = {
    items: Record<string, CopyItem>;
    files: Record<string, string>;
};
declare function itemKey(kind: string, name: string): string;
declare function fingerprint(content: any): string;
declare function readCopies(fs: any, folder: string): CopyRecord;
declare function isCopy(rel: string): boolean;
declare function recordCopies(actx: ActionContext, jres: any, kind: string, sources: Source[]): void;
declare function forgetCopies(actx: ActionContext, kind: string, name: string): void;
declare function untouched(fs: any, folder: string, record: CopyRecord, rel: string): boolean | undefined;
export type { CopyItem, CopyRecord, };
export { COPY_LOG, itemKey, fingerprint, readCopies, recordCopies, forgetCopies, untouched, isCopy, };
