declare const MANIFEST = "sdkgen-package.json";
declare const SCHEMA = 1;
type Manifest = {
    sdkgen: {
        package: number;
    };
    name: string;
    version?: string;
    engines?: {
        sdkgen?: string;
    };
    provides: Record<string, string[]>;
    targetsSupported?: Record<string, string[]>;
    parity?: Record<string, string>;
};
type ManifestRead = {
    file: string;
    manifest?: Manifest;
    err?: string;
};
type Finding = {
    level: 'error' | 'warn' | 'info';
    point: string;
    note: string;
    kind?: string;
    name?: string;
    file?: string;
};
declare function manifestPath(sdkfolder: string): string;
declare function readManifest(fs: any, sdkfolder: string): ManifestRead;
declare function checkShape(manifest: Manifest, file: string): Finding[];
declare const ITEM_NAME_RE: RegExp;
declare function validateManifest(fs: any, sdkfolder: string, manifest: Manifest, kinds: Record<string, {
    requires?: string[];
}>): Finding[];
type PackageProbe = {
    ref: string;
    root: string;
    sdk: string;
    read: ManifestRead;
};
declare function probePackage(fs: any, project: string, ref: string): {
    found?: PackageProbe;
    search: string[];
};
export type { Manifest, ManifestRead, PackageProbe, Finding, };
export { MANIFEST, SCHEMA, ITEM_NAME_RE, manifestPath, probePackage, readManifest, validateManifest, checkShape, };
