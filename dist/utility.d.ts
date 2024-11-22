declare const resolvePath: (ctx$: any, path: string) => any;
declare const requirePath: (ctx$: any, path: string, flags?: {
    ignore?: boolean;
}) => any;
declare class SdkGenError extends Error {
    constructor(...args: any[]);
}
export { resolvePath, requirePath, SdkGenError, };
