import type { RuntimeFacts } from './example';
declare function listSentence(f: RuntimeFacts): string;
declare function loadSentence(f: RuntimeFacts): string;
declare function createComment(f: RuntimeFacts): string;
declare function listComment(f: RuntimeFacts, title: string): string;
declare function loadComment(f: RuntimeFacts, title: string): string;
declare function opText(f: RuntimeFacts, op: string, needs: string[], idInData: string | null): string;
declare function failsSentence(f: RuntimeFacts): string;
export { createComment, failsSentence, opText, listComment, listSentence, loadComment, loadSentence, };
