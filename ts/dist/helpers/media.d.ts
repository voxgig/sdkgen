declare const RAW_BODY = "$body";
declare function opRequestBody(op: any): any;
declare function opRawBody(op: any): any;
type BodyFacts = {
    kind: 'raw' | 'encoded';
    media: string;
    binary: boolean;
    others: string[];
    encoded: string[];
};
declare function bodyFacts(op: any): BodyFacts | null;
declare function bodyNoteText(rb: BodyFacts | null, target: {
    values: string;
    once?: string;
    binary?: boolean;
}): string;
declare function bodyNote(op: any, target: {
    values: string;
    once?: string;
    binary?: boolean;
}): string;
export type { BodyFacts };
export { RAW_BODY, bodyFacts, bodyNote, bodyNoteText, opRawBody, opRequestBody, };
