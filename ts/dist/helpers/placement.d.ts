type ExternalOverride = {
    path?: string;
    sdkrel?: string;
    enclosing?: boolean;
};
type Place = 'root' | 'folder' | 'external';
declare function readOverride(declared: Record<string, ExternalOverride> | undefined, raw: string | undefined, targets: string[]): {
    override: Record<string, ExternalOverride>;
    named: string[];
};
declare function runOutput(output: any, ov?: ExternalOverride): any;
declare function runPlace(target: any, ov?: ExternalOverride): Place;
declare function runFolder(target: any, name: string, project: string, ov?: ExternalOverride): string;
export type { ExternalOverride, Place, };
export { readOverride, runOutput, runPlace, runFolder, };
