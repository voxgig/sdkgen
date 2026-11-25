type GuardLine = {
    text: string;
    chain: string;
};
type GuardFinding = {
    relation: string;
    chain: string;
    cause: string;
    doc: string;
    line: string;
};
type TextFinding = {
    relation: 'link' | 'marker' | 'fence' | 'off';
    doc: string;
    line: string;
    cause: string;
};
type TextGuardOptions = {
    fences?: Record<string, string>;
    absent?: (string | RegExp)[];
    present?: string[];
};
declare const FENCES: Record<string, string>;
declare function mention(w: string): RegExp;
declare function linkFindings(lines: Record<string, GuardLine[]>, files: Record<string, string>, present: Set<string>): GuardFinding[];
declare function markerFindings(lines: Record<string, GuardLine[]>): GuardFinding[];
declare function fenceFindings(lines: Record<string, GuardLine[]>, fences: Record<string, string>): GuardFinding[];
declare function offFindings(lines: Record<string, GuardLine[]>, mentions: [string, RegExp][]): GuardFinding[];
declare function textGuard(files: Record<string, string>, opts?: TextGuardOptions): TextFinding[];
export type { GuardFinding, GuardLine, TextFinding, TextGuardOptions, };
export { FENCES, mention, linkFindings, markerFindings, fenceFindings, offFindings, textGuard, };
