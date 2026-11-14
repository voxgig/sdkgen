import type { RuntimeFacts } from './example';
declare function listSentence(f: RuntimeFacts): string;
declare function loadSentence(f: RuntimeFacts): string;
declare function createComment(f: RuntimeFacts): string;
declare function listComment(f: RuntimeFacts, title: string): string;
declare function loadComment(f: RuntimeFacts, title: string): string;
export { createComment, listComment, listSentence, loadComment, loadSentence, };
