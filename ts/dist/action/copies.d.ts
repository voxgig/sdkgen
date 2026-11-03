import type { ActionContext } from '../types';
import type { CopyMode } from '../helpers/copymerge';
import type { Source } from './resolve';
declare const COPY_LOG = "log/copies.jsonl";
declare const BASE_DIR = "log/base";
declare const CONFLICT_DIR = "log/conflict";
declare const IGNORED_LOG: string;
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
declare function ignoredLog(fs: any, folder: string): boolean;
declare function isCopy(rel: string): boolean;
declare function recordCopies(actx: ActionContext, jres: any, kind: string, sources: Source[]): void;
declare function forgetCopies(actx: ActionContext, kind: string, name: string): void;
declare function projectCopyMode(actx: ActionContext): CopyMode;
declare function guardCopies<T>(actx: ActionContext, what: string, run: (actx: ActionContext) => Promise<T>): Promise<T>;
declare function untouched(fs: any, folder: string, record: CopyRecord, rel: string): boolean | undefined;
export type { CopyItem, CopyRecord, };
export { BASE_DIR, CONFLICT_DIR, COPY_LOG, IGNORED_LOG, ignoredLog, itemKey, fingerprint, readCopies, recordCopies, forgetCopies, guardCopies, projectCopyMode, untouched, isCopy, };
