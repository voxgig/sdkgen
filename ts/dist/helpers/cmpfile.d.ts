declare const CMP_SRC = "src/cmp/";
declare const CMP_DIST = "dist/cmp/";
declare const COMPILED_EXTS: string[];
declare function componentModule(target: string, name: string): string;
declare function componentSource(target: string, name: string): string;
declare function parseComponent(rel: string): {
    target: string;
    name: string;
} | undefined;
declare function compiledStem(rel: string): string;
declare function compiledFiles(rel: string): string[];
declare function sourceStem(distRel: string): string;
declare function aliasCmpName(name: string, torigname: string, tname: string): string;
declare function aliasCmpText(src: string, torigname: string, tname: string, cmpbase?: string): string;
export { CMP_SRC, CMP_DIST, COMPILED_EXTS, componentModule, componentSource, parseComponent, compiledStem, compiledFiles, sourceStem, aliasCmpName, aliasCmpText, };
