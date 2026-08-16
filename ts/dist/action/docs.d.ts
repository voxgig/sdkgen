import type { ActionContext, ActionResult } from '../types';
declare function action_docs(args: string[], actx: ActionContext): Promise<ActionResult>;
declare function docs_add(docs: string[], actx: ActionContext): Promise<ActionResult>;
export { action_docs, docs_add, };
