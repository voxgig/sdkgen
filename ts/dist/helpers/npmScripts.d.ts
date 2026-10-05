declare function npmScriptRm(paths: string[]): string;
declare function npmScriptEnv(name: string, value: string): string;
declare function npmScriptTestSome(nodeArgs: string[], glob: string): string;
export { npmScriptRm, npmScriptEnv, npmScriptTestSome, };
