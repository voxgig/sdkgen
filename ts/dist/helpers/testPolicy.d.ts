declare function liveStrict(model: any, target?: string): boolean;
declare function liveStrictNote(strict: boolean, prefix: string, indent?: string): string;
type LiveFlowNeeds = {
    keys: string[];
    discover?: Record<string, string>;
    blocked?: string;
};
declare function liveFlowNeeds(entity: any, flow: any): LiveFlowNeeds;
declare function liveIdKey(entityName: string, paramName: string): string;
declare function liveExampleIds(entity: any): [string, string | number | boolean][];
declare function liveQueryExamples(point: any): [string, string | number | boolean][];
declare function liveRouteExamples(entity: any, opname: string, bound: string[], pathBound?: boolean): [
    string,
    string | number | boolean
][];
declare function liveStepExamples(entity: any, step: any): [string, string | number | boolean][];
export type { LiveFlowNeeds };
export { liveStrict, liveStrictNote, liveFlowNeeds, liveIdKey, liveExampleIds, liveQueryExamples, liveRouteExamples, liveStepExamples, };
