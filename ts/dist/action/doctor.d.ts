import type { ActionContext, ActionResult } from '../types';
type DoctorReport = {
    forked: string[];
    edited: string[];
    stale: string[];
    missing: string[];
    additive: string[];
    unwired: string[];
    ok: boolean;
};
declare function action_doctor(args: string[], actx: ActionContext): Promise<ActionResult>;
declare function doctor(actx: ActionContext): Promise<ActionResult>;
export type { DoctorReport, };
export { action_doctor, doctor, };
