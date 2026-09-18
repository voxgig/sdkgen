import type { ResolvedSpec } from '@voxgig/apidef';
declare function resolvedFor(ctx$: any): ResolvedSpec | undefined;
declare function liveHint(point: any): any;
declare function hasLiveScenarios(model: any): boolean;
declare function pointFacts(ctx$: any, point: any): any;
export { resolvedFor, liveHint, pointFacts, hasLiveScenarios, };
