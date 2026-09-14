import type { ActionContext, ActionResult } from '../types';
declare function action_edition(args: string[], actx: ActionContext): Promise<ActionResult>;
declare function edition_add(edition: string[], actx: ActionContext): Promise<ActionResult>;
export { action_edition, edition_add, };
