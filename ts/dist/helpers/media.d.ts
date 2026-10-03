declare const RAW_BODY = "$body";
declare function opRequestBody(op: any): any;
declare function opRawBody(op: any): any;
declare function bodyNote(op: any, target: {
    values: string;
    binary?: boolean;
}): string;
export { RAW_BODY, bodyNote, opRawBody, opRequestBody, };
