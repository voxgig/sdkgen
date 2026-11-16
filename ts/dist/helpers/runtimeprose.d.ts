import type { RuntimeFacts } from './example';
declare const article: (s: string) => string;
declare function record(f: RuntimeFacts, bound: string): string;
declare function listSentence(f: RuntimeFacts, bound: string): string;
declare function loadSentence(f: RuntimeFacts, bound: string): string;
declare function writeSentence(f: RuntimeFacts, ops: string[], after?: boolean): string;
declare function createComment(f: RuntimeFacts, bound: string): string;
declare function listComment(f: RuntimeFacts, title: string, cls?: string): string;
declare function loadComment(f: RuntimeFacts, title: string, cls?: string): string;
declare function opText(f: RuntimeFacts, op: string, needs: string[], idInData: string | null, bound: string, ref?: {
    none?: string;
    deleted?: string;
    removeKeeps?: boolean;
}): string;
declare function failsSentence(f: RuntimeFacts): string;
export { article, createComment, failsSentence, opText, listComment, listSentence, loadComment, loadSentence, record, writeSentence, };
