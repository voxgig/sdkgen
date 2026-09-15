declare function sentinel(name: string): string;
declare const SPEC_STRING: any[];
declare function optionalSpec(spec: any): any;
declare function canonToSpec(type: unknown, optional?: boolean): any;
declare function entityDataSpec(ent: any): Record<string, any>;
declare function entityOpSpec(ent: any, opname: string): Record<string, any> | null;
declare function entitySpecs(ent: any): {
    data: Record<string, any>;
    op: Record<string, any>;
};
declare function byExampleSpec(val: any): any;
export { byExampleSpec, canonToSpec, optionalSpec, entityDataSpec, entityOpSpec, entitySpecs, sentinel, SPEC_STRING, };
