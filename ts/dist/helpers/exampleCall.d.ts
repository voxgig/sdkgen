type CallLang = 'c' | 'clojure' | 'cpp' | 'csharp' | 'elixir' | 'java' | 'kotlin' | 'ocaml' | 'perl' | 'rust' | 'scala' | 'swift' | 'zig';
type ExampleInput = {
    model: any;
    ent: any;
    op: string;
    idF: string | null;
};
type ExampleParts = {
    v: string;
    factory: string;
    arg: string;
};
declare function entityName(ent: any): string;
declare function exampleParts(lang: CallLang, x: ExampleInput): ExampleParts;
export { exampleParts, entityName, };
export type { CallLang, ExampleInput, ExampleParts, };
