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
export { buildIdNames, };
