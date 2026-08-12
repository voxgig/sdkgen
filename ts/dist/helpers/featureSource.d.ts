type FeatureSource = {
    name: string;
    path: string;
    folder: boolean;
};
declare function featureOf(entry: string, folder: boolean): string;
declare function availableFeatures(fs: any, sdkfolder: string): string[];
declare function findFeatureSources(fs: any, tmfolder: string, available: string[]): FeatureSource[];
declare function featureExcludes(sources: FeatureSource[]): RegExp[];
declare function fullsetExcludes(paths: string[]): RegExp[];
declare function srcFeatureExcludes(model: any): RegExp[];
export type { FeatureSource, };
export { featureOf, availableFeatures, findFeatureSources, featureExcludes, fullsetExcludes, srcFeatureExcludes, };
