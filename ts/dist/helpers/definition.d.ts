declare function definitionPath(sdkfolder: string, kind: string, name: string): string;
declare function definitionPathAny(fs: any, sdkfolder: string, kind: string, name: string): string;
declare function definitionFolder(sdkfolder: string, kind: string): string;
declare function indexName(kind: string): string;
declare function definitionNames(fs: any, sdkfolder: string, kind: string): string[];
export { definitionPath, definitionPathAny, definitionFolder, definitionNames, indexName, };
