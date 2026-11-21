import { renderValue, sentinelName } from '../helpers/doctext';
type FeatureDoc = {
    name: string;
    Name: string;
    title: string;
    transport: string;
    wraps: boolean;
    on: boolean;
    hooks: string[];
    options: Array<{
        name: string;
        value: string;
    }>;
    extras: Array<{
        name: string;
        type: string;
    }>;
};
declare function featureDocs(model: any, target?: any): FeatureDoc[];
declare function codeList(names: string[]): string;
declare function honoursActivationOrder(target: any): boolean;
export { featureDocs, codeList, renderValue, sentinelName, honoursActivationOrder, };
export type { FeatureDoc };
