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
};
declare function renderValue(v: any): string;
declare function featureDocs(model: any): FeatureDoc[];
declare function honoursActivationOrder(target: any): boolean;
export { featureDocs, renderValue, honoursActivationOrder, };
export type { FeatureDoc };
