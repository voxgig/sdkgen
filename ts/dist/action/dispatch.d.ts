import type { ActionContext, ActionResult } from '../types';
type ActionFunc = (args: string[], actx: ActionContext) => Promise<ActionResult>;
declare function actionMap(): Record<string, ActionFunc>;
declare const ACTION_MAP: Record<string, ActionFunc>;
declare function actionNames(): string[];
declare function needsModel(args: string[]): boolean;
export type { ActionFunc, };
export { ACTION_MAP, actionMap, actionNames, needsModel, };
