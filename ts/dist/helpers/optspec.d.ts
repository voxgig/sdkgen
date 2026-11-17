declare function featureOptionSpec(feat: any): Record<string, any>;
declare function optionSpec(model: any, targetname?: string): Record<string, any>;
declare function entitySpecMap(model: any, targetname?: string): Record<string, any> | null;
export { optionSpec, featureOptionSpec, entitySpecMap, };
