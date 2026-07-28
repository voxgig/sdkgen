import type { SdkModel, ModelDep } from '../types';
type DepEntry = {
    name: string;
    version: string;
    source: 'feature' | 'target';
    raw: ModelDep;
};
declare function collectDeps(model: SdkModel, targetName: string, targetDeps: Record<string, ModelDep> | undefined, log?: any): DepEntry[];
export type { DepEntry, };
export { collectDeps, };
