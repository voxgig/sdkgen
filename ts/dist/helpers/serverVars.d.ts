type ServerVar = {
    name: string;
    dflt: string;
    required: boolean;
    description: string;
};
declare function serverVariables(model: any): ServerVar[];
declare function hasServerVariables(model: any): boolean;
export { serverVariables, hasServerVariables, };
export type { ServerVar };
