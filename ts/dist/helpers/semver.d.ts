type Parts = [number, number, number];
declare function parseVersion(v: string): Parts | undefined;
declare function satisfies(version: string, range: string): boolean | undefined;
export { satisfies, parseVersion, };
