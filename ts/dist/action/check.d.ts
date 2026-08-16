import type { ActionContext, ActionResult } from '../types';
import type { Finding } from '../helpers/manifest';
type CheckReport = {
    ok: boolean;
    ref: string;
    root: string;
    errors: number;
    warnings: number;
    findings: Finding[];
    summary: string;
};
declare function cmd_package_check(args: string[], actx: ActionContext): Promise<ActionResult>;
declare function checkPackage(ref: string, actx: ActionContext): CheckReport;
export type { CheckReport, };
export { cmd_package_check, checkPackage, };
