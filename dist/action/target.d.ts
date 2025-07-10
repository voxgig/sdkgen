import type { ActionContext, ActionResult } from '../types';
declare function action_target(args: string[], actx: ActionContext): Promise<ActionResult>;
declare function target_add(targets: string[], actx: ActionContext): Promise<ActionResult>;
export { action_target, target_add, };
