declare function tags(val: any): string[];
declare function featureApplies(feature: any, target: any): boolean;
declare function targetFeatures(model: any, target: any): Record<string, any>;
declare const TAGS: string[];
declare function unknownTags(val: any): string[];
export { featureApplies, targetFeatures, tags as featureTags, unknownTags, TAGS, };
