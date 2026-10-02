declare const BUNDLED = "node_modules/@voxgig/sdkgen/project/.sdk";
type Source = {
    name: string;
    origname: string;
    folder: string;
    base: string;
    model: string;
    package?: string;
    version?: string;
};
declare function lastSegment(ref: string): string;
declare function resolveSource(ref: string, kind: string, ctx$: any): Source;
declare function registerInstalled(kind: string, refs: string[], ctx$: any): void;
declare function nameConflict(kind: string, source: Source, ctx$: any): {
    package?: string;
    base?: string;
} | undefined;
declare function recordedRef(declared: any, name: string): string | undefined;
declare function isBare(ref: string): boolean;
declare function resolvesBundled(declared: any, name: string): boolean;
type TargetOrigins = {
    bundled: string[];
    external: {
        name: string;
        from: string;
    }[];
};
declare function targetOrigins(model: any): TargetOrigins;
export type { Source, TargetOrigins, };
export { resolveSource, recordedRef, isBare, resolvesBundled, targetOrigins, registerInstalled, nameConflict, lastSegment, BUNDLED, };
