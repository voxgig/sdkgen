declare const OP_SUFFIX: Record<string, 'Match' | 'Data'>;
declare function opTypeName(Name: string, opname: string): string;
type OpShapeItem = {
    name: string;
    type: any;
    optional: boolean;
};
declare function opParams(op: any): any[];
declare function opRequestShape(ent: any, opname: string): {
    items: OpShapeItem[];
    fromParams: boolean;
};
export { OP_SUFFIX, opTypeName, opParams, opRequestShape, };
export type { OpShapeItem, };
