declare function resolvePath(ctx$: any, path: string): any;
declare function isAuthActive(model: any): boolean;
declare function resolveAuthPrefix(model: any): string;
declare function requirePath(ctx$: any, path: string, flags?: {
    ignore?: boolean;
}): any;
declare class SdkGenError extends Error {
    constructor(...args: any[]);
}
export { resolvePath, requirePath, isAuthActive, resolveAuthPrefix, SdkGenError, };
