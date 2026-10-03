type ExampleLang = 'ts' | 'js' | 'py' | 'php' | 'rb' | 'lua' | 'go';
type LiteralLang = ExampleLang | 'json';
declare function litFor(lang: LiteralLang, type: any): string;
declare function idLiteral(ent: any, op: string, idF: string | null): string;
declare function matchArg(lang: LiteralLang, ent: any, op: string, idF: string | null, idLit: string): string;
declare function dataArg(lang: LiteralLang, ent: any, op: string, idF: string | null): string;
type PrimaryCall = {
    expr: string;
    resultVar: string;
    isVoid: boolean;
};
declare function primaryOpCall(lang: ExampleLang, eName: string, eLower: string, op: string, idF: string | null, ent: any): PrimaryCall;
export { primaryOpCall, idLiteral, matchArg, dataArg, litFor, };
export type { ExampleLang, LiteralLang, PrimaryCall, };
