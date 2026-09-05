import type { ActionContext, ActionResult } from '../types';
type DoctorReport = {
    forked: string[];
    edited: string[];
    stale: string[];
    missing: string[];
    additive: string[];
    superseded: string[];
    unwired: string[];
    resyncPending: string[];
    aliasedDiff: string[];
    ok: boolean;
};
declare function action_doctor(args: string[], actx: ActionContext): Promise<ActionResult>;
type DoctorScope = (kind: string, name: string) => boolean;
declare function doctor(actx: ActionContext, scope?: DoctorScope): Promise<ActionResult>;
export type { DoctorReport, DoctorScope, };
export { action_doctor, doctor, };
