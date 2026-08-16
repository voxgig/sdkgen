declare const ANCHOR = "base: 'BASE'";
declare const ANCHOR_RE: RegExp;
declare function aontuKey(name: string): string;
declare function unquoted(line: string): string;
declare function slashComments(text: string): {
    line: number;
    text: string;
}[];
declare function strictAontu(): any;
declare function includeLine(file: string): string;
type CompileResult = {
    model?: any;
    errors: string[];
};
declare function compileModel(src: string, path: string, opts?: {
    strict?: boolean;
    schema?: boolean;
}): CompileResult;
declare const PUBLISH_OVERRIDES: [string, string, string][];
declare function publishOverrideProbe(src: string, path: string, tname: string): CompileResult;
export type { CompileResult, };
export { ANCHOR, ANCHOR_RE, PUBLISH_OVERRIDES, aontuKey, compileModel, includeLine, publishOverrideProbe, slashComments, strictAontu, unquoted, };
