import type { ActionContext, ActionResult } from '../types';
declare function action_feature(args: string[], actx: ActionContext): Promise<ActionResult>;
declare function feature_add(features: string[], actx: ActionContext): Promise<ActionResult>;
export { feature_add, action_feature, };
