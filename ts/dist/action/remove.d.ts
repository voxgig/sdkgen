import type { ActionContext, ActionResult } from '../types';
type RemovePlan = {
    kind: string;
    name: string;
    files: string[];
    dirs: string[];
    indexed: boolean;
    output?: string;
    refused: string[];
    notes: string[];
};
declare const KIND_ORDER: string[];
declare function kind_remove(kind: string, names: string[], actx: ActionContext): Promise<ActionResult>;
declare function planRemove(kind: string, name: string, actx: ActionContext, deleteOutput: boolean): Promise<RemovePlan>;
export type { RemovePlan, };
export { KIND_ORDER, kind_remove, planRemove, };
