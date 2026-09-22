import type { ActionContext, ActionResult } from '../types';
type RemovePlan = {
    kind: string;
    name: string;
    files: string[];
    dirs: string[];
    indexed: boolean;
    output?: string;
    refused: string[];
    aliased: string[];
    notes: string[];
};
declare function kind_remove(kind: string, names: string[], actx: ActionContext): Promise<ActionResult>;
declare function planRemove(kind: string, name: string, actx: ActionContext, deleteOutput: boolean): Promise<RemovePlan>;
export type { RemovePlan, };
export { kind_remove, planRemove, };
