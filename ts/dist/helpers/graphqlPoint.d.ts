declare function pointIsGraphql(point: any): boolean;
declare function ownPointFirst(points: any[], entityName: string, opname: string): any[];
declare function primaryPoint<P>(points: P[], entityName: string, opname: string): P | undefined;
declare function graphqlDirectSkip(opname: string, entityName: string): string;
export { pointIsGraphql, ownPointFirst, primaryPoint, graphqlDirectSkip, };
