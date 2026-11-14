type FeatureDoc = {
    name: string;
    Name: string;
    title: string;
    transport: string;
    wraps: boolean;
    options: Array<{
        name: string;
        value: string;
    }>;
    extras: Array<{
        name: string;
        type: string;
    }>;
};
declare function sentinelName(v: any): string;
declare function renderValue(v: any): string;
declare function featureDocs(model: any, target?: any): FeatureDoc[];
declare function activeByDefault(f: FeatureDoc): boolean;
declare function honoursActivationOrder(target: any): boolean;
export { activeByDefault, featureDocs, renderValue, sentinelName, honoursActivationOrder, };
export type { FeatureDoc };
