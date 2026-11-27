import type { TargetOrigins } from '../action/resolve';
declare function entityCollection(model: any): any;
declare function deriveEntityNames(entityColl: any): any[];
declare const OP_SUFFIX: Record<string, 'Match' | 'Data'>;
declare function opTypeName(Name: string, opname: string): string;
type OpShapeItem = {
    name: string;
    type: any;
    optional: boolean;
};
declare function opActions(op: any): {
    action: string;
    path: string;
}[];
declare function entityActions(entity: any): {
    op: string;
    action: string;
    path: string;
}[];
type BinarySlot = {
    name: string;
    action: string;
    read?: string;
    write?: string;
};
declare function entitySlots(entity: any): BinarySlot[];
declare function modelCodecs(model: any): {
    form: boolean;
    multipart: boolean;
    raw: boolean;
    slots: boolean;
};
declare function entityPath(entity: any): string;
type DirectRoute = {
    path: string;
    method: string;
    param: string;
};
declare function directRoute(model: any): DirectRoute;
declare function ownPoint(points: any[]): any;
declare function opReachable(op: any, given: string[]): boolean;
declare function opNeedsHandle(op: any): boolean;
declare function opNeedsAction(op: any): boolean;
declare function selectablePoints(op: any): any[];
declare function pointRequires(pt: any): string[];
declare function opParams(op: any): any[];
declare function bodyFieldNames(pt: any, fields: any[]): string[];
declare function opRequestShape(ent: any, opname: string): {
    items: OpShapeItem[];
    fromParams: boolean;
};
declare function entityIdField(ent: any): string | null;
declare function invalidRequest(ent: any): {
    op: string;
    field: string;
    args: Record<string, any>;
} | null;
declare const CANON_OP_ORDER: string[];
declare function entityOps(ent: any): string[];
declare function introOps(model: any): string[];
declare function generatedOps(model: any): string[];
type UngeneratedOp = {
    entity: string;
    op: string;
    points: string[];
};
declare function ungeneratedOps(model: any): UngeneratedOp[];
declare function warnUngeneratedOps(model: any, log: any, origins: TargetOrigins): UngeneratedOp[];
declare function entityPrimaryOp(ent: any): string | null;
declare function entityClassName(ent: any, entityColl: any, fold?: boolean): string;
declare function entityConstructorName(ent: any, entityColl: any): string;
declare function entityTypeCollisions(entityColl: any, fold?: boolean): string[];
declare function warnEntityTypeCollisions(entityColl: any, log: any, lang: string): string[];
declare function pickExampleEntity(entity: any): {
    entity: any;
    primaryOp: string | null;
};
declare function entityDataIdField(ent: any): string | null;
declare function entityRecordIdField(ent: any): string;
export { CANON_OP_ORDER, OP_SUFFIX, bodyFieldNames, deriveEntityNames, entityCollection, opTypeName, opParams, selectablePoints, pointRequires, opReachable, opNeedsHandle, opNeedsAction, ownPoint, opActions, entityActions, entitySlots, modelCodecs, entityPath, directRoute, opRequestShape, entityIdField, entityDataIdField, entityRecordIdField, entityOps, introOps, generatedOps, invalidRequest, entityPrimaryOp, pickExampleEntity, entityClassName, entityConstructorName, entityTypeCollisions, warnEntityTypeCollisions, ungeneratedOps, warnUngeneratedOps, };
export type { BinarySlot, DirectRoute, OpShapeItem, UngeneratedOp, };
