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
export type { Source, };
export { resolveSource, lastSegment, BUNDLED, };
