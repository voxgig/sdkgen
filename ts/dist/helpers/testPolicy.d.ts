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
type FlowRouteArg = {
    name: string;
    field?: string;
    idmap: string[];
};
type FlowLoadRoute = {
    route: string;
    point: any;
    args: FlowRouteArg[];
};
declare function flowLoadRoute(entity: any, step: any): FlowLoadRoute | undefined;
declare function liveFlowRoutes(entity: any, flow: any): any;
declare function liveEntity(ctx$: any, entity: any): any;
declare const LIVE_GETONLY_ENV = "VOXGIG_GETONLY_GUARD";
type LiveExcluded = {
    id: string;
    reason: string;
};
type LiveGetOnly = {
    excluded: LiveExcluded[];
    flow: any;
};
declare function liveFlowSteps(flow: any): any[];
declare function liveStepId(entity: any, step: any, index: number): string;
declare function liveGetOnlyReason(point: any): string | undefined;
declare function liveGetOnly(entity: any, flow: any): LiveGetOnly | undefined;
type LiveKeyExcluded = LiveExcluded & {
    key: string;
};
declare function liveDirectGetOnly(model: any, entity: any, test: string, keys: string[]): LiveKeyExcluded[];
declare function liveExcludedLines(plan: {
    excluded: LiveExcluded[];
}): string[];
declare function liveExcludedSummary(plan: {
    excluded: LiveExcluded[];
}): string;
export type { LiveFlowNeeds, LiveExcluded, LiveGetOnly, LiveKeyExcluded, FlowRouteArg, FlowLoadRoute };
export { liveStrict, liveStrictNote, liveFlowNeeds, liveIdKey, liveExampleIds, liveQueryExamples, liveRouteExamples, liveStepExamples, flowLoadRoute, liveFlowRoutes, liveEntity, LIVE_GETONLY_ENV, liveFlowSteps, liveStepId, liveGetOnly, liveGetOnlyReason, liveDirectGetOnly, liveExcludedLines, liveExcludedSummary, };
