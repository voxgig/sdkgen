declare const ONE_UNION_TARGETS: string[];
declare function targetSpec<T>(model: any, targetname: string | undefined, spec: T): T;
declare function featureOptionSpec(feat: any): Record<string, any>;
declare function optionSpec(model: any, targetname?: string): Record<string, any>;
declare function entitySpecMap(model: any, targetname?: string): Record<string, any> | null;
export { optionSpec, featureOptionSpec, entitySpecMap, targetSpec, ONE_UNION_TARGETS, };
