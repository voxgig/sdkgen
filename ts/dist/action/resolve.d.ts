declare const BUNDLED = "node_modules/@voxgig/sdkgen/project/.sdk";
type Source = {
    name: string;
    origname: string;
    folder: string;
    base: string;
    model: string;
    package?: string;
};
declare function lastSegment(ref: string): string;
declare function resolveSource(ref: string, kind: string, ctx$: any): Source;
declare function registerInstalled(kind: string, refs: string[], ctx$: any): void;
declare function nameConflict(kind: string, source: Source, ctx$: any): {
    package?: string;
    base?: string;
} | undefined;
export type { Source, };
export { resolveSource, registerInstalled, nameConflict, lastSegment, BUNDLED, };
