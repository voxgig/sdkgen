export type RangeResult = {
    kind: 'none';
} | {
    kind: 'range';
    start: number;
    end: number;
} | {
    kind: 'unsatisfiable';
};
export declare function parseRange(header: string | undefined, size: number): RangeResult;
export declare function noneMatch(header: string | undefined, etag: string): boolean;
export declare function matches(header: string | undefined, current: string | undefined): boolean;
export declare function ifRangeHolds(header: string | undefined, etag: string): boolean;
