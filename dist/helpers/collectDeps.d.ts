type DepEntry = {
    name: string;
    version: string;
    source: 'feature' | 'target';
    raw: any;
};
declare function collectDeps(model: any, targetName: string, targetDeps: any): DepEntry[];
export type { DepEntry, };
export { collectDeps, };
