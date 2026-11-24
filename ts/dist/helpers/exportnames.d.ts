declare function exportedNames(src: string): Set<string>;
declare function missingExports(incoming: string, local: string): string[];
declare function isTypeScript(rel: string): boolean;
export { exportedNames, missingExports, isTypeScript, };
