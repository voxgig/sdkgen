type DocText = {
    raw: string;
    vendor: boolean;
    at: any;
    path: string[];
};
declare function sentinelName(v: any): string;
declare function renderValue(v: any): string;
declare function docTexts(model: any): DocText[];
export { docTexts, renderValue, sentinelName, };
export type { DocText };
