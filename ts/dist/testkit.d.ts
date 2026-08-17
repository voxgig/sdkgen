declare const SDKGEN_ROOT: string;
declare const PLACEHOLDERS: string[];
type StageOptions = {
    dir?: string;
    name?: string;
    extra?: string;
    recordLog?: boolean;
};
type Consumer = {
    root: string;
    sdk: string;
    actx: any;
    log: any;
    addPackage: (ref: string, flags?: any) => Promise<any>;
    add: (kind: string, ref: string, flags?: any) => Promise<any>;
    bundledRef: (kind: string, name: string) => string;
    inSdk: <T>(fn: () => T) => T;
    compile: (opts?: {
        transform?: (src: string, file: string) => string;
    }) => number;
    files: () => string[];
    cleanup: () => void;
};
declare function stageConsumer(opts?: StageOptions): Consumer;
type GenerateOptions = {
    model: any;
    root?: any;
    allowPlaceholder?: (path: string, token: string) => boolean;
};
type GenerateResult = {
    files: Record<string, string>;
    leaks: string[];
};
declare function generateInto(consumer: Consumer, opts: GenerateOptions): Promise<GenerateResult>;
declare function manifestParity(pkgRoot: string): Record<string, string>;
export type { Consumer, StageOptions, GenerateOptions, GenerateResult, };
export { PLACEHOLDERS, SDKGEN_ROOT, stageConsumer, generateInto, manifestParity, };
