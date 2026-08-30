type ServerVar = {
    name: string;
    dflt: string;
    required: boolean;
    description: string;
};
declare function serverVariables(model: any): ServerVar[];
declare function serverVarEnv(projenvname: string, name: string): string;
declare function hasServerVariables(model: any): boolean;
export { serverVariables, hasServerVariables, serverVarEnv, };
export type { ServerVar };
