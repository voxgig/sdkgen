declare const SURFACE_SINCE: Record<string, string>;
declare const SURFACES: string[];
declare const SURFACE_WORD: Record<string, string>;
declare function surfaceOf(target: any): string;
declare function surfaceName(target: any): string;
declare function externalName(target: {
    title: string;
    surface: string;
    url: string;
}): string;
declare function documentOrder(model: any, targets: any[]): any[];
export { SURFACES, SURFACE_SINCE, SURFACE_WORD, documentOrder, externalName, surfaceName, surfaceOf, };
