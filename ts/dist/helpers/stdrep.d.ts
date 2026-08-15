declare function ensureStdrep(ctx$: any): any;
declare function templateReplacements(model: any, tname: string): Record<string, string>;
type Provenance = {
    base: string;
    origname?: string;
    name?: string;
    package?: string;
};
declare function provenanceReplace(prov: Provenance): Record<string, string>;
export type { Provenance, };
export { ensureStdrep, templateReplacements, provenanceReplace, };
