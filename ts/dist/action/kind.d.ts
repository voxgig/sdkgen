import type { Source } from './resolve';
type KindDef = {
    name: string;
    alias: boolean;
    rename?: (src: string, origname: string, name: string) => string;
    ownedWhenAliased?: boolean;
};
declare function aliasModelText(src: string, torigname: string, tname: string): string;
declare function escapeRe(s: string): string;
declare const KINDS: Record<string, KindDef>;
declare function kindDef(kind: string): KindDef;
declare function resolveKind(ref: string, kind: string, ctx$: any): Source;
declare function kindModel(props: {
    ctx$: any;
    kind: string;
    source: Source;
    names: string[];
    content: string;
}): void;
declare function isBare(ref: string): boolean;
export type { KindDef, };
export { KINDS, aliasModelText, escapeRe, kindDef, resolveKind, kindModel, isBare, };
