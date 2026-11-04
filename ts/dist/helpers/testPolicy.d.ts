declare function liveStrict(model: any, target?: string): boolean;
declare function liveStrictNote(strict: boolean, prefix: string, indent?: string): string;
type Scalar = string | number | boolean;
type LiveFlowNeeds = {
    keys: string[];
    examples?: [string, Scalar][];
    record?: string;
    discover?: Record<string, string>;
    unrouted?: [string, string][];
    blocked?: string;
};
declare function liveFlowNeeds(entity: any, flow: any): LiveFlowNeeds;
declare function liveIdKey(entityName: string, paramName: string): string;
declare function liveExampleIds(entity: any): [string, string | number | boolean][];
declare function liveQueryExamples(point: any): [string, string | number | boolean][];
declare function liveRouteExamples(entity: any, opname: string, bound: string[], pathBound?: boolean): [
    string,
    Scalar
][];
type LiveIdentity = {
    field: string;
    key: string;
    ex?: Scalar;
};
declare function liveIdentity(entity: any, flow: any): LiveIdentity | undefined;
declare function liveRepeatsId(entity: any): boolean;
declare function liveLoadComparesId(entity: any, flow: any): boolean;
declare function liveUnrouted(entity: any, step: any, flow?: any): [string, string][];
declare function liveStepExamples(entity: any, step: any, flow?: any): [string, Scalar][];
type FlowRouteArg = {
    name: string;
    field?: string;
    idmap: string[];
};
type FlowLoadRoute = {
    route: string;
    point: any;
    args: FlowRouteArg[];
    offline: boolean;
};
declare function flowLoadRoute(entity: any, step: any): FlowLoadRoute | undefined;
declare function flowLoadReadsRecord(entity: any, step: any): boolean;
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
declare function liveFlowPlan(entity: any, flow: any): LiveGetOnly | undefined;
type LiveGate = {
    getOnly: boolean;
    plan: LiveGetOnly;
    runs: boolean;
};
declare function liveGates(entity: any, flow: any): LiveGate[];
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
export type { LiveFlowNeeds, LiveIdentity, LiveExcluded, LiveGetOnly, LiveGate, LiveKeyExcluded, FlowRouteArg, FlowLoadRoute };
export { liveStrict, liveStrictNote, liveFlowNeeds, liveIdentity, liveRepeatsId, liveLoadComparesId, liveUnrouted, liveIdKey, liveExampleIds, liveQueryExamples, liveRouteExamples, liveStepExamples, flowLoadRoute, flowLoadReadsRecord, liveFlowRoutes, liveEntity, LIVE_GETONLY_ENV, liveFlowSteps, liveStepId, liveGetOnly, liveGetOnlyReason, liveFlowPlan, liveGates, liveDirectGetOnly, liveExcludedLines, liveExcludedSummary, };
