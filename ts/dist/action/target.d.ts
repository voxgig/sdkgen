import type { ActionContext, ActionResult } from '../types';
import { aliasCmpName, aliasCmpText } from '../helpers/cmpfile';
import type { Source } from './resolve';
import type { CopyRecord } from './copies';
declare function action_target(args: string[], actx: ActionContext): Promise<ActionResult>;
declare function target_add(targets: string[], actx: ActionContext): Promise<ActionResult>;
declare function aliasCmpTree(ctx$: any, fromDir: string, toRel: string, torigname: string, tname: string, cmpbase?: string): void;
declare function pruneStaleTemplates(ctx$: any, fromDir: string, toRel: string, trim: RegExp[], dryrun?: boolean, keep?: {
    names: string[];
    patterns: RegExp[];
}, copies?: RetiredCopies): void;
declare function pruneRetired(ctx$: any, actx: any, kind: string, source: Source, fromDir: string, toRel: string): void;
type RetiredCopies = {
    record: CopyRecord;
    kind: string;
    source: Source;
    released?: Set<string>;
    rename?: (rel: string) => string;
    discard?: boolean;
};
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
    package: string | undefined;
};
export { action_target, featureCatalogue, target_add, resolveTarget, trimFeatures, readTargetFeature, aliasCmpText, aliasCmpName, aliasCmpTree, pruneStaleTemplates, pruneRetired, };
