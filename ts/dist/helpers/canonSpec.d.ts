declare function sentinel(name: string): string;
declare function anyOf(alts: any[]): any[];
declare function isAnyOf(spec: any): boolean;
declare const SPEC_STRING: any[];
declare function alternatives(spec: any): any[];
declare function optionalSpec(spec: any): any;
declare function oneUnionPaths(spec: any, path?: string): string[];
declare function canonToSpec(type: unknown, optional?: boolean): any;
declare function entityDataSpec(ent: any): Record<string, any>;
declare function entityOpSpec(ent: any, opname: string): Record<string, any> | null;
declare function entitySpecs(ent: any): {
    data: Record<string, any>;
    op: Record<string, any>;
};
type ValidateSeeds = {
    valid: Record<string, string | number>;
    invalid: Record<string, string | number> | null;
};
declare function validateSeeds(ent: any): ValidateSeeds | null;
declare function byExampleSpec(val: any): any;
export { alternatives, anyOf, byExampleSpec, canonToSpec, isAnyOf, oneUnionPaths, optionalSpec, entityDataSpec, entityOpSpec, entitySpecs, sentinel, validateSeeds, SPEC_STRING, };
export type { ValidateSeeds, };
