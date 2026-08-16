type FeatureSource = {
    name: string;
    path: string;
    folder: boolean;
};
type FeatureEntry = FeatureSource & {
    shaped: boolean;
};
declare const BASE_FEATURE = "base";
declare function featureOf(entry: string, folder: boolean): string;
declare function availableFeatures(fs: any, sdkfolder: string): string[];
declare function featureShaped(entry: string, folder: boolean): boolean;
declare function findFeatureEntries(fs: any, tmfolder: string, known: Set<string>): FeatureEntry[];
declare function findFeatureSources(fs: any, tmfolder: string, available: string[]): FeatureSource[];
declare function featureExcludes(sources: FeatureSource[]): RegExp[];
declare function fullsetExcludes(paths: string[]): RegExp[];
declare function srcFeatureExcludes(model: any): RegExp[];
export type { FeatureSource, FeatureEntry, };
export { BASE_FEATURE, featureOf, featureShaped, availableFeatures, findFeatureEntries, findFeatureSources, featureExcludes, fullsetExcludes, srcFeatureExcludes, };
