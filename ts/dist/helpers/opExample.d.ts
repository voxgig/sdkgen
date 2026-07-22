type ExampleLang = 'ts' | 'js' | 'py' | 'php' | 'rb' | 'lua' | 'go';
declare function litFor(lang: ExampleLang, type: any): string;
declare function idLiteral(ent: any, op: string, idF: string | null): string;
declare function matchArg(lang: ExampleLang, ent: any, op: string, idF: string | null, idLit: string): string;
declare function dataArg(lang: ExampleLang, ent: any, op: string, idF: string | null): string;
type PrimaryCall = {
    expr: string;
    resultVar: string;
    isVoid: boolean;
};
declare function primaryOpCall(lang: ExampleLang, eName: string, eLower: string, op: string, idF: string | null, ent: any): PrimaryCall;
export { primaryOpCall, idLiteral, matchArg, dataArg, litFor, };
export type { ExampleLang, PrimaryCall, };
