type SdkGenOptions = {
    folder: string;
    def?: string;
    fs: any;
    model?: {
        folder: string;
        entity: any;
    };
};
declare function SdkGen(opts: SdkGenOptions): {
    generate: (spec: any) => Promise<void>;
};
declare namespace SdkGen {
    var makeBuild: (root: any, opts: SdkGenOptions) => Promise<(model: any, build: any) => Promise<void>>;
}
export type { SdkGenOptions, };
export { SdkGen, };
