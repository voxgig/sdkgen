type FlowLike = {
    step?: Record<string, any> | any[];
};
type EntityLike = {
    name: string;
    relations?: {
        ancestors?: any;
    };
};
declare function buildIdNames(entity: EntityLike, flow: FlowLike): string[];
declare function entityRelationName(ref: string): string;
declare function flowSteps(flow: FlowLike): any[];
export { buildIdNames, entityRelationName, flowSteps, };
