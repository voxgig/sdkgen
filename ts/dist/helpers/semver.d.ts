type Parts = [number, number, number];
declare function parseVersion(v: string): Parts | undefined;
declare function compareVersions(a: string, b: string): number | undefined;
declare function satisfies(version: string, range: string): boolean | undefined;
export { satisfies, parseVersion, compareVersions, };
