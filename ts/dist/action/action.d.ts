import type { ActionContext } from '../types';
declare function hasIndexEntry(content: string, name: string): boolean;
declare function appendIndexEntries(content: string, names: string[]): string;
declare function removeIndexEntries(content: string, names: string[]): string;
declare const UpdateIndex: import("jostraca").Component;
declare function parseAddNames(args: any[]): string[];
declare function loadContent(actx: ActionContext, which: string | string[], seed?: Record<string, string>): any;
declare function ensureModelInclude(actx: ActionContext, kind: string): boolean;
export { UpdateIndex, ensureModelInclude, appendIndexEntries, removeIndexEntries, hasIndexEntry, parseAddNames, loadContent };
