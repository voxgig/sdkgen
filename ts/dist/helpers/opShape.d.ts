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
declare function entityIdField(ent: any): string | null;
declare function entityOps(ent: any): string[];
declare function entityPrimaryOp(ent: any): string | null;
declare function entityClassName(ent: any, entityColl: any): string;
declare function pickExampleEntity(entity: any): {
    entity: any;
    primaryOp: string | null;
};
declare function entityDataIdField(ent: any): string | null;
export { OP_SUFFIX, opTypeName, opParams, opRequestShape, entityIdField, entityDataIdField, entityOps, entityPrimaryOp, pickExampleEntity, entityClassName, };
export type { OpShapeItem, };
