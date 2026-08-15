import type { ActionContext, ActionResult } from '../types';
declare function action_target(args: string[], actx: ActionContext): Promise<ActionResult>;
declare function target_add(targets: string[], actx: ActionContext): Promise<ActionResult>;
declare function aliasCmpName(name: string, torigname: string, tname: string): string;
declare function aliasCmpText(src: string, torigname: string, tname: string): string;
declare function featureCatalogue(ctx$: any, tfolder: string): string[];
declare function trimFeatures(ctx$: any, tfolder: string, torigname: string, tname: string, features: string[]): RegExp[];
declare function readTargetFeature(ctx$: any, tfolder: string, torigname: string, tname: string): {
    trim: boolean;
    fullset: string[];
};
declare function resolveTarget(tref: string, ctx$: any): {
    tname: string;
    tfolder: string;
    torigname: string;
    base: string;
};
export { action_target, featureCatalogue, target_add, resolveTarget, trimFeatures, readTargetFeature, aliasCmpText, aliasCmpName, };
