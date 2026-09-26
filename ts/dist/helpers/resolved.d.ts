import type { ResolvedSpec } from '@voxgig/apidef';
declare function resolvedFor(ctx$: any): ResolvedSpec | undefined;
declare function liveHint(point: any): any;
declare function hasLiveScenarios(model: any): boolean;
declare function pointFacts(ctx$: any, point: any): any;
declare function boundedFacts(facts: any, maxDepth?: number): any;
export { resolvedFor, liveHint, pointFacts, boundedFacts, hasLiveScenarios, };
