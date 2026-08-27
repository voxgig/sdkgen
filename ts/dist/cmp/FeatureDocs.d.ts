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
export { featureDocs, renderValue, };
export type { FeatureDoc };
