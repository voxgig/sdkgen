type SdkGenOptions = {
    folder: string;
    fs: any;
};
declare function SdkGen(opts: SdkGenOptions): {
    generate: (spec: any) => void;
};
declare namespace SdkGen {
    var makeBuild: (root: any, opts: SdkGenOptions) => (model: any, build: any) => void;
}
export type { SdkGenOptions, };
export { SdkGen, };
