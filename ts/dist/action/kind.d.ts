import type { Source } from './resolve';
type KindDef = {
    name: string;
    alias: boolean;
    rename?: (src: string, origname: string, name: string) => string;
    ownedWhenAliased?: boolean;
    trees?: TreeDef[];
};
type TreeDef = {
    path: string;
    replace: 'none' | 'template';
    required: boolean;
};
declare function aliasModelKey(kind: string): (src: string, origname: string, name: string) => string;
declare function escapeRe(s: string): string;
declare const KINDS: Record<string, KindDef>;
declare function kindTrees(kind: string, name: string): TreeDef[];
declare function kindDef(kind: string): KindDef;
declare function resolveKind(ref: string, kind: string, ctx$: any): Source;
declare function kindModel(props: {
    ctx$: any;
    kind: string;
    source: Source;
    names: string[];
    content: string;
}): void;
declare function recordedRef(declared: any, name: string): string | undefined;
declare function isBare(ref: string): boolean;
export type { KindDef, TreeDef, };
export { KINDS, recordedRef, aliasModelKey, kindTrees, escapeRe, kindDef, resolveKind, kindModel, isBare, };
