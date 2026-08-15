import type { ActionContext } from '../types';
declare function hasIndexEntry(content: string, name: string): boolean;
declare function appendIndexEntries(content: string, names: string[]): string;
declare function removeIndexEntries(content: string, names: string[]): string;
declare const UpdateIndex: import("jostraca").Component;
declare function parseAddNames(args: any[]): string[];
declare function loadContent(actx: ActionContext, which: string | string[]): any;
export { UpdateIndex, appendIndexEntries, removeIndexEntries, hasIndexEntry, parseAddNames, loadContent };
