type ExampleLang = 'ts' | 'js' | 'py' | 'php' | 'rb' | 'lua' | 'go';
type LiteralLang = ExampleLang | 'json';
declare const EXAMPLE_LANGS: ExampleLang[];
declare function helperLang(target: string): ExampleLang;
declare function litFor(lang: LiteralLang, type: any): string;
declare function idLiteral(ent: any, op: string, idF: string | null): string;
declare function litPair(lang: LiteralLang, name: string, value: string): string;
declare function requiredItems(ent: any, op: string): any[];
declare function matchArg(lang: LiteralLang, ent: any, op: string, idF: string | null, idLit: string): string;
declare function javaMap(count: number, pkg?: string): {
    open: string;
    pair: (kv: string) => string;
};
declare function javaMapOf(pairs: string[], pkg?: string): string;
declare function listMatchArg(lang: LiteralLang, ent: any): string;
declare function dataArg(lang: LiteralLang, ent: any, op: string, idF: string | null): string;
type PrimaryCall = {
    expr: string;
    resultVar: string;
    isVoid: boolean;
};
declare function primaryOpCall(lang: ExampleLang, eName: string, eLower: string, op: string, idF: string | null, ent: any): PrimaryCall;
export { EXAMPLE_LANGS, helperLang, primaryOpCall, idLiteral, requiredItems, matchArg, listMatchArg, dataArg, javaMap, javaMapOf, litFor, litPair, };
export type { ExampleLang, LiteralLang, PrimaryCall, };
