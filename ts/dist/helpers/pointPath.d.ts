type PathSegment = {
    lit?: string;
    var?: string;
};
declare function pointSegments(point: any): PathSegment[];
declare function pointParts(point: any): string[];
declare function pointTerminalParam(point: any): boolean;
declare function pointPathKey(point: any): string;
export type { PathSegment, };
export { pointSegments, pointParts, pointTerminalParam, pointPathKey, };
